require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  // Find hotel users whose baikalsphere_user_id also exists in organizations
  const r = await p.query(`
    SELECT u.id, u.email, u.baikalsphere_user_id, o.name as org_name
    FROM users u
    JOIN organizations o ON o.baikalsphere_user_id = u.baikalsphere_user_id
    ORDER BY u.email
  `);

  if (r.rowCount === 0) {
    console.log('No wrongly auto-provisioned hotel accounts found.');
    await p.end();
    return;
  }

  console.log('Found', r.rowCount, 'hotel accounts that also have org mappings:');
  for (const x of r.rows) {
    console.log(' ', x.email, '| org:', x.org_name, '| hotel user id:', x.id);
  }

  // Delete these users (and their hotel_profiles via CASCADE)
  const ids = r.rows.map(x => x.id);
  // First delete hotel_profiles
  await p.query(`DELETE FROM hotel_profiles WHERE user_id = ANY($1::uuid[])`, [ids]);
  // Then delete users
  const del = await p.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
  console.log('\nDeleted', del.rowCount, 'wrongly auto-provisioned hotel accounts.');

  // Verify
  const verify = await p.query('SELECT count(*) FROM users');
  console.log('Remaining hotel users:', verify.rows[0].count);

  await p.end();
})();
