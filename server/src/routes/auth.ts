import { Router } from "express";
import type { Request, Response } from "express";
import type { PoolClient } from "pg";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { pool, query } from "../db.js";
import { authLimiter } from "../middleware/rateLimiters.js";

// Baikalsphere centralized auth token payload
interface BaikalsphereTokenPayload {
  sub: string;
  email: string;
  orgId: string | null;
  platformRole: string;
  modules: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}
import {
  createBillSignedUrl,
  deleteBillFromSupabase,
  isSupabaseStorageConfigured,
  uploadHotelLogoToSupabase
} from "../services/supabaseStorage.js";
import {
  sendBookingRequestHotelNotificationEmail,
  sendHotelCredentialsEmail,
  sendPortalUserCredentialsEmail
} from "../services/mailer.js";

const router = Router();

const DUMMY_PASSWORD_HASH = "$2b$10$N9qo8uLOickgx2ZMRZo5i.ejFrP8T6F8mT7V0pX0rW2fMQ0m6qK2y";
let ensureBookingRequestsTablePromise: Promise<void> | null = null;

// Provision a user in Baikalsphere (for sub-user SSO)
const provisionBaikalsphereUser = async (email: string, fullName: string, passwordHash: string): Promise<string | null> => {
  if (!config.baikalsphereAuthUrl || !config.baikalsphereInternalSecret) return null;
  try {
    const resp = await fetch(`${config.baikalsphereAuthUrl}/api/internal/provision-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": config.baikalsphereInternalSecret,
      },
      body: JSON.stringify({ email, fullName, passwordHash, moduleIds: ["ar"] }),
    });
    if (!resp.ok) {
      console.error("[baikalsphere] Provision failed:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json() as { userId: string };
    return data.userId;
  } catch (err: any) {
    console.error("[baikalsphere] Provision error:", err?.message);
    return null;
  }
};

// Provision/sync an organization to Baikalsphere centralized system
export const provisionBaikalsphereOrganization = async (
  arOrgId: string,
  name: string,
  contactEmail: string,
  corporatePasswordHash: string,
  gst?: string | null,
  createdByArUserId?: string
): Promise<{ organizationId: string; slug: string } | null> => {
  if (!config.baikalsphereAuthUrl || !config.baikalsphereInternalSecret) {
    console.log("[baikalsphere] Skipping org sync - no auth URL or secret configured");
    return null;
  }
  try {
    const resp = await fetch(`${config.baikalsphereAuthUrl}/api/internal/provision-organization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": config.baikalsphereInternalSecret,
      },
      body: JSON.stringify({
        arOrgId,
        name,
        contactEmail,
        corporatePasswordHash,
        gst: gst ?? null,
        industry: "hospitality",
        createdByArUserId,
      }),
    });
    if (!resp.ok) {
      console.error("[baikalsphere] Organization provision failed:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json() as { organizationId: string; slug: string; isNew: boolean };
    console.log(`[baikalsphere] Organization synced: ${arOrgId} -> ${data.organizationId} (${data.isNew ? "created" : "updated"})`);
    return { organizationId: data.organizationId, slug: data.slug };
  } catch (err: any) {
    console.error("[baikalsphere] Organization provision error:", err?.message);
    return null;
  }
};

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(128),
  fullName: z.string().max(120).optional()
}).superRefine((value, ctx) => {
  const password = value.password;
  const checks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];

  if (checks.some((ok) => !ok)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password must include upper, lower, number, and symbol characters"
    });
  }
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128)
});

const adminCreateHotelAccountSchema = z.object({
  email: z.string().email().max(320),
  hotelName: z.string().min(2).max(160),
  fullName: z.string().max(120).optional().nullable()
});

const corporateLoginSchema = z.object({
  username: z.string().min(4).max(320),
  password: z.string().min(1).max(128)
});

const corporateProfileSchema = z.object({
  name: z.string().min(2).max(160),
  registrationNumber: z.string().max(64).optional().nullable(),
  address: z.string().max(320).optional().nullable(),
  contactEmail: z.string().email().max(320).optional().nullable(),
  phone: z.string().max(40).optional().nullable()
});

const hotelProfileSchema = z.object({
  hotelName: z.string().min(2).max(160),
  entityName: z.string().max(200).optional().nullable(),
  gst: z.string().max(64).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  logoUrl: z.string().url().max(2000).optional().nullable(),
  contactEmail: z.string().email().max(320).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  address: z.string().max(400).optional().nullable()
});

const corporateSetPasswordSchema = z.object({
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128)
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Passwords do not match"
    });
  }

  const password = value.newPassword;
  const checks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];

  if (checks.some((ok) => !ok)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["newPassword"],
      message: "Password must include upper, lower, number, and symbol characters"
    });
  }
});

const hotelChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128)
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Passwords do not match"
    });
  }

  const password = value.newPassword;
  const checks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];

  if (checks.some((ok) => !ok)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["newPassword"],
      message: "Password must include upper, lower, number, and symbol characters"
    });
  }
});

const corporateEmployeeSchema = z.object({
  fullName: z.string().min(2).max(160),
  employeeCode: z.string().min(2).max(40),
  email: z.string().email().max(320).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  designation: z.string().max(120).optional().nullable(),
  costCenter: z.string().max(80).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active")
});

const corporateEmployeeListQuerySchema = z.object({
  search: z.string().max(160).optional()
});

const corporateBookingRequestSchema = z.object({
  hotelId: z.string().uuid(),
  bookingNumber: z.string().min(2).max(60),
  employeeId: z.string().uuid(),
  roomType: z.string().min(2).max(120),
  checkInDate: z.string().min(8).max(20),
  checkOutDate: z.string().min(8).max(20),
  gstApplicable: z.boolean().default(false)
});

const portalUserCreateSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email().max(320),
  role: z.enum(["admin", "user"]).default("user"),
  allowedPages: z.array(z.string().max(120)).default([])
});

const portalUserUpdateSchema = z.object({
  fullName: z.string().min(2).max(160).optional(),
  role: z.enum(["admin", "user"]).optional(),
  allowedPages: z.array(z.string().max(120)).optional(),
  isActive: z.boolean().optional()
});

const portalUserChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128)
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Passwords do not match"
    });
  }

  const password = value.newPassword;
  const checks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];

  if (checks.some((ok) => !ok)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["newPassword"],
      message: "Password must include upper, lower, number, and symbol characters"
    });
  }
});

const hotelLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const randomChars = (chars: string, length: number) => {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const selectedIndex = Math.floor(Math.random() * chars.length);
    result += chars[selectedIndex];
  }
  return result;
};

const createGeneratedHotelPassword = () => {
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

const parseTtlMs = (ttl: string) => {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error("Invalid TTL format");
  }
  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return value * multipliers[unit];
};

const refreshCookieSameSite: "none" | "strict" = config.isProd ? "none" : "strict";

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: refreshCookieSameSite,
  path: "/api/auth/refresh",
  maxAge: parseTtlMs(config.refreshTokenTtl)
};

const refreshCookieClearOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: refreshCookieSameSite,
  path: "/api/auth/refresh"
};

const createAccessToken = (userId: string, role: string, subUserMeta?: { isSubUser: boolean; parentId: string; allowedPages: string[] }): string => {
  const token = jwt.sign(
    {
      sub: userId,
      role,
      scope: "hotel-finance",
      ...(subUserMeta ? { isSubUser: true, parentId: subUserMeta.parentId, allowedPages: subUserMeta.allowedPages } : {})
    },
    config.jwtAccessSecret,
    {
      expiresIn: config.accessTokenTtl,
      issuer: "hotel-finance-api",
      audience: "hotel-finance-web"
    } as any
  );
  return token;
};

const createCorporateAccessToken = (organizationId: string, corporateUserId: string, subUserMeta?: { isSubUser: boolean; portalUserId: string; role: string; allowedPages: string[] }): string => {
  const token = jwt.sign(
    {
      sub: organizationId,
      role: subUserMeta?.role || "corporate_portal_user",
      scope: "corporate-portal",
      corporateUserId,
      ...(subUserMeta ? { isSubUser: true, portalUserId: subUserMeta.portalUserId, allowedPages: subUserMeta.allowedPages } : {})
    },
    config.jwtAccessSecret,
    {
      expiresIn: config.accessTokenTtl,
      issuer: "hotel-finance-api",
      audience: "corporate-portal-web"
    } as any
  );

  return token;
};

interface CorporateAccessTokenPayload {
  sub: string;
  role: string;
  scope: string;
  corporateUserId: string;
  isSubUser?: boolean;
  portalUserId?: string;
  allowedPages?: string[];
  bsEmail?: string;
  bsUserId?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

interface HotelAccessTokenPayload {
  sub: string;
  role: string;
  scope: string;
  isSubUser?: boolean;
  parentId?: string;
  allowedPages?: string[];
  bsEmail?: string;
  bsUserId?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

const getCorporatePayload = async (req: Request, res: Response): Promise<CorporateAccessTokenPayload | null> => {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  const token = header && header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : queryToken;

  if (!token) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return null;
  }

  try {
    const payload = jwt.verify(token, config.jwtAccessSecret, {
      issuer: "hotel-finance-api",
      audience: "corporate-portal-web"
    }) as CorporateAccessTokenPayload;

    const validCorporateRoles = ["corporate_portal_user", "admin", "user"];
    if (payload.scope !== "corporate-portal" || !validCorporateRoles.includes(payload.role)) {
      res.status(403).json({ error: { message: "Forbidden" } });
      return null;
    }

    return payload;
  } catch {
    // Not a legacy corporate token ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â try Baikalsphere SSO
  }

  // Try Baikalsphere centralized auth token
  if (config.baikalsphereJwtSecret) {
    try {
      const bsPayload = jwt.verify(token, config.baikalsphereJwtSecret, {
        issuer: "baikalsphere-auth",
        audience: "baikalsphere",
      }) as BaikalsphereTokenPayload;

      if (!bsPayload.modules || !bsPayload.modules.includes("ar")) {
        res.status(403).json({ error: { message: "No access to AR module" } });
        return null;
      }

      // Look up AR organization mapping by Baikalsphere user OR organization claim.
      const orgResult = await query(
        `SELECT id, corporate_user_id
         FROM organizations
         WHERE baikalsphere_user_id = $1
            OR (
              $2::text IS NOT NULL AND (
                baikalsphere_organization_id::text = $2
                OR lower(contact_email::text) = lower($3)
              )
            )
         LIMIT 1`,
        [bsPayload.sub, bsPayload.orgId ?? null, bsPayload.email]
      );

      if (orgResult.rowCount! > 0) {
        const org = orgResult.rows[0];
        return {
          sub: org.id,
          role: "corporate_portal_user",
          scope: "corporate-portal",
          corporateUserId: org.corporate_user_id,
          bsEmail: bsPayload.email,
          bsUserId: bsPayload.sub,
          iat: bsPayload.iat,
          exp: bsPayload.exp,
          iss: bsPayload.iss,
          aud: bsPayload.aud,
        };
      }

      // Check if this Baikalsphere user is a corporate sub-user
      const corpPortalUser = await query(
        `SELECT id, parent_id, role, allowed_pages FROM portal_users
         WHERE baikalsphere_user_id = $1 AND portal_type = 'corporate'`,
        [bsPayload.sub]
      );

      if (corpPortalUser.rowCount! > 0) {
        const pu = corpPortalUser.rows[0];
        return {
          sub: pu.parent_id,
          role: pu.role,
          scope: "corporate-portal",
          corporateUserId: pu.parent_id,
          isSubUser: true,
          portalUserId: pu.id,
          allowedPages: pu.allowed_pages || [],
          bsEmail: bsPayload.email,
          bsUserId: bsPayload.sub,
          iat: bsPayload.iat,
          exp: bsPayload.exp,
          iss: bsPayload.iss,
          aud: bsPayload.aud,
        };
      }

      res.status(403).json({ error: { message: "No corporate organization linked to this account" } });
      return null;
    } catch {
      // Not a valid Baikalsphere token either
    }
  }

