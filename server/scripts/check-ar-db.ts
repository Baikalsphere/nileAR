import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Check ALL tables
  const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('=== ALL tables in AR DB ===');
  for (const t of tables.rows) {
    console.log(`  ${t.tablename}`);
  }

  // Check if hotel_profiles exists
  const hp = await pool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='hotel_profiles'");
  console.log(`\nhotel_profiles exists: ${hp.rows[0].count > 0}`);

  // Check if bookings exists
  const bk = await pool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='bookings'");
  console.log(`bookings exists: ${bk.rows[0].count > 0}`);

  // Check users table columns (the real AR users table)
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  console.log(`\nusers columns: ${cols.rows.map((r:any)=>r.column_name).join(', ')}`);

  // Check organizations table columns
  const orgCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='organizations' ORDER BY ordinal_position");
  console.log(`organizations columns: ${orgCols.rows.map((r:any)=>r.column_name).join(', ')}`);

  // Count users
  const uc = await pool.query("SELECT COUNT(*) FROM users");
  console.log(`\nUsers count: ${uc.rows[0].count}`);

  // Check a sample user
  const su = await pool.query("SELECT email, platform_role FROM users LIMIT 3");
  console.log('Sample users:');
  for (const u of su.rows) {
    console.log(`  ${u.email} | ${u.platform_role}`);
  }

  await pool.end();
}
main();
