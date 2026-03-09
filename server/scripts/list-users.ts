import { query } from "../src/db.js";

async function main() {
  const users = await query("SELECT id, email, full_name, role, is_active FROM users ORDER BY created_at");
  console.log("=== AR Hotel Users ===");
  for (const u of users.rows) console.log(JSON.stringify(u));

  const orgs = await query("SELECT id, name, corporate_user_id, contact_email, is_active FROM organizations ORDER BY created_at");
  console.log("\n=== AR Organizations ===");
  for (const o of orgs.rows) console.log(JSON.stringify(o));

  const portals = await query("SELECT id, portal_type, parent_id, full_name, email, role, is_active FROM portal_users ORDER BY created_at");
  console.log("\n=== AR Portal Users ===");
  for (const p of portals.rows) console.log(JSON.stringify(p));

  const hotelOrgs = await query("SELECT ho.hotel_user_id, u.email as hotel_email, ho.organization_id, o.name as org_name FROM hotel_organizations ho JOIN users u ON u.id = ho.hotel_user_id JOIN organizations o ON o.id = ho.organization_id");
  console.log("\n=== Hotel-Organization Links ===");
  for (const ho of hotelOrgs.rows) console.log(JSON.stringify(ho));

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