  res.status(401).json({ error: { message: "Unauthorized" } });
  return null;
};

const getHotelPayload = async (req: Request, res: Response): Promise<HotelAccessTokenPayload | null> => {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return null;
  }

  // Try Baikalsphere centralized auth token first
  if (config.baikalsphereJwtSecret) {
    try {
      const bsPayload = jwt.verify(token, config.baikalsphereJwtSecret, {
        issuer: "baikalsphere-auth",
        audience: "baikalsphere",
      }) as BaikalsphereTokenPayload;

      if (!bsPayload.modules || !bsPayload.modules.includes("ar")) {
        res.status(403).json({ error: { message: "No access to AR module" } });
        return null;
      }

      // Resolve Baikalsphere UUID â†’ AR user ID via mapping
      const mappedUser = await query(
        `SELECT id FROM users WHERE baikalsphere_user_id = $1`,
        [bsPayload.sub]
      );

      if (mappedUser.rowCount! > 0) {
        return {
          sub: mappedUser.rows[0].id,
          role: bsPayload.platformRole === "superadmin" ? "admin" : "hotel_finance_user",
          scope: "hotel-finance",
          bsEmail: bsPayload.email,
          bsUserId: bsPayload.sub,
          iat: bsPayload.iat,
          exp: bsPayload.exp,
          iss: bsPayload.iss,
          aud: bsPayload.aud,
        };
      }

      // Check if this Baikalsphere user is a hotel sub-user
      const portalUser = await query(
        `SELECT id, parent_id, role, allowed_pages FROM portal_users
         WHERE baikalsphere_user_id = $1 AND portal_type = 'hotel_finance'`,
        [bsPayload.sub]
      );

      if (portalUser.rowCount! > 0) {
        const pu = portalUser.rows[0];
        return {
          sub: pu.parent_id,
          role: pu.role,
          scope: "hotel-finance",
          isSubUser: true,
          parentId: pu.parent_id,
          allowedPages: pu.allowed_pages || [],
          bsEmail: bsPayload.email,
          bsUserId: bsPayload.sub,
          iat: bsPayload.iat,
          exp: bsPayload.exp,
          iss: bsPayload.iss,
          aud: bsPayload.aud,
        };
      }

      if (bsPayload.orgId) {
        res.status(403).json({ error: { message: "Organization users must access the corporate portal" } });
        return null;
      }

      // Fallback: use Baikalsphere UUID directly (for auto-provisioning)
      return {
        sub: bsPayload.sub,
        role: bsPayload.platformRole === "superadmin" ? "admin" : "hotel_finance_user",
        scope: "hotel-finance",
        bsEmail: bsPayload.email,
        bsUserId: bsPayload.sub,
        iat: bsPayload.iat,
        exp: bsPayload.exp,
        iss: bsPayload.iss,
        aud: bsPayload.aud,
      };
    } catch {
      // Not a Baikalsphere token, try legacy
    }
  }

  try {
    const payload = jwt.verify(token, config.jwtAccessSecret, {
      issuer: "hotel-finance-api",
      audience: "hotel-finance-web"
    }) as HotelAccessTokenPayload;

    if (payload.scope !== "hotel-finance") {
      res.status(403).json({ error: { message: "Forbidden" } });
      return null;
    }

    return payload;
  } catch {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return null;
  }
};

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

const getLatestSignedContractForCorporateHotel = async (organizationId: string, hotelUserId: string) => {
  const contractResult = await query(
    `SELECT id, contract_data
     FROM organization_contracts
     WHERE organization_id = $1
       AND hotel_user_id = $2
       AND status = 'signed'
     ORDER BY signed_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [organizationId, hotelUserId]
  );

  if (contractResult.rowCount === 0) {
    return null;
  }

  return contractResult.rows[0];
};

const getSupabaseObjectPathFromUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    const decodedPath = decodeURIComponent(parsed.pathname);

    const storagePrefixMatch = decodedPath.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/[^/]+\/(.+)$/i);
    if (storagePrefixMatch?.[1]) {
      return storagePrefixMatch[1].replace(/^\/+/, "");
    }

    const bucketPathPrefix = `/${config.supabaseStorageBucket}/`;
    const bucketPathIndex = decodedPath.indexOf(bucketPathPrefix);
    if (bucketPathIndex >= 0) {
      return decodedPath.slice(bucketPathIndex + bucketPathPrefix.length).replace(/^\/+/, "");
    }

    return null;
  } catch {
    return null;
  }
};

const resolveStoredLogoObjectPath = (storedValue?: string | null) => {
  const normalized = normalizeOptional(storedValue);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return getSupabaseObjectPathFromUrl(normalized);
  }

  const trimmed = normalized.replace(/^\/+/, "");
  const bucketPrefix = `${config.supabaseStorageBucket}/`;
  if (trimmed.startsWith(bucketPrefix)) {
    return trimmed.slice(bucketPrefix.length).replace(/^\/+/, "");
  }

  return trimmed;
};

const resolveHotelLogoUrl = (hotelUserId: string, storedValue?: string | null) => {
  const normalized = normalizeOptional(storedValue);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return `/api/auth/hotel/logo/${encodeURIComponent(hotelUserId)}/file`;
};

const createRefreshToken = async (userId: string, userAgent?: string, ipAddress?: string) => {
  const token = crypto.randomBytes(64).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + parseTtlMs(config.refreshTokenTtl));

  const result = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, tokenHash, expiresAt, userAgent ?? null, ipAddress ?? null]
  );

  return { token, id: result.rows[0].id as string, expiresAt };
};

const revokeRefreshToken = async (tokenHash: string, replacedBy?: string) => {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now(), replaced_by = $2
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash, replacedBy ?? null]
  );
};

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, fullName } = registerSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    const passwordHash = await bcrypt.hash(password, config.bcryptCost);

    const result = await query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [normalizedEmail, passwordHash, fullName ?? null]
    );

    const user = result.rows[0];

    await query(
      `INSERT INTO hotel_profiles (user_id, hotel_name, contact_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET
         hotel_name = COALESCE(hotel_profiles.hotel_name, EXCLUDED.hotel_name),
         contact_email = COALESCE(hotel_profiles.contact_email, EXCLUDED.contact_email)`,
      [
        user.id,
        fullName?.trim() || normalizedEmail.split("@")[0],
        normalizedEmail
      ]
    );

    const accessToken = createAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(user.id, req.get("user-agent"), req.ip);

    res.cookie("refresh_token", refreshToken.token, refreshCookieOptions);

    return res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role },
      accessToken
    });
  } catch (error: any) {
    console.error("[mailer] Failed to send hotel credentials email", {
      code: error?.code,
      responseCode: error?.responseCode,
      command: error?.command,
      response: error?.response,
      message: error?.message,
      stack: error?.stack
    });

    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Email already registered" } });
    }
    return next(error);
  }
});

router.post("/admin/hotel-accounts", async (req, res, next) => {
  try {
    const parsed = adminCreateHotelAccountSchema.parse(req.body);
    const normalizedEmail = parsed.email.trim().toLowerCase();
    const normalizedHotelName = parsed.hotelName.trim();
    const normalizedFullName = normalizeOptional(parsed.fullName);

    const generatedPassword = createGeneratedHotelPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, config.bcryptCost);
    const client: PoolClient = await pool.connect();

    try {
      await client.query("BEGIN");

      const createdUserResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role`,
        [normalizedEmail, passwordHash, normalizedFullName, "hotel_finance_user"]
      );

      const createdUser = createdUserResult.rows[0] as {
        id: string;
        email: string;
        role: string;
      };

      await client.query(
        `INSERT INTO hotel_profiles (user_id, hotel_name, contact_email)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id)
         DO UPDATE SET
           hotel_name = EXCLUDED.hotel_name,
           contact_email = EXCLUDED.contact_email`,
        [createdUser.id, normalizedHotelName, normalizedEmail]
      );

      await sendHotelCredentialsEmail({
        recipientEmail: normalizedEmail,
        hotelName: normalizedHotelName,
        userId: normalizedEmail,
        password: generatedPassword
      });

      await client.query("COMMIT");

      // Provision user to Baikalsphere centralized auth system
      const baikalsphereUserId = await provisionBaikalsphereUser(
        normalizedEmail,
        normalizedFullName || normalizedEmail,
        passwordHash
      );

      if (baikalsphereUserId) {
        console.log(`[admin/hotel-accounts] User ${normalizedEmail} provisioned to Baikalsphere: ${baikalsphereUserId}`);
      } else {
        console.warn(`[admin/hotel-accounts] Failed to provision user ${normalizedEmail} to Baikalsphere`);
      }

      return res.status(201).json({
        account: {
          id: createdUser.id,
          email: createdUser.email,
          role: createdUser.role,
          hotelName: normalizedHotelName,
          baikalsphereUserId
        },
        message: "Hotel account created, linked to Baikalsphere, and credentials sent to registered email"
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[mailer] Failed to send hotel credentials email", {
      code: error?.code,
      responseCode: error?.responseCode,
      command: error?.command,
      response: error?.response,
      message: error?.message,
      stack: error?.stack
    });

    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Email already registered" } });
    }

    const mailConfigError =
      typeof error?.message === "string" &&
      (
        error.message.includes("Email service is not configured") ||
        error.message.includes("SMTP email service is not configured") ||
        error.message.includes("Resend email service is not configured") ||
        error.message.includes("Resend send failed")
      );

    if (
      error?.code === "EAUTH" ||
      error?.code === "ETIMEDOUT" ||
      error?.code === "ESOCKET" ||
      error?.code === "ECONNECTION" ||
      error?.code === "ERESEND" ||
      mailConfigError
    ) {
      const details = [error?.code, error?.responseCode].filter(Boolean).join("/");
      return res.status(502).json({ error: { message: `Failed to send credentials email. Check mail provider configuration on server.${details ? ` (${details})` : ""}` } });
    }

    return next(error);
  }
});

