import { query, pool } from "../src/db.js";

const targetOrganizationId = process.argv[2];
const sourceOrganizationName = process.argv[3] ?? "";

if (!targetOrganizationId) {
  console.error("Usage: npx tsx scripts/link-organization-hotels.ts <targetOrganizationId> [sourceOrganizationName]");
  process.exit(1);
}

const run = async () => {
  const targetResult = await query(
    `SELECT id, name
     FROM organizations
     WHERE id = $1
     LIMIT 1`,
    [targetOrganizationId]
  );

  if (targetResult.rowCount === 0) {
    throw new Error(`Target organization not found: ${targetOrganizationId}`);
  }

  const target = targetResult.rows[0];
  const sourceName = sourceOrganizationName.trim().length > 0
    ? sourceOrganizationName.trim()
    : String(target.name ?? "");

  const candidates = await query(
    `SELECT DISTINCT ho.hotel_user_id
     FROM hotel_organizations ho
     JOIN organizations o ON o.id = ho.organization_id
     WHERE o.name ILIKE $1`,
    [`%${sourceName}%`]
  );

  console.log("Target organization:", target);
  console.log("Source name match:", sourceName);
  console.log("Candidate linked hotels:", candidates.rowCount);

  if (candidates.rowCount === 0) {
    console.log("No candidate hotel links found.");
    return;
  }

  const insertResult = await query(
    `INSERT INTO hotel_organizations (hotel_user_id, organization_id)
     SELECT DISTINCT ho.hotel_user_id, $1
     FROM hotel_organizations ho
     JOIN organizations o ON o.id = ho.organization_id
     WHERE o.name ILIKE $2
       AND ho.hotel_user_id IS NOT NULL
     ON CONFLICT (hotel_user_id, organization_id) DO NOTHING
     RETURNING hotel_user_id`,
    [targetOrganizationId, `%${sourceName}%`]
  );

  console.log("Inserted links:", insertResult.rowCount);

  const finalLinks = await query(
    `SELECT ho.hotel_user_id, hp.hotel_name, hp.location
     FROM hotel_organizations ho
     LEFT JOIN hotel_profiles hp ON hp.user_id = ho.hotel_user_id
     WHERE ho.organization_id = $1
     ORDER BY hp.hotel_name NULLS LAST, ho.hotel_user_id`,
    [targetOrganizationId]
  );

  console.log("Final linked hotels:", finalLinks.rowCount);
  console.table(finalLinks.rows);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
