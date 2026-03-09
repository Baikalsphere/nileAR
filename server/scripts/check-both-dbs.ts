import pg from 'pg';

// Connect directly with the AR DATABASE_URL 
const arUrl = 'postgresql://neondb_owner:npg_qmDgr1hOILc8@ep-bitter-night-aipz9ria-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new pg.Pool({ connectionString: arUrl });

async function main() {
  // List ALL tables across ALL schemas
  const res = await pool.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_type = 'BASE TABLE' 
    AND table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name
  `);
  console.log('=== All tables in AR DB (ep-bitter-night) ===');
  for (const r of res.rows) {
    console.log(`  ${r.table_schema}.${r.table_name}`);
  }

  // Also check Baikalsphere DB for comparison
  const bsUrl = 'postgresql://neondb_owner:npg_DCk7ng6rsqIb@ep-misty-wind-ad46j1vy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  const pool2 = new pg.Pool({ connectionString: bsUrl });
  const res2 = await pool2.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_type = 'BASE TABLE' 
    AND table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name
  `);
  console.log('\n=== All tables in Baikalsphere DB (ep-misty-wind) ===');
  for (const r of res2.rows) {
    console.log(`  ${r.table_schema}.${r.table_name}`);
  }

  await pool.end();
  await pool2.end();
}
main();