// ── Session tracking ──────────────────────────────────────────
// POST /api/auth/session/start  — called once on app mount
router.post("/session/start", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ error: { message: "Unauthorized" } });

    let userId: string | null = null;
    let userType: "hotel" | "corporate" = "hotel";
    let displayName: string | null = null;

    // Try Baikalsphere token first
    if (config.baikalsphereJwtSecret) {
      try {
        const bsPayload = jwt.verify(token, config.baikalsphereJwtSecret, {
          issuer: "baikalsphere-auth",
          audience: "baikalsphere",
        }) as BaikalsphereTokenPayload;

        if (bsPayload.orgId) {
          userType = "corporate";
          const orgRow = await query(`SELECT id, name FROM organizations WHERE baikalsphere_organization_id::text = $1 OR lower(contact_email::text) = lower($2) LIMIT 1`, [bsPayload.orgId, bsPayload.email]);
          userId = orgRow.rows[0]?.id ?? bsPayload.orgId;
          displayName = orgRow.rows[0]?.name ?? bsPayload.email;
        } else {
          userType = "hotel";
          const userRow = await query(`SELECT u.id, COALESCE(hp.hotel_name, u.email) AS name FROM users u LEFT JOIN hotel_profiles hp ON hp.user_id = u.id WHERE u.baikalsphere_user_id = $1 LIMIT 1`, [bsPayload.sub]);
          userId = userRow.rows[0]?.id ?? bsPayload.sub;
          displayName = userRow.rows[0]?.name ?? bsPayload.email;
        }
      } catch { /* fall through */ }
    }

    // Try legacy hotel token
    if (!userId) {
      try {
        const payload = jwt.verify(token, config.jwtAccessSecret, { issuer: "hotel-finance-api", audience: "hotel-finance-web" }) as { sub: string; scope: string };
        if (payload.scope === "hotel-finance") {
          userType = "hotel";
          const userRow = await query(`SELECT u.id, COALESCE(hp.hotel_name, u.email) AS name FROM users u LEFT JOIN hotel_profiles hp ON hp.user_id = u.id WHERE u.id = $1 LIMIT 1`, [payload.sub]);
          userId = payload.sub;
          displayName = userRow.rows[0]?.name ?? null;
        }
      } catch { /* fall through */ }
    }

    // Try legacy corporate token
    if (!userId) {
      try {
        const payload = jwt.verify(token, config.jwtAccessSecret, { issuer: "hotel-finance-api", audience: "corporate-portal-web" }) as { sub: string; scope: string; corporateUserId?: string };
        if (payload.scope === "corporate-portal") {
          userType = "corporate";
          const orgRow = await query(`SELECT id, name FROM organizations WHERE id = $1 OR corporate_user_id = $1 LIMIT 1`, [payload.sub]);
          userId = orgRow.rows[0]?.id ?? payload.sub;
          displayName = orgRow.rows[0]?.name ?? null;
        }
      } catch { /* fall through */ }
    }

    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const result = await query(
      `INSERT INTO user_sessions (user_id, user_type, display_name) VALUES ($1, $2, $3) RETURNING id`,
      [userId, userType, displayName]
    );
    return res.json({ sessionId: result.rows[0].id });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/session/ping  — called every 30s while tab is open
router.post("/session/ping", async (req, res, next) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: { message: "sessionId required" } });
    await query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = $1 AND ended_at IS NULL`, [sessionId]);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// POST /api/auth/session/end  — called on logout / tab close
router.post("/session/end", async (req, res, next) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: { message: "sessionId required" } });
    await query(
      `UPDATE user_sessions
       SET ended_at = NOW(),
           duration_seconds = GREATEST(1, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
       WHERE id = $1 AND ended_at IS NULL`,
      [sessionId]
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/hotel-activity", async (_req, res, next) => {
  try {
    const hotelsResult = await query(
      `SELECT
         u.id,
         u.email,
         u.full_name,
         u.is_active,
         u.last_login_at,
         u.created_at,
         u.failed_login_attempts,
         u.locked_until,
         hp.hotel_name,
         hp.location,
         -- accurate session count from user_sessions
         (SELECT COUNT(*)::int FROM user_sessions s WHERE s.user_id = u.id::text AND s.ended_at IS NULL AND s.last_seen_at > NOW() - INTERVAL '2 minutes') AS active_sessions,
         (SELECT COUNT(*)::int FROM user_sessions s WHERE s.user_id = u.id::text) AS total_sessions,
         -- accurate total seconds: ended sessions use duration_seconds; active sessions use elapsed so far
         (SELECT COALESCE(
           SUM(CASE
             WHEN s.ended_at IS NOT NULL THEN s.duration_seconds
             WHEN s.last_seen_at > NOW() - INTERVAL '2 minutes' THEN GREATEST(1, EXTRACT(EPOCH FROM (NOW() - s.started_at))::int)
             ELSE GREATEST(1, EXTRACT(EPOCH FROM (s.last_seen_at - s.started_at))::int)
           END), 0
         )::int FROM user_sessions s WHERE s.user_id = u.id::text) AS total_seconds
       FROM users u
       LEFT JOIN hotel_profiles hp ON hp.user_id = u.id
       WHERE u.role = 'hotel_finance_user'
       ORDER BY u.last_login_at DESC NULLS LAST`,
      []
    );

    const orgsResult = await query(
      `SELECT
         o.id,
         o.name,
         o.corporate_user_id,
         o.contact_email,
         o.is_active,
         o.last_login_at,
         o.created_at,
         o.status,
         (SELECT COUNT(*)::int FROM user_sessions s WHERE s.user_id = o.id AND s.ended_at IS NULL AND s.last_seen_at > NOW() - INTERVAL '2 minutes') AS active_sessions,
         (SELECT COUNT(*)::int FROM user_sessions s WHERE s.user_id = o.id) AS total_sessions,
         (SELECT COALESCE(
           SUM(CASE
             WHEN s.ended_at IS NOT NULL THEN s.duration_seconds
             WHEN s.last_seen_at > NOW() - INTERVAL '2 minutes' THEN GREATEST(1, EXTRACT(EPOCH FROM (NOW() - s.started_at))::int)
             ELSE GREATEST(1, EXTRACT(EPOCH FROM (s.last_seen_at - s.started_at))::int)
           END), 0
         )::int FROM user_sessions s WHERE s.user_id = o.id) AS total_seconds
       FROM organizations o
       ORDER BY o.last_login_at DESC NULLS LAST`,
      []
    );

    // Daily breakdown from user_sessions (last 90 days) — both hotel and corporate
    const dailyResult = await query(
      `SELECT
         s.user_id,
         s.user_type,
         s.display_name,
         (s.started_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
         COUNT(*)::int AS sessions,
         COALESCE(SUM(CASE
           WHEN s.ended_at IS NOT NULL THEN s.duration_seconds
           ELSE GREATEST(1, EXTRACT(EPOCH FROM (s.last_seen_at - s.started_at))::int)
         END), 0)::int AS total_seconds
       FROM user_sessions s
       WHERE s.started_at >= NOW() - INTERVAL '90 days'
       GROUP BY s.user_id, s.user_type, s.display_name, day
       ORDER BY day DESC, total_seconds DESC`,
      []
    );

    return res.json({ accounts: hotelsResult.rows, organizations: orgsResult.rows, daily: dailyResult.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    // First try main users table (admin)
    const userResult = await query(
      `SELECT id, email, role, password_hash, is_active, failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    // Check portal_users table for sub-users
    const portalUserResult = await query(
      `SELECT pu.id, pu.email, pu.password_hash, pu.role, pu.parent_id, pu.full_name,
              pu.allowed_pages, pu.is_active, pu.portal_type
       FROM portal_users pu
       WHERE pu.email = $1 AND pu.portal_type = 'hotel_finance'`,
      [normalizedEmail]
    );

    if (userResult.rowCount === 0 && portalUserResult.rowCount === 0) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    // Sub-user login
    if ((portalUserResult.rowCount ?? 0) > 0) {
      const portalUser = portalUserResult.rows[0];

      if (!portalUser.is_active) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        return res.status(403).json({ error: { message: "Account disabled" } });
      }

      const passwordOk = await bcrypt.compare(password, portalUser.password_hash);
      if (!passwordOk) {
        return res.status(401).json({ error: { message: "Invalid credentials" } });
      }

      const accessToken = createAccessToken(portalUser.parent_id, portalUser.role, {
        isSubUser: true,
        parentId: portalUser.parent_id,
        allowedPages: portalUser.allowed_pages || []
      });

      return res.status(200).json({
        user: {
          id: portalUser.parent_id,
          email: portalUser.email,
          role: portalUser.role,
          isSubUser: true,
          portalUserId: portalUser.id,
          fullName: portalUser.full_name,
          allowedPages: portalUser.allowed_pages || []
        },
        accessToken
      });
    }

    // Admin user login (existing flow)
    const user = userResult.rows[0];

    if (!user.is_active) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(403).json({ error: { message: "Account disabled" } });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: { message: "Account locked. Try again later." } });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      const attempts = Number(user.failed_login_attempts) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await query(
        `UPDATE users
         SET failed_login_attempts = $2, locked_until = $3
         WHERE id = $1`,
        [user.id, attempts, lockUntil]
      );

      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    await query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now()
       WHERE id = $1`,
      [user.id]
    );

    await query(
      `INSERT INTO hotel_profiles (user_id, hotel_name, contact_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET
         contact_email = COALESCE(hotel_profiles.contact_email, EXCLUDED.contact_email)`,
      [
        user.id,
        normalizedEmail.split("@")[0],
        normalizedEmail
      ]
    );

    const accessToken = createAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(user.id, req.get("user-agent"), req.ip);

    res.cookie("refresh_token", refreshToken.token, refreshCookieOptions);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: 'admin',
        isSubUser: false,
        allowedPages: []
      },
      accessToken
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/refresh", authLimiter, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (!refreshToken) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const tokenResult = await query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rowCount === 0) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    const tokenRow = tokenResult.rows[0];
    const isExpired = new Date(tokenRow.expires_at) <= new Date();

    if (tokenRow.revoked_at || isExpired) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    if (!tokenRow.is_active) {
      return res.status(403).json({ error: { message: "Account disabled" } });
    }

    const newRefresh = await createRefreshToken(
      tokenRow.user_id,
      req.get("user-agent"),
      req.ip
    );

    await revokeRefreshToken(tokenHash, newRefresh.id);

    const accessToken = createAccessToken(tokenRow.user_id, tokenRow.role);

    res.cookie("refresh_token", newRefresh.token, refreshCookieOptions);

    return res.status(200).json({ accessToken });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (refreshToken) {
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      await revokeRefreshToken(tokenHash);
    }

    res.clearCookie("refresh_token", refreshCookieClearOptions);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/hotel/logo/:hotelUserId/file", async (req, res, next) => {
  try {
    const hotelUserId = req.params.hotelUserId;
    const result = await query(
      `SELECT logo_url
       FROM hotel_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [hotelUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Hotel logo not found" } });
    }

    const logoValue = normalizeOptional(result.rows[0].logo_url);
    if (!logoValue) {
      return res.status(404).json({ error: { message: "Hotel logo not found" } });
    }

    const objectPath = resolveStoredLogoObjectPath(logoValue);
    if (!objectPath) {
      return res.redirect(302, logoValue);
    }

    const signedUrl = await createBillSignedUrl(objectPath, 60);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.redirect(302, signedUrl);
  } catch (error) {
    return next(error);
  }
});

