import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { query } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createBillSignedUrl,
  createContractPdfSignedUrl,
  isSupabaseStorageConfigured,
  uploadContractPdfToSupabase
} from "../services/supabaseStorage.js";
import {
  sendContractSignatureLinkEmail,
  sendCorporateCredentialsEmail
} from "../services/mailer.js";

const router = Router();

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(160),
  corporateEmail: z.string().email().max(320),
  gst: z.string().max(32).optional().nullable(),
  creditPeriod: z.string().max(60).optional().nullable(),
  paymentTerms: z.string().max(120).optional().nullable(),
  status: z.enum(["active", "on-hold", "inactive"]).default("active"),
  initialOutstanding: z.number().min(0).max(999999999999).optional().nullable()
});

const lookupOrganizationQuerySchema = z.object({
  corporateEmail: z.string().email().max(320)
});

const linkOrganizationSchema = z.object({
  organizationId: z.string().min(2).max(40)
});

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  gst: z.string().max(32).optional().nullable(),
  creditPeriod: z.string().max(60).optional().nullable(),
  paymentTerms: z.string().max(120).optional().nullable(),
  status: z.enum(["active", "on-hold", "inactive"]).optional(),
  initialOutstanding: z.number().min(0).max(999999999999).optional().nullable()
});

const sendCredentialsSchema = z.object({
  recipientEmail: z.string().email().max(320),
  organizationName: z.string().min(2).max(160),
  userId: z.string().min(4).max(320),
  password: z.string().min(8).max(128)
});

const contractPayloadSchema = z.object({
  hotelName: z.string().min(2).max(160).optional().nullable(),
  hotelLocation: z.string().min(2).max(160).optional().nullable(),
  organizationName: z.string().min(2).max(160).optional().nullable(),
  contactPerson: z.string().max(160).optional().nullable(),
  companyAddress: z.string().max(500).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  mobile: z.string().max(40).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
  gstNumber: z.string().max(64).optional().nullable(),
  panCard: z.string().max(64).optional().nullable(),
  validityFrom: z.string().max(64),
  validityTo: z.string().max(64),
  roomRates: z.array(z.any()),
  extraBedCharge: z.number(),
  lateCheckoutCharge: z.number(),
  earlyCheckinCharge: z.number(),
  extraPersonCharge: z.number(),
  checkInTime: z.string().max(64),
  checkOutTime: z.string().max(64)
});

const createContractSchema = z.object({
  contractData: contractPayloadSchema
});

const sendContractLinkSchema = z.object({
  recipientEmail: z.string().email().max(320).optional(),
  portalBaseUrl: z.string().url().max(500)
});

const submitSignatureSchema = z.object({
  acceptedBy: z.string().min(2).max(160),
  designation: z.string().min(2).max(160),
  accepted: z.boolean().refine((value) => value),
  signatureDataUrl: z.string().min(30).max(2_000_000)
});

const createOrganizationId = () => {
  const value = Math.floor(100 + Math.random() * 900);
  return `ORG-${value}`;
};

const randomChars = (chars: string, length: number) => {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const selectedIndex = Math.floor(Math.random() * chars.length);
    result += chars[selectedIndex];
  }
  return result;
};

const createCorporatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + numbers + symbols;

  const base = [
    randomChars(upper, 1),
    randomChars(lower, 1),
    randomChars(numbers, 1),
    randomChars(symbols, 1),
    randomChars(all, 8)
  ].join("");

  return base
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

const createContractId = (organizationId: string) => {
  const shortOrg = organizationId.replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase();
  return `CTR-${shortOrg}-${Date.now()}`;
};

const createSignToken = () => crypto.randomBytes(32).toString("base64url");

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toDisplayDate = (value: Date) => value.toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const formatAmount = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) {
    return "";
  }
  return Math.abs(numberValue) < 0.0001 ? "" : String(Math.round(numberValue));
};

const POLICY_SECTIONS: Array<{ title: string; points: string[] }> = [
  {
    title: "THE ABOVE RATES INCLUDE",
    points: [
      "Buffet Breakfast at our all-day dining coffee shop",
      "Complimentary Wi-Fi Internet in Guest Rooms",
      "Complimentary Wireless Internet in public areas",
      "Access to swimming pool and gymnasium",
      "Extra person charge is as per contract slab plus applicable taxes"
    ]
  },
  {
    title: "TERMS & CONDITIONS",
    points: [
      "Hotel reserves rights to revise corporate rates with advance notice",
      "Special corporate offer is non-commissionable",
      "Rooms may require guarantee by deposit/correspondence/credit card",
      "To avail corporate rates, acceptance from your company is required"
    ]
  },
  {
    title: "DEPOSIT & PAYMENT POLICY",
    points: [
      "Reservations may require one-night deposit or card guarantee",
      "Delayed payments may attract interest as per agreed terms",
      "Payments are expected within the agreed credit period"
    ]
  },
  {
    title: "CANCELLATION POLICY",
    points: [
      "Cancellation terms apply as per booking window and contract",
      "Group cancellations may attract retention charges"
    ]
  },
  {
    title: "TAXATION POLICY",
    points: [
      "Taxes are applicable as per government regulations and may change"
    ]
  },
  {
    title: "CONFIRMATION",
    points: [
      "Please confirm acceptance on company letterhead with authorized signatory"
    ]
  }
];

