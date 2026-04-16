import { Router } from "express";
import fs from "node:fs";
import multer from "multer";
import { z } from "zod";
import { pool, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { deleteBillFileFromCloudinary } from "../services/cloudStorage.js";
import {
  deleteBillFromSupabase,
  isSupabaseStorageConfigured,
  uploadBillFileToSupabase
} from "../services/supabaseStorage.js";
import {
  sendBookingRequestAcceptedOrganizationEmail,
  sendCorporateInvoiceCoverLetterEmail
} from "../services/mailer.js";

const router = Router();

const createBookingSchema = z.object({
  bookingNumber: z.string().min(2).max(60),
  organizationId: z.string().min(2).max(40),
  employeeId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(200).optional(),
  roomType: z.string().min(2).max(120),
  manualPricePerNight: z.number().positive().optional(),
  checkInDate: z.string().min(8).max(20),
  checkOutDate: z.string().min(8).max(20),
  gstApplicable: z.boolean().default(false),
  status: z.enum(["pending", "confirmed", "checked-in", "checked-out"]).default("pending")
}).refine(
  (data) => data.employeeId || data.guestName,
  { message: "Either employeeId or guestName must be provided" }
);

const bookingRequestDecisionSchema = z.object({
  action: z.enum(["accept", "reject"]),
  rejectionReason: z.string().max(300).optional().nullable()
});

const bookingBillsSchema = z.object({
  billCategory: z.string().min(2).max(120),
  fileName: z.string().min(1).max(255).optional(),
  billAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  mimeType: z.string().max(120).optional().nullable(),
  fileSize: z.coerce.number().int().min(0).max(200_000_000).optional().nullable(),
  notes: z.string().max(500).optional().nullable()
});

const billUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

const sendInvoiceSchema = z.object({
  recipientEmail: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().email().max(320).optional().nullable()
  ),
  ccEmail: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().email().max(320).optional().nullable()
  ),
  portalBaseUrl: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().url().max(500).optional().nullable()
  ),
  bills: z
    .array(
      z.object({
        category: z.string().min(2).max(120),
        fileName: z.string().min(1).max(255)
      })
    )
    .optional()
    .default([])
});

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

let ensureHotelOrganizationsTablePromise: Promise<void> | null = null;
let ensureBookingRequestsTablePromise: Promise<void> | null = null;

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

