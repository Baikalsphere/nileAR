/**
 * Creates an AR hotel user for the arun@baikalsphere.com Baikalsphere account
 * so we can test the SSO flow end-to-end.
 */
import { query } from "../src/db.js";

const BS_USER_ID = "a449f2fc-7bfe-411b-9480-ad107a16440d";
const BS_EMAIL = "arun@baikalsphere.com";

async function main() {
  // Create AR hotel user with a placeholder password (login will be via SSO)
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, role, baikalsphere_user_id)
     VALUES ($1, 'sso-only', 'Arun (Baikalsphere)', 'hotel_finance_user', $2)
     ON CONFLICT (email) DO UPDATE SET baikalsphere_user_id = $2
     RETURNING id, email`,
    [BS_EMAIL, BS_USER_ID]
  );

  const user = result.rows[0];
  console.log(`AR user: ${user.email} (id: ${user.id}) → baikalsphere_user_id: ${BS_USER_ID}`);

  // Create hotel profile
  await query(
    `INSERT INTO hotel_profiles (user_id, hotel_name, contact_email)
     VALUES ($1, 'Baikalsphere Test Hotel', $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [user.id, BS_EMAIL]
  );

  console.log("Hotel profile created.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
