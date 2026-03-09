import pg from 'pg';

const arUrl = 'postgresql://neondb_owner:npg_qmDgr1hOILc8@ep-bitter-night-aipz9ria-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new pg.Pool({ connectionString: arUrl });

async function main() {
  // Check users table columns (need baikalsphere_user_id)
  const userCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
  console.log('AR users columns:', userCols.rows.map((r:any)=>r.column_name).join(', '));

  // Check organizations table columns (need baikalsphere_user_id)
  const orgCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='organizations' ORDER BY ordinal_position");
  console.log('AR organizations columns:', orgCols.rows.map((r:any)=>r.column_name).join(', '));

  // Check hotel users with BS mapping
  const hotelUsers = await pool.query("SELECT email, id, baikalsphere_user_id FROM users WHERE baikalsphere_user_id IS NOT NULL");
  console.log('\n=== AR Hotel Users with Baikalsphere mapping ===');
  for (const u of hotelUsers.rows) console.log(`  ${u.email} | ar_id: ${u.id} | bs_id: ${u.baikalsphere_user_id}`);

  // Check ALL hotel users
  const allHotelUsers = await pool.query("SELECT email, id, baikalsphere_user_id FROM users");
  console.log('\n=== ALL AR Hotel Users ===');
  for (const u of allHotelUsers.rows) console.log(`  ${u.email} | ar_id: ${u.id} | bs_id: ${u.baikalsphere_user_id || 'NULL'}`);

  // Check orgs with BS mapping
  const orgs = await pool.query("SELECT id, name, corporate_user_id, baikalsphere_user_id FROM organizations WHERE baikalsphere_user_id IS NOT NULL LIMIT 5");
  console.log('\n=== Sample Orgs with Baikalsphere mapping ===');
  for (const o of orgs.rows) console.log(`  ${o.name} | corp_login: ${o.corporate_user_id} | bs_id: ${o.baikalsphere_user_id}`);

  // Count orgs with BS mapping
  const orgCount = await pool.query("SELECT COUNT(*) as total, COUNT(baikalsphere_user_id) as mapped FROM organizations");
  console.log(`\nOrganizations: ${orgCount.rows[0].total} total, ${orgCount.rows[0].mapped} mapped to Baikalsphere`);

  await pool.end();
}
main();
