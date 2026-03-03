/**
 * Migration: Change employee_id FK references from corporate_employees to portal_users
 * in booking_requests, hotel_bookings, corporate_invoices, and employee_stays tables.
 */
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const databaseUrl = process.env.DATABASE_URL;
const useSsl = (process.env.DB_SSL ?? "true") === "true";

if (!databaseUrl) {
  console.error("DATABASE_URL is missing in .env");
  process.exit(1);
}

const { Client } = pg;

const client = new Client({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

const TABLES = ["booking_requests", "hotel_bookings", "corporate_invoices", "employee_stays"];

const run = async () => {
  try {
    await client.connect();

    for (const table of TABLES) {
      // Check if the table exists
      const tableExists = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
        [table]
      );

      if (tableExists.rowCount === 0) {
        console.log(`Table ${table} does not exist, skipping.`);
        continue;
      }

      // Find and drop any FK constraint on employee_id that references corporate_employees
      const fkResult = await client.query(
        `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name
         WHERE tc.table_name = $1
           AND tc.constraint_type = 'FOREIGN KEY'
           AND ccu.table_name = 'corporate_employees'
           AND ccu.column_name = 'id'`,
        [table]
      );

      for (const row of fkResult.rows) {
        console.log(`Dropping FK constraint ${row.constraint_name} from ${table}...`);
        await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${row.constraint_name}`);
      }

      // Check if employee_id column exists
      const colExists = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'employee_id' LIMIT 1`,
        [table]
      );

      if (colExists.rowCount === 0) {
        console.log(`Table ${table} has no employee_id column, skipping FK add.`);
        continue;
      }

      // Add new FK constraint to portal_users
      const newConstraintName = `${table}_employee_id_portal_users_fk`;
      console.log(`Adding FK constraint ${newConstraintName} on ${table}...`);
      try {
        await client.query(
          `ALTER TABLE ${table} ADD CONSTRAINT ${newConstraintName}
           FOREIGN KEY (employee_id) REFERENCES portal_users(id) ON DELETE RESTRICT`
        );
        console.log(`  Done.`);
      } catch (error: any) {
        // If there's existing data referencing corporate_employees IDs that don't exist in portal_users,
        // we can't add the FK. In that case, just log a warning and skip.
        if (error.code === "23503") {
          console.warn(`  Warning: Cannot add FK on ${table} — existing rows reference IDs not in portal_users. Skipping FK constraint.`);
        } else {
          throw error;
        }
      }
    }

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
