import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Check organizations table columns
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='organizations' ORDER BY ordinal_position");
  console.log('=== Organizations columns ===');
  console.log(cols.rows.map((r: any) => r.column_name).join(', '));

  // List all tables to find where corporate logins live
  const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('\n=== All AR tables ===');
  for (const t of tables.rows) {
    const tc = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${t.tablename}' ORDER BY ordinal_position`);
    console.log(`  ${t.tablename}: ${tc.rows.map((r:any) => r.column_name).join(', ')}`);
  }

  // Check hotel users password field  
  const userCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  console.log('\n=== Users columns ===');
  console.log(userCols.rows.map((r: any) => r.column_name).join(', '));

  // Check hotel users baikalsphere mapping
  const hotelUsers = await pool.query("SELECT email, baikalsphere_user_id, CASE WHEN password IS NOT NULL THEN 'YES' ELSE 'NO' END as has_pwd FROM users");
  console.log('\n=== AR Hotel Users ===');
  for (const r of hotelUsers.rows) {
    console.log(`  ${r.email} | has_pwd: ${r.has_pwd} | bs_id: ${r.baikalsphere_user_id}`);
  }

  await pool.end();
}
main();
