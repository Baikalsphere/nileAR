import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on("error", (error) => {
  if (config.nodeEnv !== "production") {
    console.error("Postgres pool error (client will be recycled):", error.message);
  }
});

const isTransientPgError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("connection terminated unexpectedly") ||
    message.includes("connection terminated due to connection timeout") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("server closed the connection unexpectedly")
  );
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const query = async (text: string, params?: unknown[]) => {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isTransientPgError(error);
      if (!shouldRetry) {
        throw error;
      }

      if (config.nodeEnv !== "production") {
        console.warn(`Transient Postgres error, retrying query (attempt ${attempt + 1}/${maxAttempts})`);
      }
      await wait(150 * attempt);
    }
  }

  throw new Error("Postgres query failed after retries");
};