router.get("/resolve-portal", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header && header.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : null;

    if (!token || !config.baikalsphereJwtSecret) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    let bsPayload: BaikalsphereTokenPayload;
    try {
      bsPayload = jwt.verify(token, config.baikalsphereJwtSecret, {
        issuer: "baikalsphere-auth",
        audience: "baikalsphere",
      }) as BaikalsphereTokenPayload;
    } catch {
      return res.status(401).json({ error: { message: "Invalid token" } });
    }

    if (!bsPayload.modules || !bsPayload.modules.includes("ar")) {
      return res.status(403).json({ error: { message: "No access to AR module" } });
    }

    // Check organizations FIRST (org users take priority over auto-provisioned hotel accounts).
    // Match by Baikalsphere user mapping OR organization claim for robust RBAC behavior.
    const orgResult = await query(
      `SELECT id
       FROM organizations
       WHERE baikalsphere_user_id = $1
          OR (
            $2::text IS NOT NULL AND (
              baikalsphere_organization_id::text = $2
              OR lower(contact_email::text) = lower($3)
            )
          )
       LIMIT 1`,
      [bsPayload.sub, bsPayload.orgId ?? null, bsPayload.email]
    );
    if (orgResult.rowCount! > 0) {
      return res.json({ portal: "corporate-portal" });
    }

    if (bsPayload.orgId) {
      return res.json({ portal: "corporate-portal" });
    }

    // Then check hotel users
    const hotelResult = await query(
      `SELECT id FROM users WHERE baikalsphere_user_id = $1`,
      [bsPayload.sub]
    );
    if (hotelResult.rowCount! > 0) {
      return res.json({ portal: "hotel-finance" });
    }

    // Check portal_users (sub-users provisioned into Baikalsphere)
    const portalUserResult = await query(
      `SELECT id, portal_type FROM portal_users WHERE baikalsphere_user_id = $1`,
      [bsPayload.sub]
    );
    if (portalUserResult.rowCount! > 0) {
      const pu = portalUserResult.rows[0];
      return res.json({ portal: pu.portal_type === "corporate" ? "corporate-portal" : "hotel-finance" });
    }

    // New user — default to hotel-finance (auto-provisioned on /hotel/me)
    return res.json({ portal: "hotel-finance" });
  } catch (error) {
    return next(error);
  }
});

router.get("/hotel/me", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) {
      return;
    }

    const result = await query(
      `SELECT u.id, u.email, u.role,
              hp.hotel_name, hp.entity_name, hp.gst, hp.location, hp.logo_url,
              hp.contact_email, hp.contact_phone, hp.address
       FROM users u
       LEFT JOIN hotel_profiles hp ON hp.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [payload.sub]
    );

    if (result.rowCount === 0) {
      // Auto-provision: Baikalsphere user has AR module but no AR account yet
      if (payload.bsEmail && payload.bsUserId) {
        // Don't auto-provision hotel accounts for organization users
        const isOrgUser = await query(
          `SELECT id FROM organizations WHERE baikalsphere_user_id = $1`,
          [payload.bsUserId]
        );
        if (isOrgUser.rowCount! > 0) {
          return res.status(403).json({ error: { message: "This account belongs to a corporate organization. Use the corporate portal." } });
        }

        const newUser = await query(
          `INSERT INTO users (email, password_hash, role, baikalsphere_user_id)
           VALUES ($1, $2, 'hotel_finance_user', $3)
           ON CONFLICT (email) DO UPDATE SET baikalsphere_user_id = EXCLUDED.baikalsphere_user_id
           RETURNING id, email, role`,
          [payload.bsEmail, DUMMY_PASSWORD_HASH, payload.bsUserId]
        );
        const userId = newUser.rows[0].id;

        await query(
          `INSERT INTO hotel_profiles (user_id, hotel_name, contact_email)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, `${payload.bsEmail.split("@")[0]}'s Hotel`, payload.bsEmail]
        );

        await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);

        // Update payload.sub so downstream code uses the new AR user ID
        payload.sub = userId;

        const reprofile = await query(
          `SELECT u.id, u.email, u.role,
                  hp.hotel_name, hp.entity_name, hp.gst, hp.location, hp.logo_url,
                  hp.contact_email, hp.contact_phone, hp.address
           FROM users u
           LEFT JOIN hotel_profiles hp ON hp.user_id = u.id
           WHERE u.id = $1
           LIMIT 1`,
          [userId]
        );

        const r = reprofile.rows[0];
        return res.status(200).json({
          user: { id: r.id, email: r.email, role: "admin", isSubUser: false, allowedPages: [] },
          profile: {
            hotelName: r.hotel_name,
            entityName: r.entity_name,
            gst: r.gst,
            location: r.location,
            logoUrl: resolveHotelLogoUrl(r.id, r.logo_url),
            contactEmail: r.contact_email,
            contactPhone: r.contact_phone,
            address: r.address
          }
        });
      }

      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    const row = result.rows[0];

    // Update last_login_at for SSO users (no explicit /login call in SSO flow)
    if (payload.bsUserId) {
      await query(
        `UPDATE users SET last_login_at = NOW() WHERE id = $1 AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '30 minutes')`,
        [row.id]
      );
    }

    // If sub-user, add sub-user info
    if (payload.isSubUser && payload.parentId) {
      let matchedUser: any = null;

      // For Baikalsphere SSO sub-users, match by baikalsphere_user_id
      if (payload.bsUserId) {
        const bsMatch = await query(
          `SELECT id, full_name, email, role, allowed_pages FROM portal_users
           WHERE baikalsphere_user_id = $1 AND portal_type = 'hotel_finance'`,
          [payload.bsUserId]
        );
        if (bsMatch.rowCount! > 0) {
          matchedUser = bsMatch.rows[0];
        }
      }

      // Fallback for legacy tokens: match by parent + allowed_pages
      if (!matchedUser) {
        const puResult2 = await query(
          `SELECT id, full_name, email, role, allowed_pages FROM portal_users
           WHERE parent_id = $1 AND portal_type = 'hotel_finance'`,
          [payload.sub]
        );
        matchedUser = puResult2.rows.find((pu: any) =>
          JSON.stringify(pu.allowed_pages) === JSON.stringify(payload.allowedPages)
        ) || puResult2.rows[0];
      }

      return res.status(200).json({
        user: {
          id: row.id,
          email: matchedUser?.email || row.email,
          role: matchedUser?.role || 'user',
          isSubUser: true,
          portalUserId: matchedUser?.id,
          fullName: matchedUser?.full_name,
          allowedPages: matchedUser?.allowed_pages || payload.allowedPages || []
        },
        profile: {
          hotelName: row.hotel_name,
          entityName: row.entity_name,
          gst: row.gst,
          location: row.location,
          logoUrl: resolveHotelLogoUrl(row.id, row.logo_url),
          contactEmail: row.contact_email,
          contactPhone: row.contact_phone,
          address: row.address
        }
      });
    }

    return res.status(200).json({
      user: {
        id: row.id,
        email: row.email,
        role: 'admin',
        isSubUser: false,
        allowedPages: []
      },
      profile: {
        hotelName: row.hotel_name,
        entityName: row.entity_name,
        gst: row.gst,
        location: row.location,
        logoUrl: resolveHotelLogoUrl(row.id, row.logo_url),
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        address: row.address
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/hotel/profile/logo", hotelLogoUpload.single("file"), async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) {
      return;
    }

    if (!isSupabaseStorageConfigured()) {
      return res.status(500).json({ error: { message: "Supabase storage is not configured" } });
    }

    const uploadedFile = req.file;
    if (!uploadedFile) {
      return res.status(400).json({ error: { message: "Attach an image before uploading" } });
    }

    if (!uploadedFile.mimetype?.toLowerCase().startsWith("image/")) {
      return res.status(400).json({ error: { message: "Only image files are allowed for logo upload" } });
    }

    const currentResult = await query(
      `SELECT logo_url
       FROM hotel_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [payload.sub]
    );

    const uploaded = await uploadHotelLogoToSupabase({
      userId: payload.sub,
      originalFileName: uploadedFile.originalname,
      mimeType: uploadedFile.mimetype,
      fileBuffer: uploadedFile.buffer
    });

    await query(
      `INSERT INTO hotel_profiles (user_id, logo_url)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET logo_url = EXCLUDED.logo_url`,
      [payload.sub, uploaded.objectPath]
    );

    const oldLogoObjectPath = resolveStoredLogoObjectPath(currentResult.rows[0]?.logo_url ?? null);
    if (oldLogoObjectPath && oldLogoObjectPath !== uploaded.objectPath) {
      await deleteBillFromSupabase(oldLogoObjectPath).catch(() => undefined);
    }

    const profileResult = await query(
      `SELECT u.id, u.email, u.role,
              hp.hotel_name, hp.gst, hp.location, hp.logo_url,
              hp.contact_email, hp.contact_phone, hp.address
       FROM users u
       LEFT JOIN hotel_profiles hp ON hp.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [payload.sub]
    );

    const row = profileResult.rows[0];
    return res.status(200).json({
      user: {
        id: row.id,
        email: row.email,
        role: row.role
      },
      profile: {
        hotelName: row.hotel_name,
        gst: row.gst,
        location: row.location,
        logoUrl: resolveHotelLogoUrl(row.id, row.logo_url),
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        address: row.address
      }
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to upload hotel logo";
    const loweredMessage = message.toLowerCase();

    if (loweredMessage.includes("bucket") && loweredMessage.includes("not")) {
      return res.status(500).json({ error: { message: "Supabase bucket is missing. Create the storage bucket and retry." } });
    }

    if (loweredMessage.includes("fetch failed") || loweredMessage.includes("network") || loweredMessage.includes("timeout")) {
      return res.status(503).json({ error: { message: "Supabase storage is temporarily unreachable. Please retry in a few seconds." } });
    }

    if (loweredMessage.includes("supabase upload failed")) {
      return res.status(502).json({ error: { message } });
    }

    return next(error);
  }
});

router.put("/hotel/profile", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) {
      return;
    }

    const form = hotelProfileSchema.parse(req.body);

    const result = await query(
      `INSERT INTO hotel_profiles (
         user_id,
         hotel_name,
         entity_name,
         gst,
         location,
         contact_email,
         contact_phone,
         address
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id)
       DO UPDATE SET
         hotel_name = EXCLUDED.hotel_name,
         entity_name = EXCLUDED.entity_name,
         gst = EXCLUDED.gst,
         location = EXCLUDED.location,
         contact_email = EXCLUDED.contact_email,
         contact_phone = EXCLUDED.contact_phone,
         address = EXCLUDED.address
       RETURNING user_id, hotel_name, entity_name, gst, location, logo_url, contact_email, contact_phone, address`,
      [
        payload.sub,
        form.hotelName.trim(),
        normalizeOptional(form.entityName),
        normalizeOptional(form.gst),
        normalizeOptional(form.location),
        normalizeOptional(form.contactEmail)?.toLowerCase() ?? null,
        normalizeOptional(form.contactPhone),
        normalizeOptional(form.address)
      ]
    );

    const userResult = await query(
      `SELECT id, email, role FROM users WHERE id = $1 LIMIT 1`,
      [payload.sub]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "User not found" } });
    }

    const user = userResult.rows[0];
    const profile = result.rows[0];

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      profile: {
        hotelName: profile.hotel_name,
        entityName: profile.entity_name,
        gst: profile.gst,
        location: profile.location,
        logoUrl: resolveHotelLogoUrl(user.id, profile.logo_url),
        contactEmail: profile.contact_email,
        contactPhone: profile.contact_phone,
        address: profile.address
      }
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Contact email is already in use" } });
    }

    return next(error);
  }
});

