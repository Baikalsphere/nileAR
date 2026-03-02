import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  DB_SSL: z.enum(["true", "false"]).default("true"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  MAIL_PROVIDER: z.enum(["auto", "smtp", "resend"]).default("auto"),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().email().optional(),
  ADMIN_PROVISIONING_SECRET: z.string().min(16).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_FOLDER: z.string().default("hotel-finance/bills"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("booking-bills")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

const env = parsed.data;
const corsOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
const resendConfigured = Boolean(env.RESEND_API_KEY && env.RESEND_FROM);

const resolveMailProvider = (): "smtp" | "resend" | null => {
  if (env.MAIL_PROVIDER === "smtp") {
    return smtpConfigured ? "smtp" : null;
  }

  if (env.MAIL_PROVIDER === "resend") {
    return resendConfigured ? "resend" : null;
  }

  if (resendConfigured) {
    return "resend";
  }

  if (smtpConfigured) {
    return "smtp";
  }

  return null;
};

const mailProvider = resolveMailProvider();

const normalizeDatabaseUrl = (databaseUrl: string) => {
  try {
    const parsedUrl = new URL(databaseUrl);
    const sslMode = parsedUrl.searchParams.get("sslmode")?.toLowerCase();

    if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
      parsedUrl.searchParams.set("sslmode", "verify-full");
    }

    return parsedUrl.toString();
  } catch {
    return databaseUrl.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=(&|$))/i, "$1verify-full");
  }
};

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: normalizeDatabaseUrl(env.DATABASE_URL),
  dbSsl: env.DB_SSL === "true",
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  accessTokenTtl: env.ACCESS_TOKEN_TTL,
  refreshTokenTtl: env.REFRESH_TOKEN_TTL,
  bcryptCost: env.BCRYPT_COST,
  corsOrigins,
  mailProvider,
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT,
  smtpSecure: env.SMTP_SECURE === "true",
  smtpUser: env.SMTP_USER,
  smtpPass: env.SMTP_PASS,
  smtpFrom: env.SMTP_FROM,
  resendApiKey: env.RESEND_API_KEY,
  resendFrom: env.RESEND_FROM,
  adminProvisioningSecret: env.ADMIN_PROVISIONING_SECRET,
  cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: env.CLOUDINARY_API_SECRET,
  cloudinaryFolder: env.CLOUDINARY_FOLDER,
  cloudinaryEnabled: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: env.SUPABASE_STORAGE_BUCKET,
  supabaseStorageEnabled: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  mailEnabled: Boolean(mailProvider),
  isProd: env.NODE_ENV === "production"
};