const ensureBookingRequestsTable = async () => {
  if (!ensureBookingRequestsTablePromise) {
    ensureBookingRequestsTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS booking_requests (
           id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
           booking_number text NOT NULL,
           organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
           hotel_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           employee_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE RESTRICT,
           room_type text NOT NULL,
           check_in_date date NOT NULL,
           check_out_date date NOT NULL,
           nights integer NOT NULL,
           price_per_night numeric(12,2) NOT NULL,
           total_price numeric(12,2) NOT NULL,
           gst_applicable boolean NOT NULL DEFAULT false,
           status text NOT NULL DEFAULT 'pending',
           rejection_reason text,
           requested_at timestamptz NOT NULL DEFAULT now(),
           responded_at timestamptz,
           responded_by text,
           booking_id uuid REFERENCES hotel_bookings(id) ON DELETE SET NULL,
           created_at timestamptz NOT NULL DEFAULT now(),
           updated_at timestamptz NOT NULL DEFAULT now(),
           UNIQUE (hotel_user_id, booking_number)
         )`
      );

      await query(
        `CREATE INDEX IF NOT EXISTS booking_requests_hotel_user_id_idx
         ON booking_requests(hotel_user_id)`
      );

      await query(
        `CREATE INDEX IF NOT EXISTS booking_requests_organization_id_idx
         ON booking_requests(organization_id)`
      );

      await query(
        `CREATE INDEX IF NOT EXISTS booking_requests_status_idx
         ON booking_requests(status)`
      );

      await query(
        `DROP TRIGGER IF EXISTS booking_requests_set_updated_at ON booking_requests`
      );

      await query(
        `CREATE TRIGGER booking_requests_set_updated_at
         BEFORE UPDATE ON booking_requests
         FOR EACH ROW
         EXECUTE PROCEDURE set_updated_at()`
      );
    })().catch((error) => {
      ensureBookingRequestsTablePromise = null;
      throw error;
    });
  }

  await ensureBookingRequestsTablePromise;
};

const getDaysBetween = (checkInDate: string, checkOutDate: string) => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  return Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
};

const parseCreditPeriodDays = (creditPeriod: unknown, fallback = 15) => {
  if (typeof creditPeriod === "number" && Number.isFinite(creditPeriod) && creditPeriod >= 0) {
    return Math.floor(creditPeriod);
  }

  if (typeof creditPeriod === "string") {
    const match = creditPeriod.match(/\d+/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  }

  return fallback;
};

const parsePositiveRate = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const resolveNightlyRate = (roomRate: any): number | null => {
  const candidates = [
    roomRate?.singleOccupancy?.cp,
    roomRate?.singleOccupancy?.ep,
    roomRate?.singleOccupancy?.map,
    roomRate?.singleOccupancy?.ap,
    roomRate?.doubleOccupancy?.cp,
    roomRate?.doubleOccupancy?.ep,
    roomRate?.doubleOccupancy?.map,
    roomRate?.doubleOccupancy?.ap
  ];

  for (const candidate of candidates) {
    const rate = parsePositiveRate(candidate);
    if (rate !== null) {
      return rate;
    }
  }

  return null;
};

const getLatestSignedContract = async (organizationId: string, hotelUserId: string) => {
  const contractResult = await query(
    `SELECT c.id, c.contract_data
     FROM organization_contracts c
     JOIN hotel_organizations ho ON ho.organization_id = c.organization_id
     WHERE c.organization_id = $1
       AND c.status = 'signed'
       AND c.hotel_user_id = $2
       AND ho.hotel_user_id = $2
     ORDER BY c.signed_at DESC NULLS LAST, c.created_at DESC
     LIMIT 1`,
    [organizationId, hotelUserId]
  );

  if (contractResult.rowCount === 0) {
    return null;
  }

  return contractResult.rows[0];
};

const prepareBookingDetails = async (payload: z.infer<typeof createBookingSchema>, hotelUserId: string) => {
  const nights = getDaysBetween(payload.checkInDate, payload.checkOutDate);

  if (payload.manualPricePerNight !== undefined) {
    const totalPrice = Number((nights * payload.manualPricePerNight).toFixed(2));
    return { contractNightlyRate: payload.manualPricePerNight, nights, totalPrice };
  }

  const contract = await getLatestSignedContract(payload.organizationId, hotelUserId);
  if (!contract) {
    return { error: "Selected organization does not have a signed contract. Please enter the room price manually." };
  }

  const roomRates = Array.isArray(contract.contract_data?.roomRates)
    ? contract.contract_data.roomRates
    : [];

  const selectedRoom = roomRates.find((roomRate: any) => {
    const contractRoomType = typeof roomRate?.roomType === "string" ? roomRate.roomType.trim().toLowerCase() : "";
    return contractRoomType.length > 0 && contractRoomType === payload.roomType.trim().toLowerCase();
  });

  if (!selectedRoom) {
    return { error: "Room type is not allowed by the signed contract" };
  }

  const contractNightlyRate = resolveNightlyRate(selectedRoom);
  if (contractNightlyRate === null) {
    return { error: "Selected room type has no valid rate in the signed contract" };
  }

  const totalPrice = Number((nights * contractNightlyRate).toFixed(2));

  return {
    contractNightlyRate,
    nights,
    totalPrice
  };
};

router.use(requireAuth);
router.use(async (_req, _res, next) => {
  try {
    await ensureHotelOrganizationsTable();
    await ensureBookingRequestsTable();
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get("/meta/organizations", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const result = await query(
      `SELECT o.id, o.name, o.contact_email
       FROM organizations o
       JOIN hotel_organizations ho ON ho.organization_id = o.id
       WHERE o.is_active = true
         AND ho.hotel_user_id = $1
       ORDER BY o.name ASC`,
      [userId]
    );

    const organizations = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      contactEmail: row.contact_email
    }));

    return res.status(200).json({ organizations });
  } catch (error) {
    return next(error);
  }
});

router.get("/meta/organizations/:organizationId/employees", async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId;
    const userId = req.user?.id;

    const result = await query(
      `SELECT id, full_name, email, role AS department
       FROM portal_users
       WHERE parent_id = $1
         AND portal_type = 'corporate'
         AND is_active = true
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = $1
             AND ho.hotel_user_id = $2
         )
       ORDER BY full_name ASC`,
      [organizationId, userId]
    );

    const employees = result.rows.map((row) => ({
      id: row.id,
      employeeCode: row.email,
      fullName: row.full_name,
      email: row.email,
      department: row.department,
      designation: null
    }));

    return res.status(200).json({ employees });
  } catch (error) {
    return next(error);
  }
});

router.get("/meta/organizations/:organizationId/room-types", async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId;
    const userId = req.user?.id;
    const contract = await getLatestSignedContract(organizationId, String(userId));

    if (!contract) {
      return res.status(200).json({ hasContract: false, contractId: null, roomTypes: [] });
    }

    const roomRates = Array.isArray(contract.contract_data?.roomRates)
      ? contract.contract_data.roomRates
      : [];

    const roomTypes = roomRates
      .map((roomRate: any) => {
        const roomType = typeof roomRate?.roomType === "string" ? roomRate.roomType.trim() : "";
        const nightlyRate = resolveNightlyRate(roomRate);
        return {
          roomType,
          nightlyRate,
          inclusions: typeof roomRate?.inclusions === "string" ? roomRate.inclusions : null
        };
      })
      .filter((item: { roomType: string; nightlyRate: number | null }) => item.roomType.length > 0 && item.nightlyRate !== null)
      .map((item: { roomType: string; nightlyRate: number | null; inclusions: string | null }) => ({
        roomType: item.roomType,
        nightlyRate: Number(item.nightlyRate),
        inclusions: item.inclusions
      }));

    return res.status(200).json({
      hasContract: true,
      contractId: contract.id,
      roomTypes
    });
  } catch (error) {
    return next(error);
  }
});

// Reports & Analytics data for hotel finance reports page
router.get("/reports", async (req, res, next) => {
  try {
    const userId = req.user?.id;

    // Get all bookings for this hotel, grouped by month for revenue trend
    const revenueResult = await query(
      `SELECT
         TO_CHAR(b.check_in_date, 'Mon') AS month_label,
         EXTRACT(MONTH FROM b.check_in_date) AS month_num,
         COALESCE(SUM(b.total_price), 0) AS total_revenue
       FROM hotel_bookings b
       WHERE b.created_by = $1
         AND b.status != 'cancelled'
         AND b.check_in_date >= DATE_TRUNC('year', CURRENT_DATE)
       GROUP BY month_label, month_num
       ORDER BY month_num`,
      [userId]
    );

    const revenueData = revenueResult.rows.map((row) => ({
      month: String(row.month_label).trim(),
      roomRevenue: Math.round(Number(row.total_revenue) * 0.85),
      incidentals: Math.round(Number(row.total_revenue) * 0.15),
      total: Math.round(Number(row.total_revenue))
    }));

    // Room type performance
    const roomResult = await query(
      `SELECT
         b.room_type,
         COUNT(*) AS booking_count,
         COALESCE(SUM(b.nights), 0) AS total_nights,
         COALESCE(AVG(b.price_per_night), 0) AS avg_daily_rate,
         COALESCE(SUM(b.total_price), 0) AS total_revenue
       FROM hotel_bookings b
       WHERE b.created_by = $1
         AND b.status != 'cancelled'
       GROUP BY b.room_type
       ORDER BY total_revenue DESC`,
      [userId]
    );

    const roomPerformance = roomResult.rows.map((row) => ({
      roomType: String(row.room_type),
      occupancy: 0,
      revenue: Math.round(Number(row.total_revenue)),
      avgDailyRate: Math.round(Number(row.avg_daily_rate)),
      nights: Number(row.total_nights)
    }));

    // Corporate clients performance
    const clientsResult = await query(
      `SELECT
         o.name,
         COUNT(*) AS total_bookings,
         COALESCE(SUM(b.total_price), 0) AS total_spent,
         COALESCE(SUM(b.nights), 0) AS occupied_nights,
         COALESCE(AVG(b.total_price), 0) AS avg_booking_value
       FROM hotel_bookings b
       JOIN organizations o ON o.id = b.organization_id
       WHERE b.created_by = $1
         AND b.status != 'cancelled'
       GROUP BY o.name
       ORDER BY total_spent DESC`,
      [userId]
    );

    const corporateClients = clientsResult.rows.map((row) => ({
      name: String(row.name),
      totalBookings: Number(row.total_bookings),
      totalSpent: Math.round(Number(row.total_spent)),
      occupiedNights: Number(row.occupied_nights),
      avgBookingValue: Math.round(Number(row.avg_booking_value)),
      paymentStatus: "paid" as const
    }));

    // KPI summary
    const totalRevenue = revenueData.reduce((s, d) => s + d.total, 0);
    const totalBookings = corporateClients.reduce((s, c) => s + c.totalBookings, 0);
    const avgDailyRate = roomPerformance.length > 0
      ? Math.round(roomPerformance.reduce((s, r) => s + r.avgDailyRate, 0) / roomPerformance.length)
      : 0;

    return res.status(200).json({
      revenueData,
      roomPerformance,
      corporateClients,
      kpi: {
        totalRevenue,
        totalBookings,
        avgDailyRate
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/dashboard/summary", async (req, res, next) => {
  try {
    const userId = req.user?.id;

    // Fetch all bookings for this hotel, including extra bill amounts
    const result = await query(
      `SELECT b.id,
              b.total_price + COALESCE(bills.bills_total, 0) AS total_price,
              b.status, b.check_in_date, b.check_out_date,
              b.created_at, o.name AS organization_name
       FROM hotel_bookings b
       JOIN organizations o ON o.id = b.organization_id
       LEFT JOIN (
         SELECT booking_id, SUM(bill_amount) AS bills_total
         FROM booking_bills
         GROUP BY booking_id
       ) bills ON bills.booking_id = b.id
       WHERE b.created_by = $1`,
      [userId]
    );

    const bookings = result.rows.map((row) => {
      const totalPrice = Number(row.total_price ?? 0);
      const status = String(row.status ?? "").toLowerCase();
      const checkInDate = row.check_in_date ? new Date(row.check_in_date) : null;
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      const organizationName = row.organization_name ? String(row.organization_name) : "Unknown";
      const isActive = ["pending", "confirmed", "checked-in"].includes(status);
      const isCompleted = status === "checked-out";
      const isCancelled = status === "cancelled";

      return {
        totalPrice,
        status,
        checkInDate,
        createdAt,
        organizationName,
        isActive,
        isCompleted,
        isCancelled
      };
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const isInCurrentMonth = (date: Date | null) => {
      if (!date || Number.isNaN(date.getTime())) {
        return false;
      }
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    };

    // Total Revenue = sum of all non-cancelled bookings
    const totalRevenue = bookings
      .filter((b) => !b.isCancelled)
      .reduce((sum, b) => sum + b.totalPrice, 0);

    // Collected = completed (checked-out) bookings
    const totalCollected = bookings
      .filter((b) => b.isCompleted)
      .reduce((sum, b) => sum + b.totalPrice, 0);

    // Pending = active bookings (pending, confirmed, checked-in)
    const totalPending = bookings
      .filter((b) => b.isActive)
      .reduce((sum, b) => sum + b.totalPrice, 0);

    // Active bookings count
    const activeBookings = bookings.filter((b) => b.isActive).length;

    // Weekly booking trend for current month
    const weekLabels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    const bookingTrend = weekLabels.map((label, index) => {
      const startDay = index * 7 + 1;
      const endDay = index === 3 ? 31 : startDay + 6;

      const inWeek = (date: Date | null) => {
        if (!date || Number.isNaN(date.getTime()) || !isInCurrentMonth(date)) {
          return false;
        }
        const day = date.getDate();
        return day >= startDay && day <= endDay;
      };

      const booked = bookings
        .filter((b) => !b.isCancelled && inWeek(b.createdAt))
        .reduce((sum, b) => sum + b.totalPrice, 0);

      const completed = bookings
        .filter((b) => b.isCompleted && inWeek(b.checkInDate))
        .reduce((sum, b) => sum + b.totalPrice, 0);

      return { label, booked, completed };
    });

    // Booking status breakdown
    const statusCounts = {
      pending: 0,
      confirmed: 0,
      checkedIn: 0,
      checkedOut: 0,
      cancelled: 0
    };
    for (const b of bookings) {
      if (b.status === "pending") statusCounts.pending++;
      else if (b.status === "confirmed") statusCounts.confirmed++;
      else if (b.status === "checked-in") statusCounts.checkedIn++;
      else if (b.status === "checked-out") statusCounts.checkedOut++;
      else if (b.status === "cancelled") statusCounts.cancelled++;
    }

    const totalNonCancelled = bookings.filter((b) => !b.isCancelled).length;
    const statusBreakdown = {
      total: totalNonCancelled,
      buckets: [
        {
          label: "Active",
          count: statusCounts.pending + statusCounts.confirmed + statusCounts.checkedIn,
          percentage: totalNonCancelled > 0
            ? ((statusCounts.pending + statusCounts.confirmed + statusCounts.checkedIn) / totalNonCancelled) * 100
            : 0
        },
        {
          label: "Completed",
          count: statusCounts.checkedOut,
          percentage: totalNonCancelled > 0 ? (statusCounts.checkedOut / totalNonCancelled) * 100 : 0
        },
        {
          label: "Cancelled",
          count: statusCounts.cancelled,
          percentage: bookings.length > 0 ? (statusCounts.cancelled / bookings.length) * 100 : 0
        }
      ]
    };

    // Top organizations by revenue
    const orgRevenueMap = new Map<string, number>();
    for (const b of bookings) {
      if (b.isCancelled) continue;
      const current = orgRevenueMap.get(b.organizationName) ?? 0;
      orgRevenueMap.set(b.organizationName, current + b.totalPrice);
    }

    const topOrganizations = Array.from(orgRevenueMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    return res.status(200).json({
      summary: {
        totalRevenue,
        totalCollected,
        totalPending,
        activeBookings
      },
      bookingTrend,
      statusBreakdown,
      topOrganizations
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : null;
    const toDate = typeof req.query.toDate === "string" ? req.query.toDate : null;

    const result = await query(
      `SELECT b.id, b.booking_number, b.organization_id, b.employee_id, b.room_type,
              b.check_in_date, b.check_out_date, b.nights, b.price_per_night,
              b.total_price, b.gst_applicable, b.status, b.invoice_id, b.sent_at,
              o.name AS organization_name,
              COALESCE(e.full_name, b.guest_name) AS employee_name,
              e.email AS employee_code,
              o.credit_period,
              i.invoice_number,
              i.invoice_date,
              i.due_date
       FROM hotel_bookings b
       JOIN organizations o ON o.id = b.organization_id
       LEFT JOIN portal_users e ON e.id = b.employee_id
       LEFT JOIN corporate_invoices i ON i.id = b.invoice_id
       WHERE ($1::text IS NULL OR b.status = $1)
         AND ($2::date IS NULL OR b.check_in_date >= $2::date)
         AND ($3::date IS NULL OR b.check_out_date <= $3::date)
         AND b.created_by = $4
       ORDER BY b.created_at DESC`,
      [status, fromDate, toDate, userId]
    );

    const bookings = result.rows.map((row) => ({
      id: row.id,
      bookingNumber: row.booking_number,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      roomType: row.room_type,
      organizationCreditPeriod: row.credit_period,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      nights: Number(row.nights),
      pricePerNight: Number(row.price_per_night),
      totalPrice: Number(row.total_price),
      gstApplicable: Boolean(row.gst_applicable),
      status: row.status,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      invoiceDueDate: row.due_date,
      sentAt: row.sent_at
    }));

    return res.status(200).json({ bookings });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    const payload = createBookingSchema.parse(req.body);

    const computed = await prepareBookingDetails(payload, String(userId));
    if ("error" in computed) {
      return res.status(400).json({ error: { message: computed.error } });
    }

    const result = await query(
      `INSERT INTO hotel_bookings (
         booking_number,
         organization_id,
         employee_id,
         guest_name,
         room_type,
         check_in_date,
         check_out_date,
         nights,
         price_per_night,
         total_price,
         gst_applicable,
         status,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11, $12, $13)
       RETURNING id, booking_number, organization_id, employee_id, guest_name, room_type,
                 check_in_date, check_out_date, nights, price_per_night,
                 total_price, gst_applicable, status, created_at`,
      [
        payload.bookingNumber.trim().toUpperCase(),
        payload.organizationId,
        payload.employeeId ?? null,
        payload.guestName?.trim() ?? null,
        payload.roomType.trim(),
        payload.checkInDate,
        payload.checkOutDate,
        computed.nights,
        computed.contractNightlyRate,
        computed.totalPrice,
        payload.gstApplicable,
        payload.status,
        userId ?? null
      ]
    );

    const booking = result.rows[0];
    return res.status(201).json({
      booking: {
        id: booking.id,
        bookingNumber: booking.booking_number,
        organizationId: booking.organization_id,
        employeeId: booking.employee_id,
        roomType: booking.room_type,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        nights: Number(booking.nights),
        pricePerNight: Number(booking.price_per_night),
        totalPrice: Number(booking.total_price),
        gstApplicable: Boolean(booking.gst_applicable),
        status: booking.status,
        createdAt: booking.created_at
      }
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Booking number already exists" } });
    }
    return next(error);
  }
});

router.get("/requests", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const status = typeof req.query.status === "string" ? req.query.status : null;

    const result = await query(
      `SELECT br.id,
              br.booking_number,
              br.organization_id,
              br.employee_id,
              br.room_type,
              br.check_in_date,
              br.check_out_date,
              br.nights,
              br.price_per_night,
              br.total_price,
              br.gst_applicable,
              br.status,
              br.rejection_reason,
              br.requested_at,
              br.responded_at,
              br.booking_id,
              o.name AS organization_name,
              o.contact_email AS organization_email,
              e.full_name AS employee_name,
              e.email AS employee_code
       FROM booking_requests br
       JOIN organizations o ON o.id = br.organization_id
       JOIN portal_users e ON e.id = br.employee_id
       WHERE br.hotel_user_id = $1
         AND ($2::text IS NULL OR br.status = $2)
       ORDER BY br.requested_at DESC`,
      [userId, status]
    );

    const requests = result.rows.map((row) => ({
      id: row.id,
      bookingNumber: row.booking_number,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationEmail: row.organization_email,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      roomType: row.room_type,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      nights: Number(row.nights),
      pricePerNight: Number(row.price_per_night),
      totalPrice: Number(row.total_price),
      gstApplicable: Boolean(row.gst_applicable),
      status: row.status,
      rejectionReason: row.rejection_reason,
      requestedAt: row.requested_at,
      respondedAt: row.responded_at,
      bookingId: row.booking_id
    }));

    return res.status(200).json({ requests });
  } catch (error) {
    return next(error);
  }
});

router.post("/requests/:requestId/decision", async (req, res, next) => {
  const client = await pool.connect();

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    const requestId = req.params.requestId;
    const payload = bookingRequestDecisionSchema.parse(req.body);

    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT br.id,
              br.booking_number,
              br.organization_id,
              br.hotel_user_id,
              br.employee_id,
              br.room_type,
              br.check_in_date,
              br.check_out_date,
              br.nights,
              br.price_per_night,
              br.total_price,
              br.gst_applicable,
              br.status,
              br.booking_id,
              o.name AS organization_name,
              o.contact_email AS organization_email,
              e.full_name AS employee_name,
              hp.hotel_name,
              hp.contact_email AS hotel_contact_email,
              u.email AS hotel_user_email
       FROM booking_requests br
       JOIN organizations o ON o.id = br.organization_id
       JOIN portal_users e ON e.id = br.employee_id
       LEFT JOIN hotel_profiles hp ON hp.user_id = br.hotel_user_id
       LEFT JOIN users u ON u.id = br.hotel_user_id
       WHERE br.id = $1
         AND br.hotel_user_id::text = $2
       FOR UPDATE OF br`,
      [requestId, userId]
    );

    if (requestResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { message: "Booking request not found" } });
    }

    const bookingRequest = requestResult.rows[0];
    if (bookingRequest.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: { message: "Booking request already processed" } });
    }

    if (payload.action === "reject") {
      await client.query(
        `UPDATE booking_requests
         SET status = 'rejected',
             rejection_reason = $2,
             responded_at = now(),
             responded_by = $3
         WHERE id = $1`,
        [requestId, normalizeOptional(payload.rejectionReason), userId]
      );

      await client.query("COMMIT");
      return res.status(200).json({ ok: true, status: "rejected" });
    }

    const bookingInsert = await client.query(
      `INSERT INTO hotel_bookings (
         booking_number,
         organization_id,
         employee_id,
         room_type,
         check_in_date,
         check_out_date,
         nights,
         price_per_night,
         total_price,
         gst_applicable,
         status,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10, 'pending', $11)
       RETURNING id, booking_number, organization_id, employee_id, room_type,
                 check_in_date, check_out_date, nights, price_per_night,
                 total_price, gst_applicable, status, created_at`,
      [
        String(bookingRequest.booking_number).trim().toUpperCase(),
        bookingRequest.organization_id,
        bookingRequest.employee_id,
        bookingRequest.room_type,
        bookingRequest.check_in_date,
        bookingRequest.check_out_date,
        Number(bookingRequest.nights),
        Number(bookingRequest.price_per_night),
        Number(bookingRequest.total_price),
        Boolean(bookingRequest.gst_applicable),
        userId
      ]
    );

    const acceptedBooking = bookingInsert.rows[0];

    await client.query(
      `UPDATE booking_requests
       SET status = 'accepted',
           responded_at = now(),
           responded_by = $2,
           booking_id = $3
       WHERE id = $1`,
      [requestId, userId, acceptedBooking.id]
    );

    await client.query("COMMIT");

    const recipientEmail = normalizeOptional(bookingRequest.organization_email)?.toLowerCase();
    if (recipientEmail) {
      try {
        await sendBookingRequestAcceptedOrganizationEmail({
          recipientEmail,
          organizationName: bookingRequest.organization_name,
          hotelName: normalizeOptional(bookingRequest.hotel_name) ?? "Hotel",
          bookingNumber: acceptedBooking.booking_number,
          employeeName: bookingRequest.employee_name,
          roomType: bookingRequest.room_type,
          checkInDate: new Date(bookingRequest.check_in_date).toISOString().slice(0, 10),
          checkOutDate: new Date(bookingRequest.check_out_date).toISOString().slice(0, 10)
        });
      } catch (emailError) {
        console.error("Failed to send booking request acceptance email", emailError);
      }
    }

    return res.status(200).json({
      ok: true,
      status: "accepted",
      booking: {
        id: acceptedBooking.id,
        bookingNumber: acceptedBooking.booking_number,
        organizationId: acceptedBooking.organization_id,
        employeeId: acceptedBooking.employee_id,
        roomType: acceptedBooking.room_type,
        checkInDate: acceptedBooking.check_in_date,
        checkOutDate: acceptedBooking.check_out_date,
        nights: Number(acceptedBooking.nights),
        pricePerNight: Number(acceptedBooking.price_per_night),
        totalPrice: Number(acceptedBooking.total_price),
        gstApplicable: Boolean(acceptedBooking.gst_applicable),
        status: acceptedBooking.status,
        createdAt: acceptedBooking.created_at
      }
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Booking number already exists" } });
    }
    return next(error);
  } finally {
    client.release();
  }
});

