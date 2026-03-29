-- Migration 002: organizations table
-- The top-level tenant. Every piece of data is scoped to an organization.
-- NOTE: SELECT and UPDATE policies reference organization_members, which doesn't
--       exist in this migration. They are added in 004_organizations_rls.sql.

CREATE TABLE organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  unit_type           TEXT NOT NULL CHECK (unit_type IN (
                        'sar', 'fire', 'ems', 'law_enforcement', 'combined', 'other'
                      )),
  region              TEXT,
  state               TEXT,
  country             TEXT NOT NULL DEFAULT 'US',
  contact_email       TEXT,
  contact_phone       TEXT,
  logo_url            TEXT,
  subscription_tier   TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN (
                        'free', 'volunteer', 'professional', 'enterprise'
                      )),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN (
                        'active', 'past_due', 'canceled', 'trialing'
                      )),
  stripe_customer_id  TEXT UNIQUE,
  max_members         INTEGER NOT NULL DEFAULT 5,
  deleted_at          TIMESTAMPTZ DEFAULT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);

-- updated_at trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS. Permissive policies added here are only safe non-cross-table ones.
-- Cross-table policies (SELECT, UPDATE) are deferred to 004_organizations_rls.sql.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Public INSERT during onboarding. The API route that creates an org must use
-- the service_role key to add the first org_admin immediately after creation.
CREATE POLICY "organizations_insert" ON organizations
  FOR INSERT
  WITH CHECK (true);

-- Deletes are permanently disabled. Use deleted_at for soft deletes.
CREATE POLICY "organizations_no_delete" ON organizations
  FOR DELETE
  USING (false);
