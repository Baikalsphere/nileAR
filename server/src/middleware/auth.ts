import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { query } from "../db.js";

// Legacy AR token payload
interface ArTokenPayload {
  sub: string;
  role: string;
  scope: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

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

/**
 * Tries to verify token as a Baikalsphere centralized auth token first,
 * then falls back to legacy AR token for backward compatibility.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }

  const token = header.slice("Bearer ".length).trim();

  // Try Baikalsphere centralized auth token first
  if (config.baikalsphereJwtSecret) {
    try {
      const payload = jwt.verify(token, config.baikalsphereJwtSecret, {
        issuer: "baikalsphere-auth",
        audience: "baikalsphere",
      }) as BaikalsphereTokenPayload;

      // Verify user has access to the AR module
      if (!payload.modules || !payload.modules.includes("ar")) {
        return res.status(403).json({ error: { message: "No access to AR module" } });
      }

      // Resolve Baikalsphere user ID → AR user ID
      // First check if baikalsphere_user_id is mapped in AR users table
      const mappedUser = await query(
        `SELECT id, role FROM users WHERE baikalsphere_user_id = $1`,
        [payload.sub]
      );

      if (mappedUser.rowCount! > 0) {
        req.user = {
          id: mappedUser.rows[0].id,
          role: payload.platformRole === "superadmin" ? "admin" : "hotel_finance_user",
          scope: "hotel-finance",
        };
        return next();
      }

      // Check if sub directly matches an AR user ID (same UUID migration)
      const directUser = await query(
        `SELECT id FROM users WHERE id = $1`,
        [payload.sub]
      );

      if (directUser.rowCount! > 0) {
        req.user = {
          id: payload.sub,
          role: payload.platformRole === "superadmin" ? "admin" : "hotel_finance_user",
          scope: "hotel-finance",
        };
        return next();
      }

      // Not a hotel user — might be a corporate user, let the route handle it
      req.user = {
        id: payload.sub,
        role: payload.platformRole === "superadmin" ? "admin" : "hotel_finance_user",
        scope: "hotel-finance",
      };
      return next();
    } catch {
      // Not a valid Baikalsphere token, try legacy
    }
  }

  // Fallback: legacy AR module token
  try {
    const payload = jwt.verify(token, config.jwtAccessSecret, {
      issuer: "hotel-finance-api",
      audience: "hotel-finance-web"
    }) as ArTokenPayload;

    req.user = { id: payload.sub, role: payload.role, scope: payload.scope };
    return next();
  } catch {
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }
};