router.post("/hotel/change-password", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) {
      return;
    }

    const { currentPassword, newPassword } = hotelChangePasswordSchema.parse(req.body);

    const userResult = await query(
      `SELECT id, password_hash, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [payload.sub]
    );

    if (userResult.rowCount === 0) {
      await bcrypt.compare(currentPassword, DUMMY_PASSWORD_HASH);
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      await bcrypt.compare(currentPassword, DUMMY_PASSWORD_HASH);
      return res.status(403).json({ error: { message: "Account disabled" } });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: { message: "Current password is incorrect" } });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.bcryptCost);

    await query(
      `UPDATE users
       SET password_hash = $2,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $1`,
      [payload.sub, passwordHash]
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/corporate/login", authLimiter, async (req, res, next) => {
  try {
    const { username, password } = corporateLoginSchema.parse(req.body);
    const normalizedUsername = username.trim();
    const userIdCandidate = normalizedUsername.toUpperCase();
    const emailCandidate = normalizedUsername.toLowerCase();
    const isEmailUsername = emailCandidate.includes("@");

    // Check portal_users table for corporate sub-users
    const portalUserResult = await query(
      `SELECT pu.id, pu.email, pu.password_hash, pu.role, pu.parent_id, pu.full_name,
              pu.allowed_pages, pu.is_active, pu.portal_type
       FROM portal_users pu
       WHERE pu.email = $1 AND pu.portal_type = 'corporate'`,
      [emailCandidate]
    );

    if ((portalUserResult.rowCount ?? 0) > 0) {
      const portalUser = portalUserResult.rows[0];

      if (!portalUser.is_active) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        return res.status(403).json({ error: { message: "Account disabled" } });
      }

      const passwordOk = await bcrypt.compare(password, portalUser.password_hash);
      if (!passwordOk) {
        return res.status(401).json({ error: { message: "Invalid credentials" } });
      }

      // Get parent organization
      const orgResult = await query(
        `SELECT id, name, corporate_user_id FROM organizations WHERE id = $1`,
        [portalUser.parent_id]
      );

      if (orgResult.rowCount === 0) {
        return res.status(401).json({ error: { message: "Organization not found" } });
      }

      const org = orgResult.rows[0];

      await query(`UPDATE organizations SET last_login_at = NOW() WHERE id = $1`, [org.id]);

      const accessToken = createCorporateAccessToken(org.id, org.corporate_user_id, {
        isSubUser: true,
        portalUserId: portalUser.id,
        role: portalUser.role,
        allowedPages: portalUser.allowed_pages || []
      });

      return res.status(200).json({
        user: {
          id: org.id,
          userId: org.corporate_user_id,
          name: org.name,
          role: portalUser.role,
          isSubUser: true,
          portalUserId: portalUser.id,
          fullName: portalUser.full_name,
          allowedPages: portalUser.allowed_pages || []
        },
        mustSetPassword: false,
        accessToken
      });
    }

    // Admin org login (existing flow)
    const result = await query(
      `SELECT id, name, corporate_user_id, corporate_password_hash, contact_email, password_reset_required, is_active
       FROM organizations
       WHERE corporate_user_id = $1 OR contact_email = $2`,
      [userIdCandidate, emailCandidate]
    );

    if (result.rowCount === 0) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    const organization = result.rows[0];

    if (!organization.is_active) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(403).json({ error: { message: "Organization account disabled" } });
    }

    if (
      isEmailUsername &&
      organization.password_reset_required &&
      String(organization.corporate_user_id).toLowerCase() !== emailCandidate
    ) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(403).json({
        error: {
          message: "Complete first-time setup using generated user ID before logging in with email"
        }
      });
    }

    const passwordOk = await bcrypt.compare(password, organization.corporate_password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    await query(`UPDATE organizations SET last_login_at = NOW() WHERE id = $1`, [organization.id]);

    const accessToken = createCorporateAccessToken(organization.id, organization.corporate_user_id);

    return res.status(200).json({
      user: {
        id: organization.id,
        userId: organization.corporate_user_id,
        name: organization.name,
        role: "admin",
        isSubUser: false,
        allowedPages: []
      },
      mustSetPassword: Boolean(organization.password_reset_required),
      accessToken
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/me", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const result = await query(
      `SELECT id, name, corporate_user_id, registration_number, registered_address,
              contact_email, contact_phone, password_reset_required, is_active
       FROM organizations
       WHERE id = $1`,
      [payload.sub]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }

    const organization = result.rows[0];
    if (!organization.is_active) {
      return res.status(403).json({ error: { message: "Organization account disabled" } });
    }

    // If sub-user, get their info
    if (payload.isSubUser && payload.portalUserId) {
      let portalUser: any = null;

      // For Baikalsphere SSO sub-users, match by baikalsphere_user_id
      if (payload.bsUserId) {
        const bsMatch = await query(
          `SELECT id, full_name, email, role, allowed_pages FROM portal_users
           WHERE baikalsphere_user_id = $1 AND portal_type = 'corporate'`,
          [payload.bsUserId]
        );
        if (bsMatch.rowCount! > 0) {
          portalUser = bsMatch.rows[0];
        }
      }

      // Fallback for legacy tokens: match by portalUserId
      if (!portalUser) {
        const puResult = await query(
          `SELECT id, full_name, email, role, allowed_pages FROM portal_users WHERE id = $1`,
          [payload.portalUserId]
        );
        portalUser = puResult.rows[0];
      }

      return res.status(200).json({
        user: {
          id: organization.id,
          userId: organization.corporate_user_id,
          name: organization.name,
          role: portalUser?.role || payload.role,
          isSubUser: true,
          portalUserId: portalUser?.id,
          fullName: portalUser?.full_name,
          allowedPages: portalUser?.allowed_pages || []
        },
        profile: {
          name: organization.name,
          registrationNumber: organization.registration_number,
          address: organization.registered_address,
          contactEmail: organization.contact_email,
          phone: organization.contact_phone
        },
        mustSetPassword: false
      });
    }

    return res.status(200).json({
      user: {
        id: organization.id,
        userId: organization.corporate_user_id,
        name: organization.name,
        role: "admin",
        isSubUser: false,
        allowedPages: []
      },
      profile: {
        name: organization.name,
        registrationNumber: organization.registration_number,
        address: organization.registered_address,
        contactEmail: organization.contact_email,
        phone: organization.contact_phone
      },
      mustSetPassword: Boolean(organization.password_reset_required)
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/corporate/profile", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const form = corporateProfileSchema.parse(req.body);

    const result = await query(
      `UPDATE organizations
       SET name = $2,
           registration_number = $3,
           registered_address = $4,
           contact_email = $5,
           contact_phone = $6
       WHERE id = $1
       RETURNING id, name, corporate_user_id, registration_number, registered_address,
                 contact_email, contact_phone, password_reset_required`,
      [
        payload.sub,
        form.name.trim(),
        normalizeOptional(form.registrationNumber),
        normalizeOptional(form.address),
        normalizeOptional(form.contactEmail)?.toLowerCase() ?? null,
        normalizeOptional(form.phone)
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    const organization = result.rows[0];

    return res.status(200).json({
      user: {
        id: organization.id,
        userId: organization.corporate_user_id,
        name: organization.name,
        role: "corporate_portal_user"
      },
      profile: {
        name: organization.name,
        registrationNumber: organization.registration_number,
        address: organization.registered_address,
        contactEmail: organization.contact_email,
        phone: organization.contact_phone
      },
      mustSetPassword: Boolean(organization.password_reset_required)
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Contact email is already in use" } });
    }

    return next(error);
  }
});

router.get("/corporate/employees", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const { search } = corporateEmployeeListQuerySchema.parse(req.query);
    const normalizedSearch = search?.trim();
    const searchTerm = normalizedSearch ? `%${normalizedSearch}%` : null;

    const result = await query(
      `SELECT id, employee_code, full_name, email, phone, department,
              designation, cost_center, is_active, created_at, updated_at
       FROM corporate_employees
       WHERE organization_id = $1
         AND ($2::text IS NULL
              OR full_name ILIKE $2
              OR employee_code ILIKE $2
              OR COALESCE(email::text, '') ILIKE $2
              OR COALESCE(cost_center, '') ILIKE $2)
       ORDER BY created_at DESC`,
      [payload.sub, searchTerm]
    );

    const employees = result.rows.map((row) => ({
      id: row.id,
      organizationId: payload.sub,
      fullName: row.full_name,
      employeeCode: row.employee_code,
      email: row.email,
      phone: row.phone,
      department: row.department,
      designation: row.designation,
      costCenter: row.cost_center,
      status: row.is_active ? "active" : "inactive",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return res.status(200).json({ employees });
  } catch (error) {
    return next(error);
  }
});

router.post("/corporate/employees", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const form = corporateEmployeeSchema.parse(req.body);

    const result = await query(
      `INSERT INTO corporate_employees (
         organization_id,
         employee_code,
         full_name,
         email,
         phone,
         department,
         designation,
         cost_center,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, employee_code, full_name, email, phone, department,
                 designation, cost_center, is_active, created_at, updated_at`,
      [
        payload.sub,
        form.employeeCode.trim().toUpperCase(),
        form.fullName.trim(),
        normalizeOptional(form.email)?.toLowerCase() ?? null,
        normalizeOptional(form.phone),
        normalizeOptional(form.department),
        normalizeOptional(form.designation),
        normalizeOptional(form.costCenter),
        form.status === "active"
      ]
    );

    const row = result.rows[0];
    return res.status(201).json({
      employee: {
        id: row.id,
        organizationId: payload.sub,
        fullName: row.full_name,
        employeeCode: row.employee_code,
        email: row.email,
        phone: row.phone,
        department: row.department,
        designation: row.designation,
        costCenter: row.cost_center,
        status: row.is_active ? "active" : "inactive",
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      if (String(error?.constraint).includes("org_code")) {
        return res.status(409).json({ error: { message: "Employee code already exists" } });
      }
      if (String(error?.constraint).includes("org_email")) {
        return res.status(409).json({ error: { message: "Employee email already exists" } });
      }
      return res.status(409).json({ error: { message: "Employee already exists" } });
    }
    return next(error);
  }
});

router.put("/corporate/employees/:employeeId", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const employeeId = req.params.employeeId;
    const form = corporateEmployeeSchema.parse(req.body);

    const result = await query(
      `UPDATE corporate_employees
       SET employee_code = $3,
           full_name = $4,
           email = $5,
           phone = $6,
           department = $7,
           designation = $8,
           cost_center = $9,
           is_active = $10
       WHERE id = $1 AND organization_id = $2
       RETURNING id, employee_code, full_name, email, phone, department,
                 designation, cost_center, is_active, created_at, updated_at`,
      [
        employeeId,
        payload.sub,
        form.employeeCode.trim().toUpperCase(),
        form.fullName.trim(),
        normalizeOptional(form.email)?.toLowerCase() ?? null,
        normalizeOptional(form.phone),
        normalizeOptional(form.department),
        normalizeOptional(form.designation),
        normalizeOptional(form.costCenter),
        form.status === "active"
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Employee not found" } });
    }

    const row = result.rows[0];
    return res.status(200).json({
      employee: {
        id: row.id,
        organizationId: payload.sub,
        fullName: row.full_name,
        employeeCode: row.employee_code,
        email: row.email,
        phone: row.phone,
        department: row.department,
        designation: row.designation,
        costCenter: row.cost_center,
        status: row.is_active ? "active" : "inactive",
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      if (String(error?.constraint).includes("org_code")) {
        return res.status(409).json({ error: { message: "Employee code already exists" } });
      }
      if (String(error?.constraint).includes("org_email")) {
        return res.status(409).json({ error: { message: "Employee email already exists" } });
      }
      return res.status(409).json({ error: { message: "Employee already exists" } });
    }
    return next(error);
  }
});

router.get("/corporate/hotels/:hotelId/booking-request-meta", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const hotelId = req.params.hotelId;
    await ensureBookingRequestsTable();

    const relationshipResult = await query(
      `SELECT ho.hotel_user_id,
              COALESCE(hp.hotel_name, u.full_name, u.email, 'Hotel') AS hotel_name,
              COALESCE(hp.contact_email, u.email) AS hotel_email
       FROM hotel_organizations ho
       JOIN users u ON u.id = ho.hotel_user_id
       LEFT JOIN hotel_profiles hp ON hp.user_id = ho.hotel_user_id
       WHERE ho.organization_id = $1
         AND ho.hotel_user_id::text = $2
       LIMIT 1`,
      [payload.sub, hotelId]
    );

    if (relationshipResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Hotel relationship not found for this organization" } });
    }

    const contract = await getLatestSignedContractForCorporateHotel(payload.sub, hotelId);
    if (!contract) {
      return res.status(400).json({ error: { message: "No signed contract found with this hotel" } });
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

    const employeesResult = await query(
      `SELECT id, full_name, email, role
       FROM portal_users
       WHERE parent_id = $1
         AND portal_type = 'corporate'
         AND is_active = true
       ORDER BY full_name ASC`,
      [payload.sub]
    );

    const employees = employeesResult.rows.map((row) => ({
      id: row.id,
      employeeCode: row.email,
      fullName: row.full_name,
      email: row.email,
      department: row.role,
      designation: null
    }));

    const hotelRow = relationshipResult.rows[0];
    return res.status(200).json({
      hotel: {
        id: hotelId,
        name: hotelRow.hotel_name,
        email: hotelRow.hotel_email
      },
      contractId: contract.id,
      employees,
      roomTypes
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/hotels/:hotelId/contracts/latest", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const hotelId = req.params.hotelId;

    const relationshipResult = await query(
      `SELECT 1
       FROM hotel_organizations ho
       WHERE ho.organization_id = $1
         AND ho.hotel_user_id::text = $2
       LIMIT 1`,
      [payload.sub, hotelId]
    );

    if (relationshipResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Hotel relationship not found for this organization" } });
    }

    const contractResult = await query(
      `SELECT id,
              status,
              contract_data,
              signed_at,
              signed_by,
              signed_designation,
              created_at,
              updated_at
       FROM organization_contracts
       WHERE organization_id = $1
         AND hotel_user_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [payload.sub, hotelId]
    );

    if (contractResult.rowCount === 0) {
      return res.status(200).json({ contract: null });
    }

    const contract = contractResult.rows[0];
    return res.status(200).json({
      contract: {
        id: contract.id,
        status: contract.status,
        contractData: contract.contract_data,
        signedAt: contract.signed_at,
        signedBy: contract.signed_by,
        signedDesignation: contract.signed_designation,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
        pdfUrl: `/api/auth/corporate/hotels/${encodeURIComponent(hotelId)}/contracts/${encodeURIComponent(contract.id)}/pdf`
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/hotels/:hotelId/contracts/signed-history", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const hotelId = req.params.hotelId;

    const relationshipResult = await query(
      `SELECT 1
       FROM hotel_organizations ho
       WHERE ho.organization_id = $1
         AND ho.hotel_user_id::text = $2
       LIMIT 1`,
      [payload.sub, hotelId]
    );

    if (relationshipResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Hotel relationship not found for this organization" } });
    }

    const historyResult = await query(
      `SELECT id,
              status,
              signed_at,
              signed_by,
              signed_designation,
              created_at,
              updated_at
       FROM organization_contracts
       WHERE organization_id = $1
         AND hotel_user_id = $2
         AND status = 'signed'
         AND signed_at IS NOT NULL
       ORDER BY signed_at DESC, created_at DESC`,
      [payload.sub, hotelId]
    );

    const contracts = historyResult.rows.map((row) => ({
      id: row.id,
      status: row.status,
      signedAt: row.signed_at,
      signedBy: row.signed_by,
      signedDesignation: row.signed_designation,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      pdfUrl: `/api/auth/corporate/hotels/${encodeURIComponent(hotelId)}/contracts/${encodeURIComponent(row.id)}/pdf`
    }));

    return res.status(200).json({
      currentSignedContract: contracts[0] ?? null,
      previousSignedContracts: contracts.slice(1)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/hotels/:hotelId/contracts/:contractId/pdf", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const hotelId = req.params.hotelId;
    const contractId = req.params.contractId;

    const contractResult = await query(
      `SELECT c.id, c.pdf_storage_path
       FROM organization_contracts c
       WHERE c.id = $1
         AND c.organization_id = $2
         AND c.hotel_user_id::text = $3
         AND EXISTS (
           SELECT 1
           FROM hotel_organizations ho
           WHERE ho.organization_id = c.organization_id
             AND ho.hotel_user_id = c.hotel_user_id
         )
       LIMIT 1`,
      [contractId, payload.sub, hotelId]
    );

    if (contractResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Signed contract not found" } });
    }

    const row = contractResult.rows[0];
    if (!row.pdf_storage_path) {
      return res.status(404).json({ error: { message: "Contract PDF not available" } });
    }

    if (!isSupabaseStorageConfigured()) {
      return res.status(500).json({ error: { message: "Supabase storage is not configured" } });
    }

    const signedUrl = await createBillSignedUrl(row.pdf_storage_path as string, 120);
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

router.post("/corporate/booking-requests", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    await ensureBookingRequestsTable();
    const form = corporateBookingRequestSchema.parse(req.body);

    const relationshipResult = await query(
      `SELECT ho.hotel_user_id,
              COALESCE(hp.hotel_name, u.full_name, u.email, 'Hotel') AS hotel_name,
              COALESCE(hp.contact_email, u.email) AS hotel_email
       FROM hotel_organizations ho
       JOIN users u ON u.id = ho.hotel_user_id
       LEFT JOIN hotel_profiles hp ON hp.user_id = ho.hotel_user_id
       WHERE ho.organization_id = $1
         AND ho.hotel_user_id::text = $2
       LIMIT 1`,
      [payload.sub, form.hotelId]
    );

    if (relationshipResult.rowCount === 0) {
      return res.status(404).json({ error: { message: "Hotel relationship not found for this organization" } });
    }

    const employeeResult = await query(
      `SELECT id, full_name
       FROM portal_users
       WHERE id = $1
         AND parent_id = $2
         AND portal_type = 'corporate'
         AND is_active = true
       LIMIT 1`,
      [form.employeeId, payload.sub]
    );

    if (employeeResult.rowCount === 0) {
      return res.status(400).json({ error: { message: "Selected user is not active for this organization" } });
    }

    const contract = await getLatestSignedContractForCorporateHotel(payload.sub, form.hotelId);
    if (!contract) {
      return res.status(400).json({ error: { message: "No signed contract found with this hotel" } });
    }

    const roomRates = Array.isArray(contract.contract_data?.roomRates)
      ? contract.contract_data.roomRates
      : [];

    const selectedRoom = roomRates.find((roomRate: any) => {
      const contractRoomType = typeof roomRate?.roomType === "string" ? roomRate.roomType.trim().toLowerCase() : "";
      return contractRoomType.length > 0 && contractRoomType === form.roomType.trim().toLowerCase();
    });

    if (!selectedRoom) {
      return res.status(400).json({ error: { message: "Room type is not allowed by the signed contract" } });
    }

    const contractNightlyRate = resolveNightlyRate(selectedRoom);
    if (contractNightlyRate === null) {
      return res.status(400).json({ error: { message: "Selected room type has no valid rate in the signed contract" } });
    }

    const nights = getDaysBetween(form.checkInDate, form.checkOutDate);
    const totalPrice = Number((nights * contractNightlyRate).toFixed(2));

    const insertResult = await query(
      `INSERT INTO booking_requests (
         booking_number,
         organization_id,
         hotel_user_id,
         employee_id,
         room_type,
         check_in_date,
         check_out_date,
         nights,
         price_per_night,
         total_price,
         gst_applicable,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11, 'pending')
       RETURNING id, booking_number, room_type, check_in_date, check_out_date, nights, price_per_night, total_price, gst_applicable, status, requested_at`,
      [
        form.bookingNumber.trim().toUpperCase(),
        payload.sub,
        form.hotelId,
        form.employeeId,
        form.roomType.trim(),
        form.checkInDate,
        form.checkOutDate,
        nights,
        contractNightlyRate,
        totalPrice,
        form.gstApplicable
      ]
    );

    const requestRow = insertResult.rows[0];
    const relationship = relationshipResult.rows[0];
    const recipientEmail = normalizeOptional(relationship.hotel_email)?.toLowerCase();

    if (recipientEmail) {
      try {
        const organizationResult = await query(
          `SELECT name FROM organizations WHERE id = $1 LIMIT 1`,
          [payload.sub]
        );
        const organizationName = organizationResult.rows[0]?.name ?? "Organization";

        await sendBookingRequestHotelNotificationEmail({
          recipientEmail,
          hotelName: relationship.hotel_name,
          organizationName,
          bookingNumber: requestRow.booking_number,
          employeeName: employeeResult.rows[0].full_name,
          roomType: requestRow.room_type,
          checkInDate: new Date(requestRow.check_in_date).toISOString().slice(0, 10),
          checkOutDate: new Date(requestRow.check_out_date).toISOString().slice(0, 10),
          totalPrice: Number(requestRow.total_price)
        });
      } catch (emailError) {
        console.error("Failed to send booking request email to hotel", emailError);
      }
    }

    return res.status(201).json({
      request: {
        id: requestRow.id,
        bookingNumber: requestRow.booking_number,
        roomType: requestRow.room_type,
        checkInDate: requestRow.check_in_date,
        checkOutDate: requestRow.check_out_date,
        nights: Number(requestRow.nights),
        pricePerNight: Number(requestRow.price_per_night),
        totalPrice: Number(requestRow.total_price),
        gstApplicable: Boolean(requestRow.gst_applicable),
        status: requestRow.status,
        requestedAt: requestRow.requested_at
      }
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Booking number already exists for this hotel" } });
    }
    return next(error);
  }
});

router.get("/corporate/booking-requests", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    await ensureBookingRequestsTable();
    const status = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
    const allowedStatuses = new Set(["pending", "accepted", "rejected"]);
    const hasStatusFilter = allowedStatuses.has(status);

    const result = await query(
      `SELECT br.id,
              br.booking_number,
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
              br.hotel_user_id::text AS hotel_id,
              COALESCE(hp.hotel_name, u.full_name, u.email, 'Hotel') AS hotel_name,
              e.full_name AS employee_name,
              e.email AS employee_code
       FROM booking_requests br
       JOIN users u ON u.id = br.hotel_user_id
       LEFT JOIN hotel_profiles hp ON hp.user_id = br.hotel_user_id
       JOIN portal_users e ON e.id = br.employee_id
       WHERE br.organization_id = $1
         AND ($2::boolean = false OR br.status = $3)
       ORDER BY br.requested_at DESC`,
      [payload.sub, hasStatusFilter, status]
    );

    const requests = result.rows.map((row) => ({
      id: row.id,
      bookingNumber: row.booking_number,
      hotelId: row.hotel_id,
      hotelName: row.hotel_name,
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

router.get("/corporate/hotels", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const result = await query(
      `SELECT ho.hotel_user_id AS hotel_id,
              COALESCE(hp.hotel_name, u.full_name, u.email, 'Hotel') AS hotel_name,
              COALESCE(hp.location, '-') AS location,
              hp.logo_url,
              COUNT(b.id)::int AS total_stays,
              COUNT(*) FILTER (WHERE b.status IN ('pending', 'confirmed', 'checked-in'))::int AS active_stays,
              COALESCE(SUM(b.total_price), 0) AS total_spent,
              COALESCE(SUM(CASE WHEN b.status IN ('pending', 'confirmed', 'checked-in') THEN b.total_price ELSE 0 END), 0) AS pending_amount,
              COUNT(*) FILTER (WHERE b.status = 'pending')::int AS pending_bookings,
              MAX(b.check_out_date) AS last_stay_date
       FROM hotel_organizations ho
       JOIN users u ON u.id = ho.hotel_user_id
       LEFT JOIN hotel_profiles hp ON hp.user_id = ho.hotel_user_id
       LEFT JOIN hotel_bookings b ON b.organization_id = ho.organization_id
                                AND b.created_by = ho.hotel_user_id::text
       WHERE ho.organization_id = $1
       GROUP BY ho.hotel_user_id, hp.user_id, hp.hotel_name, hp.location, hp.logo_url, u.full_name, u.email
       ORDER BY COALESCE(MAX(b.created_at), now()) DESC`,
      [payload.sub]
    );

    const hotels = result.rows.map((row) => {
      const pendingAmount = Number(row.pending_amount ?? 0);

      return {
        id: row.hotel_id,
        name: row.hotel_name || "Hotel",
        location: row.location || "-",
        logoUrl: resolveHotelLogoUrl(row.hotel_id, row.logo_url),
        totalStays: Number(row.total_stays ?? 0),
        activeStays: Number(row.active_stays ?? 0),
        totalSpent: Number(row.total_spent ?? 0),
        outstanding: pendingAmount,
        pendingInvoices: Number(row.pending_bookings ?? 0),
        lastStayDate: row.last_stay_date,
        status: Number(row.active_stays ?? 0) > 0 ? "active" : "settled"
      };
    });

    return res.status(200).json({ hotels });
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/invoices", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const result = await query(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.amount, i.status,
              i.sent_at, i.created_at,
              b.created_by AS hotel_id,
              COALESCE(e.full_name, b.guest_name) AS employee_name,
              e.email AS employee_code,
        s.property_name,
        hp.hotel_name AS sender_hotel_name,
        hp.logo_url AS sender_hotel_logo_url,
        hp.location AS sender_hotel_location
       FROM corporate_invoices i
      JOIN hotel_bookings b ON b.id = i.booking_id
       LEFT JOIN portal_users e ON e.id = i.employee_id
       LEFT JOIN employee_stays s ON s.invoice_id = i.id
      LEFT JOIN hotel_profiles hp ON hp.user_id::text = b.created_by
       WHERE i.organization_id = $1
       ORDER BY i.created_at DESC`,
      [payload.sub]
    );

    const invoices = result.rows.map((row) => ({
      id: row.id,
      hotelId: row.hotel_id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      amount: Number(row.amount),
      status: row.status,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      propertyName: row.property_name,
      senderHotelName: row.sender_hotel_name,
      senderHotelLogoUrl: resolveHotelLogoUrl(row.hotel_id, row.sender_hotel_logo_url),
      senderHotelLocation: row.sender_hotel_location,
      sentAt: row.sent_at,
      createdAt: row.created_at
    }));

    return res.status(200).json({ invoices });
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/invoices/:invoiceId", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const invoiceId = req.params.invoiceId;
    const result = await query(
            `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.amount, i.status,
              i.sent_at, i.created_at,
              b.id AS booking_id, b.booking_number, b.room_type, b.check_in_date, b.check_out_date,
              b.nights, b.price_per_night, b.total_price,
              COALESCE(e.full_name, b.guest_name) AS employee_name, e.email AS employee_code,
              b.created_by AS hotel_id,
              s.property_name,
              hp.hotel_name AS sender_hotel_name,
              hp.logo_url AS sender_hotel_logo_url,
              hp.location AS sender_hotel_location
       FROM corporate_invoices i
       JOIN hotel_bookings b ON b.id = i.booking_id
       LEFT JOIN portal_users e ON e.id = i.employee_id
       LEFT JOIN employee_stays s ON s.invoice_id = i.id
      LEFT JOIN hotel_profiles hp ON hp.user_id::text = b.created_by
       WHERE i.organization_id = $1
         AND (i.id::text = $2 OR i.invoice_number = $2)
       LIMIT 1`,
      [payload.sub, invoiceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Invoice not found" } });
    }

    const row = result.rows[0];
    const billsResult = await query(
      `SELECT id, bill_category, file_name, storage_path, cloud_url, cloud_public_id, storage_provider,
              bill_amount, mime_type, file_size, notes, created_at
       FROM booking_bills
       WHERE booking_id = $1
       ORDER BY created_at DESC`,
      [row.booking_id]
    );

    const bills = billsResult.rows.map((billRow) => ({
      id: billRow.id,
      billCategory: billRow.bill_category,
      fileName: billRow.file_name,
      hasFile: Boolean(billRow.cloud_url || billRow.storage_path || billRow.cloud_public_id),
      fileUrl: billRow.cloud_url || billRow.storage_path || billRow.cloud_public_id
        ? `/api/auth/corporate/bills/${billRow.id}/file`
        : null,
      billAmount: Number(billRow.bill_amount ?? 0),
      mimeType: billRow.mime_type,
      fileSize: billRow.file_size,
      notes: billRow.notes,
      createdAt: billRow.created_at
    }));

    return res.status(200).json({
      invoice: {
        id: row.id,
        invoiceNumber: row.invoice_number,
        invoiceDate: row.invoice_date,
        dueDate: row.due_date,
        amount: Number(row.amount),
        status: row.status,
        bookingNumber: row.booking_number,
        roomType: row.room_type,
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        nights: Number(row.nights ?? 0),
        pricePerNight: Number(row.price_per_night ?? 0),
        roomCharges: Number(row.total_price ?? 0),
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        propertyName: row.property_name,
        senderHotelName: row.sender_hotel_name,
        senderHotelLogoUrl: resolveHotelLogoUrl(row.hotel_id, row.sender_hotel_logo_url),
        senderHotelLocation: row.sender_hotel_location,
        sentAt: row.sent_at,
        createdAt: row.created_at,
        bills
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/bills/:billId/file", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const billId = req.params.billId;
    const result = await query(
      `SELECT bb.id, bb.file_name, bb.mime_type, bb.storage_path, bb.cloud_url, bb.cloud_public_id, bb.storage_provider
       FROM booking_bills bb
       JOIN hotel_bookings hb ON hb.id = bb.booking_id
       WHERE bb.id = $1 AND hb.organization_id = $2
       LIMIT 1`,
      [billId, payload.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Bill file not found" } });
    }

    const row = result.rows[0];

    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    if (row.storage_provider === "supabase" && row.cloud_public_id) {
      const signedUrl = await createBillSignedUrl(row.cloud_public_id as string, 60);
      const cloudResponse = await fetch(signedUrl);
      if (!cloudResponse.ok) {
        return res.status(404).json({ error: { message: "Bill file not found on cloud storage" } });
      }

      const contentType = cloudResponse.headers.get("content-type") || row.mime_type || "application/octet-stream";
      const buffer = Buffer.from(await cloudResponse.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${row.file_name as string}"`);
      return res.send(buffer);
    }

    if (row.cloud_url) {
      const cloudResponse = await fetch(row.cloud_url as string);
      if (!cloudResponse.ok) {
        return res.status(404).json({ error: { message: "Bill file not found on cloud storage" } });
      }

      const contentType = cloudResponse.headers.get("content-type") || row.mime_type || "application/octet-stream";
      const buffer = Buffer.from(await cloudResponse.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${row.file_name as string}"`);
      return res.send(buffer);
    }

    const storagePath = row.storage_path as string | null;
    if (!storagePath) {
      return res.status(404).json({ error: { message: "No file stored for this bill" } });
    }

    const normalizedPath = path.resolve(storagePath);
    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ error: { message: "Bill file not found on server" } });
    }

    if (row.mime_type) {
      res.setHeader("Content-Type", row.mime_type as string);
    }
    res.setHeader("Content-Disposition", `inline; filename="${row.file_name as string}"`);
    return res.sendFile(normalizedPath);
  } catch (error) {
    return next(error);
  }
});

router.get("/corporate/employee-stays", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const result = await query(
      `SELECT s.id, s.booking_id, s.property_name, s.check_in_date, s.check_out_date,
              s.nights, s.total_amount, s.status, s.invoice_id, s.created_at,
              e.full_name AS employee_name,
              e.email AS employee_code,
              e.role AS department,
              i.invoice_number
       FROM employee_stays s
       JOIN portal_users e ON e.id = s.employee_id
       LEFT JOIN corporate_invoices i ON i.id = s.invoice_id
       WHERE s.organization_id = $1
       ORDER BY s.created_at DESC`,
      [payload.sub]
    );

    const stays = result.rows.map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      department: row.department,
      propertyName: row.property_name,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      nights: Number(row.nights),
      totalAmount: Number(row.total_amount),
      status: row.status,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      createdAt: row.created_at
    }));

    return res.status(200).json({ stays });
  } catch (error) {
    return next(error);
  }
});