router.get("/:bookingId", async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;
    const userId = req.user?.id;
    const result = await query(
      `SELECT b.id, b.booking_number, b.organization_id, b.employee_id, b.room_type,
              b.check_in_date, b.check_out_date, b.nights, b.price_per_night,
              b.total_price, b.gst_applicable, b.status, b.invoice_id, b.sent_at,
              o.name AS organization_name, o.contact_email,
              COALESCE(e.full_name, b.guest_name) AS employee_name,
              e.email AS employee_code,
              i.invoice_number,
              i.invoice_date,
              i.due_date
       FROM hotel_bookings b
       JOIN organizations o ON o.id = b.organization_id
       LEFT JOIN portal_users e ON e.id = b.employee_id
       LEFT JOIN corporate_invoices i ON i.id = b.invoice_id
       WHERE b.id = $1
         AND b.created_by = $2`,
      [bookingId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    const row = result.rows[0];
    return res.status(200).json({
      booking: {
        id: row.id,
        bookingNumber: row.booking_number,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationEmail: row.contact_email,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        roomType: row.room_type,
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        nights: Number(row.nights),
        pricePerNight: Number(row.price_per_night),
        totalPrice: Number(row.total_price),
        gstApplicable: Boolean(row.gst_applicable),
        status: row.status,
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        invoiceDate: row.invoice_date,
        invoiceDueDate: row.due_date,
        sentAt: row.sent_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:bookingId/bills", async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;
    const userId = req.user?.id;
    const result = await query(
      `SELECT id, bill_category, file_name, storage_path, cloud_url, storage_provider,
              cloud_public_id, bill_amount, mime_type, file_size, notes, created_at
       FROM booking_bills
       WHERE booking_id = $1
         AND EXISTS (
           SELECT 1
           FROM hotel_bookings hb
           WHERE hb.id = booking_bills.booking_id
             AND hb.created_by = $2
         )
       ORDER BY created_at DESC`,
      [bookingId, userId]
    );

    const bills = result.rows.map((row) => ({
      id: row.id,
      bookingId,
      billCategory: row.bill_category,
      fileName: row.file_name,
      hasFile: Boolean(row.storage_path || row.cloud_url || row.cloud_public_id),
      fileUrl: row.cloud_url,
      storageProvider: row.storage_provider,
      billAmount: Number(row.bill_amount ?? 0),
      mimeType: row.mime_type,
      fileSize: row.file_size,
      notes: row.notes,
      createdAt: row.created_at
    }));

    return res.status(200).json({ bills });
  } catch (error) {
    return next(error);
  }
});

router.post("/:bookingId/bills", billUpload.single("file"), async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;
    const userId = req.user?.id;
    const payload = bookingBillsSchema.parse(req.body);
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({ error: { message: "Attach a file before saving bill" } });
    }

    if (!isSupabaseStorageConfigured()) {
      return res.status(500).json({ error: { message: "Supabase storage is not configured" } });
    }

    const booking = await query(
      `SELECT id
       FROM hotel_bookings
       WHERE id = $1
         AND created_by = $2`,
      [bookingId, userId]
    );
    if (booking.rowCount === 0) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    const uploadResult = await uploadBillFileToSupabase({
      bookingId,
      originalFileName: uploadedFile.originalname,
      mimeType: uploadedFile.mimetype,
      fileBuffer: uploadedFile.buffer
    });

    const result = await query(
      `INSERT INTO booking_bills (booking_id, bill_category, file_name, storage_path, cloud_url, cloud_public_id, storage_provider, bill_amount, mime_type, file_size, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, bill_category, file_name, storage_path, cloud_url, storage_provider, bill_amount, mime_type, file_size, notes, created_at`,
      [
        bookingId,
        payload.billCategory.trim(),
        uploadedFile.originalname.trim(),
        null,
        null,
        uploadResult.objectPath,
        "supabase",
        payload.billAmount ?? 0,
        uploadedFile.mimetype ?? normalizeOptional(payload.mimeType),
        uploadedFile.size ?? payload.fileSize ?? null,
        normalizeOptional(payload.notes)
      ]
    );

    const row = result.rows[0];
    return res.status(201).json({
      bill: {
        id: row.id,
        bookingId,
        billCategory: row.bill_category,
        fileName: row.file_name,
        hasFile: Boolean(row.storage_path || row.cloud_url || uploadResult.objectPath),
        fileUrl: row.cloud_url,
        storageProvider: row.storage_provider,
        billAmount: Number(row.bill_amount ?? 0),
        mimeType: row.mime_type,
        fileSize: row.file_size,
        notes: row.notes,
        createdAt: row.created_at
      }
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to save bill";
    if (message.toLowerCase().includes("supabase upload failed")) {
      return res.status(502).json({ error: { message } });
    }
    if (message.toLowerCase().includes("bucket") && message.toLowerCase().includes("not")) {
      return res.status(500).json({ error: { message: "Supabase bucket is missing. Create the storage bucket and retry." } });
    }
    return next(error);
  }
});

router.delete("/:bookingId/bills/:billId", async (req, res, next) => {
  try {
    const { bookingId, billId } = req.params;
    const userId = req.user?.id;

    const current = await query(
      `SELECT id, storage_path, cloud_public_id, storage_provider
       FROM booking_bills bb
       JOIN hotel_bookings hb ON hb.id = bb.booking_id
       WHERE bb.id = $1
         AND bb.booking_id = $2
         AND hb.created_by = $3
       LIMIT 1`,
      [billId, bookingId, userId]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ error: { message: "Bill not found" } });
    }

    const bill = current.rows[0];

    const result = await query(
      `DELETE FROM booking_bills WHERE id = $1 AND booking_id = $2 RETURNING id`,
      [billId, bookingId]
    );

    if (bill.storage_path && fs.existsSync(bill.storage_path)) {
      fs.unlinkSync(bill.storage_path);
    }

    if (bill.storage_provider === "supabase") {
      await deleteBillFromSupabase(bill.cloud_public_id);
    } else if (bill.storage_provider === "cloudinary") {
      await deleteBillFileFromCloudinary(bill.cloud_public_id);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/:bookingId/send", async (req, res, next) => {
  const client = await pool.connect();

  try {
    const bookingId = req.params.bookingId;
    const userId = req.user?.id;
    const payload = sendInvoiceSchema.parse(req.body);

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT b.id, b.booking_number, b.organization_id, b.employee_id, b.room_type,
              b.check_in_date, b.check_out_date, b.nights, b.total_price,
              b.invoice_id, b.sent_at,
              o.name AS organization_name, o.contact_email, o.credit_period,
              COALESCE(e.full_name, b.guest_name) AS employee_name, e.email AS employee_code,
              hp.hotel_name,
              hp.location AS hotel_location,
              hp.logo_url AS hotel_logo_url
       FROM hotel_bookings b
       JOIN organizations o ON o.id = b.organization_id
       LEFT JOIN portal_users e ON e.id = b.employee_id
       LEFT JOIN hotel_profiles hp ON hp.user_id::text = b.created_by
       WHERE b.id = $1
         AND b.created_by = $2
       FOR UPDATE OF b`,
      [bookingId, userId]
    );

    if (bookingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    const booking = bookingResult.rows[0];
    const hotelDisplayName =
      normalizeOptional(booking.hotel_name) ??
      normalizeOptional(booking.hotel_location) ??
      "Hotel";

    if (booking.invoice_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: { message: "Invoice already sent for this booking" } });
    }

    const billsResult = await client.query(
      `SELECT id, bill_category, file_name, bill_amount, mime_type, file_size
       FROM booking_bills
       WHERE booking_id = $1
       ORDER BY created_at ASC`,
      [bookingId]
    );

    const payloadBills = payload.bills ?? [];
    const dbBills = billsResult.rows ?? [];
    const extraBillsTotal = dbBills.reduce((sum, bill) => sum + Number(bill.bill_amount ?? 0), 0);
    const invoiceAmount = Number((Number(booking.total_price) + extraBillsTotal).toFixed(2));

    if (dbBills.length === 0 && payloadBills.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: { message: "Attach at least one bill before sending" } });
    }

    const recipientEmail = normalizeOptional(payload.recipientEmail)?.toLowerCase() ?? booking.contact_email;
    if (!recipientEmail) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: { message: "Recipient email not found for organization" } });
    }

    const ccEmail = normalizeOptional(payload.ccEmail)?.toLowerCase() ?? null;
    const invoiceDate = new Date(booking.check_out_date);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + parseCreditPeriodDays(booking.credit_period, 15));

    const invoiceNumber = `INV-${String(booking.booking_number).replace(/[^A-Z0-9]/gi, "").toUpperCase()}-${Date.now()}`;

    const invoiceInsert = await client.query(
      `INSERT INTO corporate_invoices (
         booking_id,
         organization_id,
         employee_id,
         invoice_number,
         invoice_date,
         due_date,
         amount,
         status,
         recipient_email,
         cc_email,
         sent_at
       )
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, 'unpaid', $8, $9, now())
       RETURNING id, invoice_number, invoice_date, due_date, amount, status, sent_at`,
      [
        booking.id,
        booking.organization_id,
        booking.employee_id,
        invoiceNumber,
        invoiceDate.toISOString().slice(0, 10),
        dueDate.toISOString().slice(0, 10),
        invoiceAmount,
        recipientEmail,
        ccEmail
      ]
    );

    const invoice = invoiceInsert.rows[0];

    await client.query(
      `UPDATE hotel_bookings
       SET invoice_id = $2,
           sent_at = now(),
           status = 'checked-out'
       WHERE id = $1`,
      [booking.id, invoice.id]
    );

    await client.query(
      `INSERT INTO employee_stays (
         organization_id,
         booking_id,
         employee_id,
         property_name,
         check_in_date,
         check_out_date,
         nights,
         total_amount,
         status,
         invoice_id
       )
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, 'invoiced', $9)
       ON CONFLICT (booking_id)
       DO UPDATE SET
         employee_id = EXCLUDED.employee_id,
         property_name = EXCLUDED.property_name,
         check_in_date = EXCLUDED.check_in_date,
         check_out_date = EXCLUDED.check_out_date,
         nights = EXCLUDED.nights,
         total_amount = EXCLUDED.total_amount,
         status = EXCLUDED.status,
         invoice_id = EXCLUDED.invoice_id`,
      [
        booking.organization_id,
        booking.id,
        booking.employee_id,
        hotelDisplayName,
        booking.check_in_date,
        booking.check_out_date,
        booking.nights,
        invoiceAmount,
        invoice.id
      ]
    );

    await client.query("COMMIT");

    const portalBase = payload.portalBaseUrl?.replace(/\/$/, "") || "http://localhost:3000";
    const invoicesPortalLink = `${portalBase}/corporate-portal/invoices`;

    await sendCorporateInvoiceCoverLetterEmail({
      recipientEmail,
      ccEmail,
      organizationName: booking.organization_name,
      invoiceNumber: invoice.invoice_number,
      bookingNumber: booking.booking_number,
      guestName: booking.employee_name,
      amount: Number(invoice.amount),
      dueDate: invoice.due_date,
      propertyName: hotelDisplayName,
      bills:
        dbBills.length > 0
          ? dbBills.map((bill) => ({
              category: bill.bill_category,
              fileName: bill.file_name
            }))
          : payloadBills,
      invoicesPortalLink
    });

    return res.status(200).json({
      ok: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        amount: Number(invoice.amount),
        status: invoice.status,
        sentAt: invoice.sent_at
      },
      recipientEmail,
      invoicesPortalLink
    });
  } catch (error: any) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }

    if (error?.code === "42703") {
      return res.status(500).json({ error: { message: "Database schema is outdated. Run npm run db:setup in server and retry." } });
    }

    return next(error);
  } finally {
    client.release();
  }
});

export default router;