const buildContractDataFromRecords = (
  submittedData: Record<string, any>,
  hotelProfile: Record<string, any>,
  organization: Record<string, any>
) => {
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  return {
    hotelName:
      normalizeOptional(hotelProfile.hotel_name) ??
      normalizeOptional(hotelProfile.hotel_contact_email) ??
      normalizeOptional(hotelProfile.contact_email) ??
      "Hotel",
    hotelLocation:
      normalizeOptional(hotelProfile.location) ??
      "-",
    hotelContactEmail:
      normalizeOptional(hotelProfile.hotel_contact_email) ??
      normalizeOptional(hotelProfile.contact_email) ??
      "",
    hotelContactPhone:
      normalizeOptional(hotelProfile.hotel_contact_phone) ??
      normalizeOptional(hotelProfile.contact_phone) ??
      "",
    hotelAddress:
      normalizeOptional(hotelProfile.hotel_address) ??
      normalizeOptional(hotelProfile.address) ??
      "",
    hotelGst:
      normalizeOptional(hotelProfile.hotel_gst) ??
      normalizeOptional(hotelProfile.gst) ??
      "",
    hotelLogoUrl:
      normalizeOptional(hotelProfile.logo_url) ??
      "",
    organizationName:
      normalizeOptional(organization.name) ??
      normalizeOptional(submittedData.organizationName) ??
      "Organization",
    contactPerson:
      normalizeOptional(organization.contact_person) ??
      normalizeOptional(submittedData.contactPerson) ??
      "",
    companyAddress:
      normalizeOptional(organization.registered_address) ??
      normalizeOptional(submittedData.companyAddress) ??
      "",
    billingAddress:
      normalizeOptional(organization.billing_address) ??
      normalizeOptional(organization.registered_address) ??
      normalizeOptional(submittedData.billingAddress) ??
      "",
    mobile:
      normalizeOptional(organization.contact_phone) ??
      normalizeOptional(submittedData.mobile) ??
      "",
    email:
      normalizeOptional(organization.contact_email) ??
      normalizeOptional(submittedData.email) ??
      "",
    gstNumber:
      normalizeOptional(organization.gst) ??
      normalizeOptional(submittedData.gstNumber) ??
      "",
    panCard:
      normalizeOptional(organization.pan_card) ??
      normalizeOptional(submittedData.panCard) ??
      "",
    validityFrom:
      normalizeOptional(submittedData.validityFrom) ??
      toDisplayDate(today),
    validityTo:
      normalizeOptional(submittedData.validityTo) ??
      toDisplayDate(nextYear),
    roomRates: Array.isArray(submittedData.roomRates) ? submittedData.roomRates : [],
    extraBedCharge: Number(submittedData.extraBedCharge ?? 0),
    lateCheckoutCharge: Number(submittedData.lateCheckoutCharge ?? 0),
    earlyCheckinCharge: Number(submittedData.earlyCheckinCharge ?? 0),
    extraPersonCharge: Number(submittedData.extraPersonCharge ?? 0),
    checkInTime: normalizeOptional(submittedData.checkInTime) ?? "",
    checkOutTime: normalizeOptional(submittedData.checkOutTime) ?? ""
  };
};