router.post("/corporate/set-password", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) {
      return;
    }

    const { newPassword } = corporateSetPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(newPassword, config.bcryptCost);

    const result = await query(
      `UPDATE organizations
       SET corporate_password_hash = $2,
           password_reset_required = false
       WHERE id = $1
       RETURNING id, password_reset_required`,
      [payload.sub, passwordHash]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "Organization not found" } });
    }

    return res.status(200).json({
      ok: true,
      mustSetPassword: Boolean(result.rows[0].password_reset_required)
    });
  } catch (error) {
    return next(error);
  }
});

// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
// Portal User Management (Hotel Finance)
// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

router.get("/hotel/users", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) return;

    // Only admin can list users
    if (payload.isSubUser) {
      return res.status(403).json({ error: { message: "Only admin can manage users" } });
    }

    const result = await query(
      `SELECT id, full_name, email, role, allowed_pages, is_active, created_at, updated_at
       FROM portal_users
       WHERE parent_id = $1 AND portal_type = 'hotel_finance'
       ORDER BY created_at DESC`,
      [payload.sub]
    );

    return res.status(200).json({ users: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/hotel/users", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) return;

    if (payload.isSubUser) {
      return res.status(403).json({ error: { message: "Only admin can create users" } });
    }

    const form = portalUserCreateSchema.parse(req.body);
    const normalizedEmail = form.email.trim().toLowerCase();
    const generatedPassword = createGeneratedHotelPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, config.bcryptCost);

    // Get hotel name for the credential email
    const hotelResult = await query(
      `SELECT hp.hotel_name FROM hotel_profiles hp WHERE hp.user_id = $1 LIMIT 1`,
      [payload.sub]
    );
    const hotelName = hotelResult.rows[0]?.hotel_name || "Hotel";

    const result = await query(
      `INSERT INTO portal_users (portal_type, parent_id, full_name, email, password_hash, role, allowed_pages)
       VALUES ('hotel_finance', $1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, role, allowed_pages, is_active, created_at, updated_at`,
      [payload.sub, form.fullName.trim(), normalizedEmail, passwordHash, form.role, form.allowedPages]
    );

    // Provision in Baikalsphere for SSO
    const bsUserId = await provisionBaikalsphereUser(normalizedEmail, form.fullName.trim(), passwordHash);
    if (bsUserId) {
      await query(
        `UPDATE portal_users SET baikalsphere_user_id = $1 WHERE id = $2`,
        [bsUserId, result.rows[0].id]
      );
    }

    // Send credentials email
    try {
      await sendPortalUserCredentialsEmail({
        recipientEmail: normalizedEmail,
        userName: form.fullName.trim(),
        portalName: `${hotelName} - Hotel Finance`,
        loginEmail: normalizedEmail,
        password: generatedPassword,
        portalType: "hotel_finance"
      });
    } catch (emailError: any) {
      console.error("[mailer] Failed to send portal user credentials:", emailError?.message);
    }

    return res.status(201).json({ user: result.rows[0] });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Email already registered" } });
    }
    return next(error);
  }
});

