CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'hotel_finance_user',
  is_active boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hotel_name text,
  entity_name text,
  gst text,
  location text,
  logo_url text,
  contact_email citext,
  contact_phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hotel_profiles
  DROP COLUMN IF EXISTS website;

CREATE INDEX IF NOT EXISTS hotel_profiles_user_id_idx ON hotel_profiles(user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id),
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  gst text,
  credit_period text,
  payment_terms text,
  registration_number text,
  registered_address text,
  contact_email citext,
  contact_phone text,
  status text NOT NULL DEFAULT 'active',
  corporate_user_id text UNIQUE NOT NULL,
  corporate_password_hash text NOT NULL,
  password_reset_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS contact_email citext,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS pan_card text,
  ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS organizations_name_idx ON organizations(name);
CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations(status);
CREATE INDEX IF NOT EXISTS organizations_created_by_user_id_idx ON organizations(created_by_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_contact_email_uniq
  ON organizations(contact_email)
  WHERE contact_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS hotel_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS hotel_organizations_hotel_user_id_idx
  ON hotel_organizations(hotel_user_id);

CREATE INDEX IF NOT EXISTS hotel_organizations_organization_id_idx
  ON hotel_organizations(organization_id);

INSERT INTO hotel_organizations (hotel_user_id, organization_id)
SELECT o.created_by_user_id, o.id
FROM organizations o
WHERE o.created_by_user_id IS NOT NULL
ON CONFLICT (hotel_user_id, organization_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_contracts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  contract_data jsonb NOT NULL,
  pdf_storage_path text,
  sign_token text UNIQUE,
  sign_token_expires_at timestamptz,
  signed_by text,
  signed_designation text,
  signature_data_url text,
  signed_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organization_contracts
  ADD COLUMN IF NOT EXISTS hotel_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;

UPDATE organization_contracts c
SET hotel_user_id = o.created_by_user_id
FROM organizations o
WHERE c.organization_id = o.id
  AND c.hotel_user_id IS NULL
  AND o.created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organization_contracts_organization_id_idx
  ON organization_contracts(organization_id);

CREATE INDEX IF NOT EXISTS organization_contracts_hotel_user_id_idx
  ON organization_contracts(hotel_user_id);

CREATE INDEX IF NOT EXISTS organization_contracts_org_hotel_created_idx
  ON organization_contracts(organization_id, hotel_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_contracts_created_at_idx
  ON organization_contracts(created_at DESC);

DROP TRIGGER IF EXISTS organization_contracts_set_updated_at ON organization_contracts;
CREATE TRIGGER organization_contracts_set_updated_at
  BEFORE UPDATE ON organization_contracts
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS hotel_profiles_set_updated_at ON hotel_profiles;
CREATE TRIGGER hotel_profiles_set_updated_at
  BEFORE UPDATE ON hotel_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations;
CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE TABLE IF NOT EXISTS corporate_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  email citext,
  phone text,
  department text,
  designation text,
  cost_center text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corporate_employees_organization_id_idx
  ON corporate_employees(organization_id);

CREATE INDEX IF NOT EXISTS corporate_employees_full_name_idx
  ON corporate_employees(full_name);

CREATE UNIQUE INDEX IF NOT EXISTS corporate_employees_org_code_uniq
  ON corporate_employees(organization_id, employee_code);

CREATE UNIQUE INDEX IF NOT EXISTS corporate_employees_org_email_uniq
  ON corporate_employees(organization_id, email)
  WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS corporate_employees_set_updated_at ON corporate_employees;
CREATE TRIGGER corporate_employees_set_updated_at
  BEFORE UPDATE ON corporate_employees
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE TABLE IF NOT EXISTS hotel_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text UNIQUE NOT NULL,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE RESTRICT,
  room_type text NOT NULL,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  nights integer NOT NULL,
  price_per_night numeric(12,2) NOT NULL,
  total_price numeric(12,2) NOT NULL,
  gst_applicable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  invoice_id uuid,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotel_bookings_org_id_idx
  ON hotel_bookings(organization_id);

CREATE INDEX IF NOT EXISTS hotel_bookings_employee_id_idx
  ON hotel_bookings(employee_id);

CREATE INDEX IF NOT EXISTS hotel_bookings_created_at_idx
  ON hotel_bookings(created_at DESC);

DROP TRIGGER IF EXISTS hotel_bookings_set_updated_at ON hotel_bookings;
CREATE TRIGGER hotel_bookings_set_updated_at
  BEFORE UPDATE ON hotel_bookings
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE TABLE IF NOT EXISTS booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES corporate_employees(id) ON DELETE RESTRICT,
  room_type text NOT NULL,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  nights integer NOT NULL,
  price_per_night numeric(12,2) NOT NULL,
  total_price numeric(12,2) NOT NULL,
  gst_applicable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by text,
  booking_id uuid REFERENCES hotel_bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_user_id, booking_number)
);

CREATE INDEX IF NOT EXISTS booking_requests_hotel_user_id_idx
  ON booking_requests(hotel_user_id);

CREATE INDEX IF NOT EXISTS booking_requests_organization_id_idx
  ON booking_requests(organization_id);

CREATE INDEX IF NOT EXISTS booking_requests_status_idx
  ON booking_requests(status);

DROP TRIGGER IF EXISTS booking_requests_set_updated_at ON booking_requests;
CREATE TRIGGER booking_requests_set_updated_at
  BEFORE UPDATE ON booking_requests
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE TABLE IF NOT EXISTS booking_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  bill_category text NOT NULL,
  file_name text NOT NULL,
  storage_path text,
  cloud_url text,
  cloud_public_id text,
  storage_provider text NOT NULL DEFAULT 'local',
  bill_amount numeric(12,2) NOT NULL DEFAULT 0,
  mime_type text,
  file_size integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_bills
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS cloud_url text,
  ADD COLUMN IF NOT EXISTS cloud_public_id text,
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS bill_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS booking_bills_booking_id_idx
  ON booking_bills(booking_id);

DROP TRIGGER IF EXISTS booking_bills_set_updated_at ON booking_bills;
CREATE TRIGGER booking_bills_set_updated_at
  BEFORE UPDATE ON booking_bills
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE TABLE IF NOT EXISTS corporate_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid UNIQUE NOT NULL REFERENCES hotel_bookings(id) ON DELETE RESTRICT,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE RESTRICT,
  invoice_number text UNIQUE NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'unpaid',
  recipient_email citext,
  cc_email citext,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corporate_invoices_org_id_idx
  ON corporate_invoices(organization_id);

CREATE INDEX IF NOT EXISTS corporate_invoices_status_idx
  ON corporate_invoices(status);

DROP TRIGGER IF EXISTS corporate_invoices_set_updated_at ON corporate_invoices;
CREATE TRIGGER corporate_invoices_set_updated_at
  BEFORE UPDATE ON corporate_invoices
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hotel_bookings_invoice_fk'
  ) THEN
    ALTER TABLE hotel_bookings
      ADD CONSTRAINT hotel_bookings_invoice_fk
      FOREIGN KEY (invoice_id) REFERENCES corporate_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employee_stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id uuid UNIQUE NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE RESTRICT,
  property_name text NOT NULL,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  nights integer NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_invoice',
  invoice_id uuid REFERENCES corporate_invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_stays_org_id_idx
  ON employee_stays(organization_id);

DROP TRIGGER IF EXISTS employee_stays_set_updated_at ON employee_stays;
CREATE TRIGGER employee_stays_set_updated_at
  BEFORE UPDATE ON employee_stays
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- Portal sub-users (hotel-finance & corporate)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_type text NOT NULL CHECK (portal_type IN ('hotel_finance', 'corporate')),
  -- For hotel_finance users, parent_id = users.id (admin hotel user)
  parent_id text NOT NULL,
  full_name text NOT NULL,
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  allowed_pages text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  password_reset_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_users_parent_id_idx ON portal_users(parent_id);
CREATE INDEX IF NOT EXISTS portal_users_portal_type_idx ON portal_users(portal_type);
CREATE INDEX IF NOT EXISTS portal_users_email_idx ON portal_users(email);

DROP TRIGGER IF EXISTS portal_users_set_updated_at ON portal_users;
CREATE TRIGGER portal_users_set_updated_at
  BEFORE UPDATE ON portal_users
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();
