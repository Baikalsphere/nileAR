import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { z } from "zod";
import { query } from "../db.js";
import { config } from "../config.js";
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
  status: z.enum(["active", "on-hold", "inactive"]).default("active")
});

const sendCredentialsSchema = z.object({
  recipientEmail: z.string().email().max(320),
  organizationName: z.string().min(2).max(160),
  userId: z.string().min(4).max(320),
  password: z.string().min(8).max(128)
});

const contractPayloadSchema = z.object({
  hotelName: z.string().min(2).max(160),
  hotelLocation: z.string().min(2).max(160),
  organizationName: z.string().min(2).max(160),
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

router.get("/contracts/sign/:token", async (req, res, next) => {
  try {
    const token = req.params.token;

    const result = await query(
      `SELECT c.id, c.organization_id, c.status, c.contract_data, c.sign_token_expires_at,
              c.signed_by, c.signed_designation, c.signature_data_url, c.signed_at,
              o.name AS organization_name, o.contact_email, o.contact_phone
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
        status: row.status,
        contractData: row.contract_data,
        signedBy: row.signed_by,
        signedDesignation: row.signed_designation,
        signatureDataUrl: row.signature_data_url,
        signedAt: row.signed_at,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/contracts/sign/:token", async (req, res, next) => {
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

router.get("/", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.id,
              o.name,
              o.gst,
              o.credit_period,
              o.payment_terms,
              o.status,
              o.created_at,
              c.status AS contract_status
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT status
         FROM organization_contracts
         WHERE organization_id = o.id
         ORDER BY created_at DESC
         LIMIT 1
       ) c ON true
       ORDER BY created_at DESC`
    );

    const organizations = result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      gst: row.gst as string | null,
      creditPeriod: row.credit_period as string | null,
      paymentTerms: row.payment_terms as string | null,
      status: row.status as string,
      contractStatus: (row.contract_status as string | null) ?? null,
      createdAt: row.created_at as string
    }));

    return res.status(200).json({ organizations });
  } catch (error) {
    return next(error);
  }
});

router.get("/:organizationId", async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId;
    const result = await query(
      `SELECT id, name, gst, credit_period, payment_terms, registration_number,
              registered_address, contact_email, contact_phone, contact_person,
              billing_address, pan_card, status
       FROM organizations
       WHERE id = $1`,
      [organizationId]
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

router.post("/:organizationId/contracts", async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId;
    const payload = createContractSchema.parse(req.body);

    const organizationResult = await query(
      `SELECT id, name FROM organizations WHERE id = $1`,
      [organizationId]
    );

    if (organizationResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    const contractId = createContractId(organizationId);
    await query(
      `INSERT INTO organization_contracts (id, organization_id, status, contract_data)
       VALUES ($1, $2, 'draft', $3::jsonb)`,
      [contractId, organizationId, JSON.stringify(payload.contractData)]
    );

    return res.status(201).json({
      contract: {
        id: contractId,
        organizationId,
        status: "draft"
      }
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Try generating the contract again" } });
    }
    return next(error);
  }
});

router.get("/:organizationId/contracts/latest", async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId;
    const result = await query(
      `SELECT id, organization_id, status, contract_data, sign_token,
              sign_token_expires_at, signed_by, signed_designation,
              signature_data_url, signed_at, created_at, updated_at
       FROM organization_contracts
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [organizationId]
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
        signedAt: row.signed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:organizationId/contracts/:contractId/send-sign-link", async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId;
    const contractId = req.params.contractId;
    const payload = sendContractLinkSchema.parse(req.body);

    const contractResult = await query(
      `SELECT c.id, c.organization_id, c.contract_data,
              o.name AS organization_name, o.contact_email
       FROM organization_contracts c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.id = $1 AND c.organization_id = $2`,
      [contractId, organizationId]
    );

    if (contractResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Contract not found" } });
    }

    const row = contractResult.rows[0];
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

router.post("/", async (req, res, next) => {
  try {
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
             contact_email, corporate_user_id, corporate_password_hash
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, gst, credit_period, payment_terms, status, corporate_user_id`,
          [
            organizationId,
            payload.name.trim(),
            payload.gst ?? null,
            payload.creditPeriod ?? null,
            payload.paymentTerms ?? null,
            payload.status,
            normalizedCorporateEmail,
            corporateUserId,
            corporatePasswordHash
          ]
        );

        const organization = created.rows[0];

        return res.status(201).json({
          organization: {
            id: organization.id,
            name: organization.name,
            gst: organization.gst,
            creditPeriod: organization.credit_period,
            paymentTerms: organization.payment_terms,
            status: organization.status
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

router.post("/send-credentials", async (req, res, next) => {
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