router.put("/hotel/users/:userId", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) return;

    if (payload.isSubUser) {
      return res.status(403).json({ error: { message: "Only admin can update users" } });
    }

    const form = portalUserUpdateSchema.parse(req.body);
    const userId = req.params.userId;

    const setClauses: string[] = [];
    const params: unknown[] = [userId, payload.sub];
    let paramIndex = 3;

    if (form.fullName !== undefined) {
      setClauses.push(`full_name = $${paramIndex}`);
      params.push(form.fullName.trim());
      paramIndex++;
    }
    if (form.role !== undefined) {
      setClauses.push(`role = $${paramIndex}`);
      params.push(form.role);
      paramIndex++;
    }
    if (form.allowedPages !== undefined) {
      setClauses.push(`allowed_pages = $${paramIndex}`);
      params.push(form.allowedPages);
      paramIndex++;
    }
    if (form.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(form.isActive);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: { message: "No fields to update" } });
    }

    const result = await query(
      `UPDATE portal_users
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND parent_id = $2 AND portal_type = 'hotel_finance'
       RETURNING id, full_name, email, role, allowed_pages, is_active, created_at, updated_at`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "User not found" } });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete("/hotel/users/:userId", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) return;

    if (payload.isSubUser) {
      return res.status(403).json({ error: { message: "Only admin can delete users" } });
    }

    const userId = req.params.userId;
    const result = await query(
      `DELETE FROM portal_users WHERE id = $1 AND parent_id = $2 AND portal_type = 'hotel_finance'`,
      [userId, payload.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "User not found" } });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// Change password for hotel finance sub-user
