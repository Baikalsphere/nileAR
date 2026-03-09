require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  // Check hotel users
  const h = await p.query('SELECT id, email, baikalsphere_user_id FROM users ORDER BY email');
  console.log('=== HOTEL USERS ===');
  for (const x of h.rows) {
    console.log(x.email, '|', x.baikalsphere_user_id ? 'MAPPED' : 'NULL');
  }
  console.log('Total hotel:', h.rowCount, '| Mapped:', h.rows.filter(x => x.baikalsphere_user_id).length);

  // Check orgs
  const o = await p.query('SELECT id, name, contact_email, baikalsphere_user_id FROM organizations ORDER BY name');
  console.log('\n=== ORGANIZATIONS ===');
  for (const x of o.rows) {
    console.log(x.name, '|', x.contact_email, '|', x.baikalsphere_user_id ? 'MAPPED' : 'NULL');
  }
  console.log('Total orgs:', o.rowCount, '| Mapped:', o.rows.filter(x => x.baikalsphere_user_id).length);

  // Check for users with NO mapping in either table who exist in Baikalsphere
  // (these would be the ones that fall through)
  const allMappedBsIds = [
    ...h.rows.filter(x => x.baikalsphere_user_id).map(x => x.baikalsphere_user_id),
    ...o.rows.filter(x => x.baikalsphere_user_id).map(x => x.baikalsphere_user_id)
  ];
  console.log('\nTotal unique Baikalsphere IDs mapped in AR:', allMappedBsIds.length);

  await p.end();
})();