const createContractPdfBuffer = async (contractData: Record<string, any>, contractId: string) => {
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const borderColor = rgb(0.28, 0.37, 0.6);
  const headerFill = rgb(0.2, 0.3, 0.55);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let y = pageHeight - margin;

  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensureSpace = (required: number) => {
    if (y - required < margin) {
      newPage();
    }
  };

  const textWidth = (value: string, size: number, useBold = false) =>
    (useBold ? bold : font).widthOfTextAtSize(value, size);

  const splitTextByWidth = (value: string, maxWidth: number, size: number, useBold = false) => {
    const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return [""];
    }

    const words = normalized.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (textWidth(candidate, size, useBold) <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
          current = word;
        } else {
          lines.push(word);
          current = "";
        }
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines;
  };

  const drawWrapped = (value: string, x: number, maxWidth: number, size: number, lineHeight: number, useBold = false) => {
    const lines = splitTextByWidth(value, maxWidth, size, useBold);
    for (const line of lines) {
      page.drawText(line, {
        x,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.1, 0.1)
      });
      y -= lineHeight;
    }
    return lines.length;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(26);
    const h = 20;
    page.drawRectangle({
      x: margin,
      y: y - h + 4,
      width: pageWidth - margin * 2,
      height: h,
      color: headerFill
    });
    page.drawText(title, {
      x: margin + 6,
      y: y - 10,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1)
    });
    y -= h + 8;
  };

  const resolveLogoUrl = async (value: string) => {
    const normalized = normalizeOptional(value);
    if (!normalized) {
      return null;
    }
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      return normalized;
    }
    if (!isSupabaseStorageConfigured()) {
      return null;
    }
    return createBillSignedUrl(normalized, 120);
  };

  const loadLogo = async () => {
    const source = await resolveLogoUrl(String(contractData.hotelLogoUrl ?? ""));
    if (!source) {
      return null;
    }

    try {
      const response = await fetch(source);
      if (!response.ok) {
        return null;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (contentType.includes("png")) {
        return await pdfDoc.embedPng(bytes);
      }
      if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        return await pdfDoc.embedJpg(bytes);
      }

      try {
        return await pdfDoc.embedPng(bytes);
      } catch {
        return await pdfDoc.embedJpg(bytes);
      }
    } catch {
      return null;
    }
  };

  const logo = await loadLogo();
  const contentWidth = pageWidth - margin * 2;
  const logoBoxHeight = 64;
  const logoBoxWidth = 170;

  page.drawRectangle({
    x: margin,
    y: y - logoBoxHeight,
    width: contentWidth,
    height: logoBoxHeight,
    borderColor,
    borderWidth: 1
  });

  if (logo) {
    const scaled = logo.scale(1);
    const ratio = Math.min((logoBoxWidth - 12) / scaled.width, (logoBoxHeight - 12) / scaled.height, 1);
    page.drawImage(logo, {
      x: margin + 6,
      y: y - 6 - scaled.height * ratio,
      width: scaled.width * ratio,
      height: scaled.height * ratio
    });
  }

  page.drawText(String(contractData.hotelName ?? "Hotel"), {
    x: margin + logoBoxWidth,
    y: y - 24,
    size: 16,
    font: bold,
    color: rgb(0.08, 0.08, 0.08)
  });
  page.drawText(String(contractData.hotelLocation ?? "-"), {
    x: margin + logoBoxWidth,
    y: y - 42,
    size: 10,
    font,
    color: rgb(0.28, 0.28, 0.28)
  });
  page.drawText(`Contract ID: ${contractId}`, {
    x: margin + logoBoxWidth,
    y: y - 56,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35)
  });

  y -= logoBoxHeight + 14;
  ensureSpace(34);
  page.drawText(`Dear ${String(contractData.contactPerson || "Sir/Madam")},`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 16;
  page.drawText("We are pleased to extend the following corporate rates for your company.", {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 24;

  ensureSpace(56);
  page.drawRectangle({ x: margin, y: y - 48, width: contentWidth, height: 48, borderColor, borderWidth: 1 });
  page.drawText(`Corporate rates applicable to ${String(contractData.organizationName ?? "Organization")}`, {
    x: margin + 6,
    y: y - 16,
    size: 11,
    font: bold,
    color: rgb(0.08, 0.08, 0.08)
  });
  page.drawText("Validity", { x: margin + 6, y: y - 34, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(String(contractData.validityFrom ?? "-"), { x: margin + 90, y: y - 34, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(String(contractData.validityTo ?? "-"), { x: margin + 240, y: y - 34, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 62;

  const detailRows = [
    ["Contact Person", String(contractData.contactPerson ?? "")],
    ["Company Name", String(contractData.organizationName ?? "")],
    ["Company Address", String(contractData.companyAddress ?? "")],
    ["Billing Address", String(contractData.billingAddress ?? "")],
    ["Mobile", String(contractData.mobile ?? "")],
    ["Email", String(contractData.email ?? "")],
    ["GST Number", String(contractData.gstNumber ?? "")],
    ["PAN Card", String(contractData.panCard ?? "")]
  ];

  drawSectionTitle("COMPANY DETAILS");
  for (const [label, value] of detailRows) {
    const valueLines = splitTextByWidth(value || "-", contentWidth - 160, 9);
    const rowHeight = Math.max(22, valueLines.length * 12 + 8);
    ensureSpace(rowHeight + 2);

    page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: 150, height: rowHeight, borderColor, borderWidth: 1 });
    page.drawRectangle({ x: margin + 150, y: y - rowHeight + 4, width: contentWidth - 150, height: rowHeight, borderColor, borderWidth: 1 });
    page.drawText(label, {
      x: margin + 6,
      y: y - 14,
      size: 9,
      font: bold,
      color: rgb(0.1, 0.1, 0.1)
    });

    let lineY = y - 14;
    for (const line of valueLines) {
      page.drawText(line, {
        x: margin + 156,
        y: lineY,
        size: 9,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      lineY -= 11;
    }

    y -= rowHeight;
  }

  y -= 14;
  drawSectionTitle("CORPORATE RATES (EXCLUDING TAXES)");

  const rates = Array.isArray(contractData.roomRates) ? contractData.roomRates : [];
  const columns = [94, 146, 34, 34, 34, 34, 34, 34, 34, 34];
  const totalWidth = columns.reduce((sum, w) => sum + w, 0);

  const drawRatesHeader = () => {
    ensureSpace(42);
    let x = margin;
    page.drawRectangle({ x: margin, y: y - 34, width: totalWidth, height: 34, borderColor, borderWidth: 1 });

    const labels = ["Room Type", "Inclusions", "EP", "CP", "MAP", "AP", "EP", "CP", "MAP", "AP"];
    for (let index = 0; index < columns.length; index += 1) {
      const width = columns[index];
      if (index > 0) {
        page.drawLine({ start: { x, y: y }, end: { x, y: y - 34 }, thickness: 1, color: borderColor });
      }

      page.drawText(labels[index], {
        x: x + 4,
        y: y - 22,
        size: 8,
        font: bold,
        color: rgb(0.1, 0.1, 0.1)
      });
      x += width;
    }

    page.drawText("Single Occupancy", {
      x: margin + columns[0] + columns[1] + 6,
      y: y - 10,
      size: 8,
      font: bold,
      color: rgb(0.1, 0.1, 0.1)
    });
    page.drawText("Double Occupancy", {
      x: margin + columns[0] + columns[1] + columns[2] + columns[3] + columns[4] + columns[5] + 6,
      y: y - 10,
      size: 8,
      font: bold,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 34;
  };

  drawRatesHeader();
  for (const rate of rates.slice(0, 80)) {
    const inclusions = splitTextByWidth(String(rate?.inclusions ?? "-"), columns[1] - 8, 8);
    const rowHeight = Math.max(24, inclusions.length * 10 + 8);
    if (y - rowHeight < margin + 10) {
      newPage();
      drawSectionTitle("CORPORATE RATES (EXCLUDING TAXES)");
      drawRatesHeader();
    }

    page.drawRectangle({ x: margin, y: y - rowHeight, width: totalWidth, height: rowHeight, borderColor, borderWidth: 1 });
    let cursorX = margin;
    for (let index = 1; index < columns.length; index += 1) {
      cursorX += columns[index - 1];
      page.drawLine({ start: { x: cursorX, y }, end: { x: cursorX, y: y - rowHeight }, thickness: 1, color: borderColor });
    }

    page.drawText(String(rate?.roomType ?? "Room"), {
      x: margin + 4,
      y: y - 14,
      size: 8,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });

    let incY = y - 12;
    for (const line of inclusions) {
      page.drawText(line, {
        x: margin + columns[0] + 4,
        y: incY,
        size: 8,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      incY -= 9;
    }

    const values = [
      formatAmount(rate?.singleOccupancy?.ep),
      formatAmount(rate?.singleOccupancy?.cp),
      formatAmount(rate?.singleOccupancy?.map),
      formatAmount(rate?.singleOccupancy?.ap),
      formatAmount(rate?.doubleOccupancy?.ep),
      formatAmount(rate?.doubleOccupancy?.cp),
      formatAmount(rate?.doubleOccupancy?.map),
      formatAmount(rate?.doubleOccupancy?.ap)
    ];

    let valueX = margin + columns[0] + columns[1];
    for (let index = 0; index < values.length; index += 1) {
      const cellWidth = columns[index + 2];
      const value = values[index];
      const valueWidth = textWidth(value || "", 8);
      page.drawText(value || "", {
        x: valueX + Math.max(3, (cellWidth - valueWidth) / 2),
        y: y - 14,
        size: 8,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      valueX += cellWidth;
    }

    y -= rowHeight;
  }

  y -= 10;
  drawSectionTitle("ADDITIONAL CHARGES & TIMINGS");
  const chargeRows = [
    ["Extra bed", `INR ${Number(contractData.extraBedCharge ?? 0).toFixed(2)}`],
    ["Late checkout charge", `INR ${Number(contractData.lateCheckoutCharge ?? 0).toFixed(2)}`],
    ["Early checkin charge", `INR ${Number(contractData.earlyCheckinCharge ?? 0).toFixed(2)}`],
    ["Extra person", `INR ${Number(contractData.extraPersonCharge ?? 0).toFixed(2)}`],
    ["Standard check-in time", String(contractData.checkInTime ?? "-")],
    ["Check-out time", String(contractData.checkOutTime ?? "-")]
  ];

  for (const [label, value] of chargeRows) {
    ensureSpace(24);
    page.drawRectangle({ x: margin, y: y - 20, width: 180, height: 20, borderColor, borderWidth: 1 });
    page.drawRectangle({ x: margin + 180, y: y - 20, width: 220, height: 20, borderColor, borderWidth: 1 });
    page.drawText(label, { x: margin + 6, y: y - 13, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(value, { x: margin + 186, y: y - 13, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;
  }

  y -= 14;
  for (const section of POLICY_SECTIONS) {
    drawSectionTitle(section.title);
    for (const point of section.points) {
      ensureSpace(16);
      const lines = splitTextByWidth(`• ${point}`, contentWidth - 12, 9);
      for (const line of lines) {
        ensureSpace(12);
        page.drawText(line, {
          x: margin + 8,
          y,
          size: 9,
          font,
          color: rgb(0.15, 0.15, 0.15)
        });
        y -= 11;
      }
      y -= 2;
    }
    y -= 8;
  }

  ensureSpace(70);
  page.drawText("Kind Regards,", {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 16;
  page.drawText(String(contractData.hotelName ?? "Hotel"), {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 14;
  drawWrapped(String(contractData.hotelAddress ?? ""), margin, contentWidth, 9, 11);
  if (contractData.hotelContactEmail) {
    page.drawText(`Email: ${String(contractData.hotelContactEmail)}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 12;
  }
  if (contractData.hotelContactPhone) {
    page.drawText(`Phone: ${String(contractData.hotelContactPhone)}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

let ensureHotelOrganizationsTablePromise: Promise<void> | null = null;

const ensureHotelOrganizationsTable = async () => {
  if (!ensureHotelOrganizationsTablePromise) {
    ensureHotelOrganizationsTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS hotel_organizations (
           id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
           hotel_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
           created_at timestamptz NOT NULL DEFAULT now(),
           UNIQUE (hotel_user_id, organization_id)
         )`
      );

      await query(
        `CREATE INDEX IF NOT EXISTS hotel_organizations_hotel_user_id_idx
         ON hotel_organizations(hotel_user_id)`
      );

      await query(
        `CREATE INDEX IF NOT EXISTS hotel_organizations_organization_id_idx
         ON hotel_organizations(organization_id)`
      );

      await query(
        `INSERT INTO hotel_organizations (hotel_user_id, organization_id)
         SELECT o.created_by_user_id, o.id
         FROM organizations o
         WHERE o.created_by_user_id IS NOT NULL
         ON CONFLICT (hotel_user_id, organization_id) DO NOTHING`
      );
    })().catch((error) => {
      ensureHotelOrganizationsTablePromise = null;
      throw error;
    });
  }

  await ensureHotelOrganizationsTablePromise;
};

// Handle CORS preflight for public endpoints
router.options("/contracts/sign/:token/pdf", async (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.status(200).end();
});

router.get("/contracts/sign/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;

    const result = await query(
      `SELECT c.id, c.organization_id, c.status, c.contract_data, c.sign_token_expires_at,
              c.signed_by, c.signed_designation, c.signature_data_url, c.signed_at,
              c.pdf_storage_path,
              o.id AS org_id,
              o.name AS organization_name,
              o.gst,
              o.credit_period,
              o.payment_terms,
              o.registration_number,
              o.registered_address,
              o.contact_email,
              o.contact_phone,
              o.contact_person,
              o.billing_address,
              o.pan_card
       FROM organization_contracts c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.sign_token = $1`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Invalid signing link" } });
    }

    const row = result.rows[0];
    if (row.sign_token_expires_at && new Date(row.sign_token_expires_at) < new Date()) {
      return res.status(410).json({ error: { message: "Signing link has expired" } });
    }

    return res.status(200).json({
      contract: {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationGst: row.gst,
        organizationCreditPeriod: row.credit_period,
        organizationPaymentTerms: row.payment_terms,
        organizationRegistrationNumber: row.registration_number,
        organizationRegisteredAddress: row.registered_address,
        organizationContactEmail: row.contact_email,
        organizationContactPhone: row.contact_phone,
        organizationContactPerson: row.contact_person,
        organizationBillingAddress: row.billing_address,
        organizationPanCard: row.pan_card,
        status: row.status,
        contractData: row.contract_data,
        signedBy: row.signed_by,
        signedDesignation: row.signed_designation,
        signatureDataUrl: row.signature_data_url,
        signedAt: row.signed_at,
        pdfUrl: row.pdf_storage_path
          ? `/api/organizations/contracts/sign/${encodeURIComponent(token)}/pdf`
          : null,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/contracts/sign/:token/pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;

    const result = await query(
      `SELECT id, pdf_storage_path, sign_token_expires_at
       FROM organization_contracts
       WHERE sign_token = $1
       LIMIT 1`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Invalid signing link" } });
    }

    const row = result.rows[0];
    if (row.sign_token_expires_at && new Date(row.sign_token_expires_at) < new Date()) {
      return res.status(410).json({ error: { message: "Signing link has expired" } });
    }

    if (!row.pdf_storage_path) {
      return res.status(404).json({ error: { message: "Contract PDF not found" } });
    }

    if (!isSupabaseStorageConfigured()) {
      return res.status(500).json({ error: { message: "Supabase storage is not configured" } });
    }

    const signedUrl = await createContractPdfSignedUrl(row.pdf_storage_path as string, 120);
    const fileResponse = await fetch(signedUrl);
    if (!fileResponse.ok) {
      return res.status(404).json({ error: { message: "Contract PDF not found on cloud storage" } });
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="contract-${row.id as string}.pdf"`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

router.post("/contracts/sign/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;
    const payload = submitSignatureSchema.parse(req.body);

    const current = await query(
      `SELECT id, organization_id, sign_token_expires_at, status
       FROM organization_contracts
       WHERE sign_token = $1`,
      [token]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: { message: "Invalid signing link" } });
    }

    const contract = current.rows[0];
    if (contract.sign_token_expires_at && new Date(contract.sign_token_expires_at) < new Date()) {
      return res.status(410).json({ error: { message: "Signing link has expired" } });
    }

    if (contract.status === "signed") {
      return res.status(409).json({ error: { message: "Contract is already signed" } });
    }

    await query(
      `UPDATE organization_contracts
       SET status = 'signed',
           signed_by = $2,
           signed_designation = $3,
           signature_data_url = $4,
           signed_at = now(),
           sign_token = NULL,
           sign_token_expires_at = NULL
       WHERE id = $1`,
      [
        contract.id,
        payload.acceptedBy.trim(),
        payload.designation.trim(),
        payload.signatureDataUrl
      ]
    );

    return res.status(200).json({
      ok: true,
      contractId: contract.id,
      organizationId: contract.organization_id
    });
  } catch (error) {
    return next(error);
  }
});

router.use(requireAuth);
router.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await ensureHotelOrganizationsTable();
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get("/lookup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { corporateEmail } = lookupOrganizationQuerySchema.parse(req.query);
    const normalizedCorporateEmail = corporateEmail.trim().toLowerCase();

    const result = await query(
      `SELECT o.id,
              o.name,
              o.gst,
              o.credit_period,
              o.payment_terms,
              o.status,
              o.contact_email,
              o.corporate_user_id,
              EXISTS (
                SELECT 1
                FROM hotel_organizations ho
                WHERE ho.hotel_user_id = $2
                  AND ho.organization_id = o.id
              ) AS is_linked
       FROM organizations o
       WHERE o.contact_email = $1
       LIMIT 1`,
      [normalizedCorporateEmail, userId]
    );

    if (result.rowCount === 0) {
      return res.status(200).json({ found: false });
    }

    const row = result.rows[0];
    return res.status(200).json({
      found: true,
      organization: {
        id: row.id,
        name: row.name,
        gst: row.gst,
        creditPeriod: row.credit_period,
        paymentTerms: row.payment_terms,
        status: row.status,
        corporateEmail: row.contact_email,
        corporateUserId: row.corporate_user_id,
        isLinked: Boolean(row.is_linked)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/link-existing", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const payload = linkOrganizationSchema.parse(req.body);

    const organizationResult = await query(
      `SELECT id, name, gst, credit_period, payment_terms, status
       FROM organizations
       WHERE id = $1
       LIMIT 1`,
      [payload.organizationId]
    );

    if (organizationResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    await query(
      `INSERT INTO hotel_organizations (hotel_user_id, organization_id)
       VALUES ($1, $2)
       ON CONFLICT (hotel_user_id, organization_id) DO NOTHING`,
      [userId, payload.organizationId]
    );

    const row = organizationResult.rows[0];
    return res.status(200).json({
      organization: {
        id: row.id,
        name: row.name,
        gst: row.gst,
        creditPeriod: row.credit_period,
        paymentTerms: row.payment_terms,
        status: row.status,
        contractStatus: null
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const result = await query(
      `SELECT o.id,
              o.name,
              o.gst,
              o.credit_period,
              o.payment_terms,
              o.status,
              o.created_at,
              o.initial_outstanding,
              c.status AS contract_status,
              COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) AS amount_received,
              COALESCE(o.initial_outstanding, 0) + COALESCE(SUM(CASE WHEN i.status IN ('unpaid', 'overdue') THEN i.amount ELSE 0 END), 0) AS outstanding_amount
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT status
         FROM organization_contracts
         WHERE organization_id = o.id
           AND hotel_user_id = $1
         ORDER BY created_at DESC
         LIMIT 1
       ) c ON true
       JOIN hotel_organizations ho ON ho.organization_id = o.id
       LEFT JOIN hotel_bookings hb ON hb.organization_id = o.id
                                 AND hb.created_by = ho.hotel_user_id::text
       LEFT JOIN corporate_invoices i ON i.booking_id = hb.id
       WHERE ho.hotel_user_id = $1
       GROUP BY o.id, o.name, o.gst, o.credit_period, o.payment_terms, o.status, o.created_at, o.initial_outstanding, c.status
       ORDER BY o.created_at DESC`
      ,
      [userId]
    );

    const organizations = result.rows.map((row: any) => ({
      id: row.id as string,
      name: row.name as string,
      gst: row.gst as string | null,
      creditPeriod: row.credit_period as string | null,
      paymentTerms: row.payment_terms as string | null,
      status: row.status as string,
      contractStatus: (row.contract_status as string | null) ?? null,
      amountReceived: Number(row.amount_received ?? 0),
      outstandingAmount: Number(row.outstanding_amount ?? 0),
      initialOutstanding: Number(row.initial_outstanding ?? 0),
      createdAt: row.created_at as string
    }));

    return res.status(200).json({ organizations });
  } catch (error) {
    return next(error);
  }
});

router.get("/:organizationId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;
    const result = await query(
      `SELECT id, name, gst, credit_period, payment_terms, registration_number,
              registered_address, contact_email, contact_phone, contact_person,
              billing_address, pan_card, status
       FROM organizations
       WHERE id = $1
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = organizations.id
             AND ho.hotel_user_id = $2
         )`,
      [organizationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    const row = result.rows[0];
    return res.status(200).json({
      organization: {
        id: row.id,
        name: row.name,
        gst: row.gst,
        creditPeriod: row.credit_period,
        paymentTerms: row.payment_terms,
        registrationNumber: row.registration_number,
        registeredAddress: row.registered_address,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        contactPerson: row.contact_person,
        billingAddress: row.billing_address,
        panCard: row.pan_card,
        status: row.status
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:organizationId/reconciliation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;

    const accessResult = await query(
      `SELECT o.initial_outstanding
       FROM hotel_organizations ho
       JOIN organizations o ON o.id = ho.organization_id
       WHERE ho.organization_id = $1
         AND ho.hotel_user_id = $2
       LIMIT 1`,
      [organizationId, userId]
    );

    if (accessResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    const initialOutstanding = Number(accessResult.rows[0].initial_outstanding ?? 0);

    const invoicesResult = await query(
      `SELECT i.id,
              i.invoice_number,
              i.invoice_date,
              i.due_date,
              i.amount,
              i.status,
              i.updated_at,
              COALESCE(es.property_name, hb.room_type, 'Hotel stay') AS description
       FROM corporate_invoices i
       JOIN hotel_bookings hb ON hb.id = i.booking_id
       LEFT JOIN employee_stays es ON es.invoice_id = i.id
       WHERE i.organization_id = $1
         AND hb.created_by = $2
       ORDER BY i.invoice_date DESC, i.created_at DESC`,
      [organizationId, userId]
    );

    const now = new Date();

    const items: Array<{
      id: string;
      type: "invoice" | "payment";
      date: string;
      dueDate?: string;
      description: string;
      invoiceNumber?: string;
      paymentReference?: string;
      amount: number;
      status: "matched" | "unmatched" | "partial";
      icon: string;
      matchedWith?: string;
      daysOverdue?: number;
    }> = [];

    const discrepancies: Array<{
      id: string;
      invoiceId: string;
      amount: number;
      reason: string;
      resolved: boolean;
    }> = [];

    for (const row of invoicesResult.rows) {
      const invoiceNumber = String(row.invoice_number);
      const amount = Number(row.amount ?? 0);
      const statusRaw = String(row.status ?? "").toLowerCase();
      const invoiceDate = row.invoice_date ? new Date(row.invoice_date) : null;
      const dueDate = row.due_date ? new Date(row.due_date) : null;
      const updatedAt = row.updated_at ? new Date(row.updated_at) : null;
      const isPaid = statusRaw === "paid";
      const isPartial = statusRaw.includes("partial");
      const itemStatus: "matched" | "unmatched" | "partial" = isPaid ? "matched" : isPartial ? "partial" : "unmatched";

      const daysOverdue =
        dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now.getTime() && !isPaid
          ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

      items.push({
        id: `inv-${row.id}`,
        type: "invoice",
        date: invoiceDate && !Number.isNaN(invoiceDate.getTime()) ? invoiceDate.toISOString().slice(0, 10) : "-",
        dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString().slice(0, 10) : "-",
        description: String(row.description ?? "Corporate stay invoice"),
        invoiceNumber,
        amount,
        status: itemStatus,
        icon: "receipt",
        matchedWith: isPaid ? `PAY-${invoiceNumber}` : undefined,
        daysOverdue
      });

      if (isPaid) {
        items.push({
          id: `pay-${row.id}`,
          type: "payment",
          date: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toISOString().slice(0, 10) : "-",
          description: `Payment received for ${invoiceNumber}`,
          paymentReference: `PAY-${invoiceNumber}`,
          amount,
          status: "matched",
          icon: "check_circle",
          matchedWith: invoiceNumber
        });
      }

      if (daysOverdue > 0 && !isPaid) {
        discrepancies.push({
          id: `disc-${row.id}`,
          invoiceId: invoiceNumber,
          amount,
          reason: `Invoice overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`,
          resolved: false
        });
      }
    }

    return res.status(200).json({
      reconciliation: {
        items,
        discrepancies,
        initialOutstanding
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:organizationId/contracts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;
    const payload = createContractSchema.parse(req.body);

    const organizationResult = await query(
      `SELECT o.id,
              o.name,
              o.gst,
              o.contact_person,
              o.contact_email,
              o.contact_phone,
              o.registered_address,
              o.billing_address,
              o.pan_card,
              hp.hotel_name,
              hp.location,
              hp.contact_email AS hotel_contact_email,
              hp.contact_phone AS hotel_contact_phone,
              hp.address AS hotel_address,
              hp.gst AS hotel_gst,
              hp.logo_url AS logo_url
       FROM organizations
       o
       LEFT JOIN hotel_profiles hp ON hp.user_id = $2
       WHERE o.id = $1
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = o.id
             AND ho.hotel_user_id = $2
         )`,
      [organizationId, userId]
    );

    if (organizationResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    const organizationRecord = organizationResult.rows[0] as Record<string, any>;
    const hotelProfileRecord = {
      hotel_name: organizationRecord.hotel_name,
      location: organizationRecord.location,
      hotel_contact_email: organizationRecord.hotel_contact_email,
      hotel_contact_phone: organizationRecord.hotel_contact_phone,
      hotel_address: organizationRecord.hotel_address,
      hotel_gst: organizationRecord.hotel_gst,
      logo_url: organizationRecord.logo_url
    };
    const contractData = buildContractDataFromRecords(
      payload.contractData as Record<string, any>,
      hotelProfileRecord,
      organizationRecord
    );

    if (!isSupabaseStorageConfigured()) {
      return res.status(500).json({ error: { message: "Supabase storage is not configured" } });
    }

    const contractId = createContractId(organizationId);
    const pdfBuffer = await createContractPdfBuffer(contractData, contractId);
    const uploadedPdf = await uploadContractPdfToSupabase({
      hotelUserId: String(userId),
      organizationId,
      contractId,
      fileBuffer: pdfBuffer
    });

    await query(
      `INSERT INTO organization_contracts (
         id,
         organization_id,
         hotel_user_id,
         status,
         contract_data,
         pdf_storage_path
       )
       VALUES ($1, $2, $3, 'draft', $4::jsonb, $5)`,
      [
        contractId,
        organizationId,
        userId,
        JSON.stringify(contractData),
        uploadedPdf.objectPath
      ]
    );

    return res.status(201).json({
      contract: {
        id: contractId,
        organizationId,
        status: "draft",
        contractData,
        pdfUrl: `/api/organizations/${organizationId}/contracts/${contractId}/pdf`
      }
    });
  } catch (error: any) {
    if (error?.code === "23503") {
      return res.status(403).json({ error: { message: "Not authorized to generate contract for this organization" } });
    }
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Try generating the contract again" } });
    }
    return next(error);
  }
});

router.get("/:organizationId/contracts/latest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;
    const result = await query(
      `SELECT id, organization_id, status, contract_data, sign_token,
              sign_token_expires_at, signed_by, signed_designation,
              signature_data_url, signed_at, created_at, updated_at,
              pdf_storage_path
       FROM organization_contracts
       WHERE organization_id = $1
         AND hotel_user_id = $2
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = organization_contracts.organization_id
             AND ho.hotel_user_id = $2
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [organizationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "No contract found" } });
    }

    const row = result.rows[0];
    return res.status(200).json({
      contract: {
        id: row.id,
        organizationId: row.organization_id,
        status: row.status,
        contractData: row.contract_data,
        signTokenActive: Boolean(row.sign_token),
        signTokenExpiresAt: row.sign_token_expires_at,
        signedBy: row.signed_by,
        signedDesignation: row.signed_designation,
        signatureDataUrl: row.signature_data_url,
        pdfUrl: `/api/organizations/${organizationId}/contracts/${row.id}/pdf`,
        signedAt: row.signed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:organizationId/contracts/signed-history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;

    const result = await query(
      `SELECT c.id,
              c.organization_id,
              c.status,
              c.signed_by,
              c.signed_designation,
              c.signed_at,
              c.created_at,
              c.updated_at
       FROM organization_contracts c
       WHERE c.organization_id = $1
         AND c.hotel_user_id = $2
         AND c.status = 'signed'
         AND c.signed_at IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = c.organization_id
             AND ho.hotel_user_id = $2
         )
       ORDER BY c.signed_at DESC, c.created_at DESC`,
      [organizationId, userId]
    );

    const contracts = result.rows.map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      status: row.status,
      signedBy: row.signed_by,
      signedDesignation: row.signed_designation,
      signedAt: row.signed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      pdfUrl: `/api/organizations/${organizationId}/contracts/${row.id}/pdf`
    }));

    return res.status(200).json({
      currentSignedContract: contracts[0] ?? null,
      previousSignedContracts: contracts.slice(1)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:organizationId/contracts/:contractId/pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;
    const contractId = req.params.contractId;

    const result = await query(
      `SELECT c.id, c.pdf_storage_path, c.contract_data
       FROM organization_contracts c
       WHERE c.id = $1
         AND c.organization_id = $2
         AND c.hotel_user_id = $3
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = c.organization_id
             AND ho.hotel_user_id = $3
         )
       LIMIT 1`,
      [contractId, organizationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Contract not found" } });
    }

    const row = result.rows[0];
    if (!row.pdf_storage_path) {
      const fallbackPdfBuffer = await createContractPdfBuffer(row.contract_data as Record<string, any>, row.id as string);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="contract-${row.id as string}.pdf"`);
      res.setHeader("Cache-Control", "no-store");
      return res.send(fallbackPdfBuffer);
    }

    if (!isSupabaseStorageConfigured()) {
      return res.status(500).json({ error: { message: "Supabase storage is not configured" } });
    }

    const signedUrl = await createContractPdfSignedUrl(row.pdf_storage_path as string, 120);
    const fileResponse = await fetch(signedUrl);
    if (!fileResponse.ok) {
      return res.status(404).json({ error: { message: "Contract PDF not found on cloud storage" } });
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="contract-${row.id as string}.pdf"`);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

router.post("/:organizationId/contracts/:contractId/send-sign-link", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;
    const contractId = req.params.contractId;
    const payload = sendContractLinkSchema.parse(req.body);

    const contractResult = await query(
      `SELECT c.id, c.organization_id, c.contract_data,
              c.pdf_storage_path,
              o.id AS org_id,
              o.name AS organization_name,
              o.gst,
              o.credit_period,
              o.payment_terms,
              o.registration_number,
              o.registered_address,
              o.contact_email,
              o.contact_phone,
              o.contact_person,
              o.billing_address,
              o.pan_card
       FROM organization_contracts c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.id = $1
         AND c.organization_id = $2
         AND c.hotel_user_id = $3
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = o.id
             AND ho.hotel_user_id = $3
         )`,
      [contractId, organizationId, userId]
    );

    if (contractResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Contract not found" } });
    }

    const row = contractResult.rows[0];
    if (!row.pdf_storage_path) {
      return res.status(400).json({ error: { message: "Generate contract PDF before sending signing link" } });
    }
    const recipientEmail = (payload.recipientEmail?.trim().toLowerCase() || row.contact_email || "").toString();
    if (!recipientEmail) {
      return res.status(400).json({ error: { message: "Recipient email is required" } });
    }

    const signToken = createSignToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE organization_contracts
       SET status = CASE WHEN status = 'signed' THEN status ELSE 'sent' END,
           sign_token = $3,
           sign_token_expires_at = $4
       WHERE id = $1 AND organization_id = $2`,
      [contractId, organizationId, signToken, expiresAt]
    );

    const contractData = row.contract_data as Record<string, unknown>;
    const hotelName =
      typeof contractData?.hotelName === "string" && contractData.hotelName.trim().length > 0
        ? contractData.hotelName.trim()
        : "Your Hotel";
    const signLink = `${payload.portalBaseUrl.replace(/\/$/, "")}/corporate-portal/contracts/sign?token=${encodeURIComponent(signToken)}`;

    await sendContractSignatureLinkEmail({
      recipientEmail,
      organizationName: String(row.organization_name),
      hotelName,
      signLink
    });

    return res.status(200).json({
      ok: true,
      signLink,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/:organizationId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.params.organizationId;
    const payload = updateOrganizationSchema.parse(req.body);

    const accessCheck = await query(
      `SELECT 1 FROM hotel_organizations WHERE organization_id = $1 AND hotel_user_id = $2 LIMIT 1`,
      [organizationId, userId]
    );
    if (accessCheck.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    const setClauses: string[] = ["updated_at = now()"];
    const values: any[] = [];
    let paramIndex = 1;

    if (payload.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(payload.name.trim());
      paramIndex += 1;
    }
    if (payload.gst !== undefined) {
      setClauses.push(`gst = $${paramIndex}`);
      values.push(payload.gst ?? null);
      paramIndex += 1;
    }
    if (payload.creditPeriod !== undefined) {
      setClauses.push(`credit_period = $${paramIndex}`);
      values.push(payload.creditPeriod ?? null);
      paramIndex += 1;
    }
    if (payload.paymentTerms !== undefined) {
      setClauses.push(`payment_terms = $${paramIndex}`);
      values.push(payload.paymentTerms ?? null);
      paramIndex += 1;
    }
    if (payload.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(payload.status);
      paramIndex += 1;
    }
    if (payload.initialOutstanding !== undefined) {
      setClauses.push(`initial_outstanding = $${paramIndex}`);
      values.push(payload.initialOutstanding ?? 0);
      paramIndex += 1;
    }

    values.push(organizationId);
    const result = await query(
      `UPDATE organizations SET ${setClauses.join(", ")} WHERE id = $${paramIndex}
       RETURNING id, name, gst, credit_period, payment_terms, status, initial_outstanding`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    const row = result.rows[0];
    return res.status(200).json({
      organization: {
        id: row.id,
        name: row.name,
        gst: row.gst,
        creditPeriod: row.credit_period,
        paymentTerms: row.payment_terms,
        status: row.status,
        initialOutstanding: Number(row.initial_outstanding ?? 0)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const payload = createOrganizationSchema.parse(req.body);
    const normalizedCorporateEmail = payload.corporateEmail.trim().toLowerCase();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const organizationId = createOrganizationId();
      const corporateUserId = normalizedCorporateEmail;
      const generatedPassword = createCorporatePassword();
      const corporatePasswordHash = await bcrypt.hash(generatedPassword, config.bcryptCost);

      try {
        const created = await query(
          `INSERT INTO organizations (
             id, name, gst, credit_period, payment_terms, status,
             contact_email, corporate_user_id, corporate_password_hash, created_by_user_id,
             initial_outstanding
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, name, gst, credit_period, payment_terms, status, corporate_user_id, initial_outstanding`,
          [
            organizationId,
            payload.name.trim(),
            payload.gst ?? null,
            payload.creditPeriod ?? null,
            payload.paymentTerms ?? null,
            payload.status,
            normalizedCorporateEmail,
            corporateUserId,
            corporatePasswordHash,
            userId,
            payload.initialOutstanding ?? 0
          ]
        );

        const organization = created.rows[0];

        await query(
          `INSERT INTO hotel_organizations (hotel_user_id, organization_id)
           VALUES ($1, $2)
           ON CONFLICT (hotel_user_id, organization_id) DO NOTHING`,
          [userId, organization.id]
        );

        return res.status(201).json({
          organization: {
            id: organization.id,
            name: organization.name,
            gst: organization.gst,
            creditPeriod: organization.credit_period,
            paymentTerms: organization.payment_terms,
            status: organization.status,
            amountReceived: 0,
            outstandingAmount: Number(organization.initial_outstanding ?? 0),
            initialOutstanding: Number(organization.initial_outstanding ?? 0)
          },
          credentials: {
            userId: organization.corporate_user_id,
            password: generatedPassword,
            email: normalizedCorporateEmail
          }
        });
      } catch (error: any) {
        if (error?.code !== "23505") {
          throw error;
        }

        const constraint = String(error?.constraint ?? "");
        if (
          constraint.includes("organizations_contact_email_uniq") ||
          constraint.includes("organizations_corporate_user_id_key")
        ) {
          return res.status(409).json({
            error: { message: "Corporate email already exists for another organization" }
          });
        }
      }
    }

    return res.status(500).json({
      error: { message: "Unable to generate unique credentials. Please try again." }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/send-credentials", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = sendCredentialsSchema.parse(req.body);

    await sendCorporateCredentialsEmail({
      recipientEmail: payload.recipientEmail.trim().toLowerCase(),
      organizationName: payload.organizationName.trim(),
      userId: payload.userId.trim(),
      password: payload.password
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;