router.post("/hotel/user/change-password", async (req, res, next) => {
  try {
    const payload = await getHotelPayload(req, res);
    if (!payload) return;

    const { currentPassword, newPassword } = portalUserChangePasswordSchema.parse(req.body);

    // If admin, use existing change password logic (users table)
    if (!payload.isSubUser) {
      const userResult = await query(
        `SELECT id, password_hash, is_active FROM users WHERE id = $1 LIMIT 1`,
        [payload.sub]
      );

      if (userResult.rowCount === 0) {
        return res.status(401).json({ error: { message: "Unauthorized" } });
      }

      const user = userResult.rows[0];
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: { message: "Current password is incorrect" } });
      }

      const passwordHash = await bcrypt.hash(newPassword, config.bcryptCost);
      await query(
        `UPDATE users SET password_hash = $2, failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
        [payload.sub, passwordHash]
      );

      return res.status(200).json({ ok: true });
    }

    // Sub-user ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ find by parent_id + allowedPages match
    const puResult = await query(
      `SELECT id, password_hash FROM portal_users
       WHERE parent_id = $1 AND portal_type = 'hotel_finance'`,
      [payload.sub]
    );

    // Find matching portal user
    const matchedUser = puResult.rows.find((pu: any) =>
      JSON.stringify(pu.allowed_pages) === JSON.stringify(payload.allowedPages)
    ) || puResult.rows[0];

    if (!matchedUser) {
      return res.status(401).json({ error: { message: "User not found" } });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, matchedUser.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: { message: "Current password is incorrect" } });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.bcryptCost);
    await query(
      `UPDATE portal_users SET password_hash = $2, password_reset_required = false WHERE id = $1`,
      [matchedUser.id, passwordHash]
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
// Portal User Management (Corporate)
// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â

router.get("/corporate/users", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) return;

    // Both admin and sub-users can view the users list
    const parentId = payload.isSubUser ? payload.portalUserId ? undefined : payload.sub : payload.sub;
    // For sub-users, look up the parent_id from their portal_users record
    let orgId = payload.sub;
    if (payload.isSubUser) {
      const parentResult = await query(
        `SELECT parent_id FROM portal_users WHERE id = $1 LIMIT 1`,
        [payload.portalUserId]
      );
      if (parentResult.rows.length > 0) {
        orgId = parentResult.rows[0].parent_id;
      }
    }

    const result = await query(
      `SELECT id, full_name, email, role, allowed_pages, is_active, created_at, updated_at
       FROM portal_users
       WHERE parent_id = $1 AND portal_type = 'corporate'
       ORDER BY created_at DESC`,
      [orgId]
    );

    return res.status(200).json({ users: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/corporate/users", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) return;

    if (payload.isSubUser) {
      return res.status(403).json({ error: { message: "Only admin can create users" } });
    }

    const form = portalUserCreateSchema.parse(req.body);
    const normalizedEmail = form.email.trim().toLowerCase();
    const generatedPassword = createGeneratedHotelPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, config.bcryptCost);

    // Get org name for the credential email
    const orgResult = await query(
      `SELECT name FROM organizations WHERE id = $1 LIMIT 1`,
      [payload.sub]
    );
    const orgName = orgResult.rows[0]?.name || "Organization";

    const result = await query(
      `INSERT INTO portal_users (portal_type, parent_id, full_name, email, password_hash, role, allowed_pages)
       VALUES ('corporate', $1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, role, allowed_pages, is_active, created_at, updated_at`,
      [payload.sub, form.fullName.trim(), normalizedEmail, passwordHash, form.role, form.allowedPages]
    );

    // Provision in Baikalsphere for SSO
    const bsUserId = await provisionBaikalsphereUser(normalizedEmail, form.fullName.trim(), passwordHash);
    if (bsUserId) {
      await query(
        `UPDATE portal_users SET baikalsphere_user_id = $1 WHERE id = $2`,
        [bsUserId, result.rows[0].id]
      );
    }

    // Send credentials email
    try {
      await sendPortalUserCredentialsEmail({
        recipientEmail: normalizedEmail,
        userName: form.fullName.trim(),
        portalName: `${orgName} - Corporate Portal`,
        loginEmail: normalizedEmail,
        password: generatedPassword,
        portalType: "corporate"
      });
    } catch (emailError: any) {
      console.error("[mailer] Failed to send portal user credentials:", emailError?.message);
    }

    return res.status(201).json({ user: result.rows[0] });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: { message: "Email already registered" } });
    }
    return next(error);
  }
});

router.put("/corporate/users/:userId", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) return;

    if (payload.isSubUser) {
      return res.status(403).json({ error: { message: "Only admin can update users" } });
    }

    const form = portalUserUpdateSchema.parse(req.body);
    const userId = req.params.userId;

    const setClauses: string[] = [];
    const params: unknown[] = [userId, payload.sub];
    let paramIndex = 3;

    if (form.fullName !== undefined) {
      setClauses.push(`full_name = $${paramIndex}`);
      params.push(form.fullName.trim());
      paramIndex++;
    }
    if (form.role !== undefined) {
      setClauses.push(`role = $${paramIndex}`);
      params.push(form.role);
      paramIndex++;
    }
    if (form.allowedPages !== undefined) {
      setClauses.push(`allowed_pages = $${paramIndex}`);
      params.push(form.allowedPages);
      paramIndex++;
    }
    if (form.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(form.isActive);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: { message: "No fields to update" } });
    }

    const result = await query(
      `UPDATE portal_users
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND parent_id = $2 AND portal_type = 'corporate'
       RETURNING id, full_name, email, role, allowed_pages, is_active, created_at, updated_at`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "User not found" } });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete("/corporate/users/:userId", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) return;

    if (payload.isSubUser) {
      return res.status(403).json({ error: { message: "Only admin can delete users" } });
    }

    const userId = req.params.userId;
    const result = await query(
      `DELETE FROM portal_users WHERE id = $1 AND parent_id = $2 AND portal_type = 'corporate'`,
      [userId, payload.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: "User not found" } });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// Change password for corporate portal users (admin or sub-user)
router.post("/corporate/user/change-password", async (req, res, next) => {
  try {
    const payload = await getCorporatePayload(req, res);
    if (!payload) return;

    const { currentPassword, newPassword } = portalUserChangePasswordSchema.parse(req.body);

    // Admin change password
    if (!payload.isSubUser) {
      const orgResult = await query(
        `SELECT id, corporate_password_hash FROM organizations WHERE id = $1 LIMIT 1`,
        [payload.sub]
      );

      if (orgResult.rowCount === 0) {
        return res.status(401).json({ error: { message: "Unauthorized" } });
      }

      const org = orgResult.rows[0];
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, org.corporate_password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: { message: "Current password is incorrect" } });
      }

      const passwordHash = await bcrypt.hash(newPassword, config.bcryptCost);
      await query(
        `UPDATE organizations SET corporate_password_hash = $2, password_reset_required = false WHERE id = $1`,
        [payload.sub, passwordHash]
      );

      return res.status(200).json({ ok: true });
    }

    // Sub-user
    if (!payload.portalUserId) {
      return res.status(401).json({ error: { message: "User not found" } });
    }

    const puResult = await query(
      `SELECT id, password_hash FROM portal_users WHERE id = $1 AND portal_type = 'corporate'`,
      [payload.portalUserId]
    );

    if (puResult.rowCount === 0) {
      return res.status(401).json({ error: { message: "User not found" } });
    }

    const portalUser = puResult.rows[0];
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, portalUser.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: { message: "Current password is incorrect" } });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.bcryptCost);
    await query(
      `UPDATE portal_users SET password_hash = $2, password_reset_required = false WHERE id = $1`,
      [portalUser.id, passwordHash]
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
