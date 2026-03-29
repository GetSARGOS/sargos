-- Migration 003: organization_members table
-- Joins users to organizations with an org-level role.
-- A user can belong to multiple organizations.

CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('org_admin', 'member')),
  display_name    TEXT NOT NULL,
  phone           TEXT,
  certifications  TEXT[] DEFAULT '{}',
  availability    TEXT NOT NULL DEFAULT 'available' CHECK (availability IN (
                    'available', 'unavailable', 'on_call'
                  )),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

-- updated_at trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON organization_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT: any active member can read all members in their organization
CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- INSERT: org admins insert new members, OR a user inserts their own record
--         (invite acceptance flow — token validation enforced at API layer).
--         Initial admin creation is done server-side via service_role key,
--         which bypasses RLS entirely.
CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT
  WITH CHECK (
    -- Already an admin in this org
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role = 'org_admin'
        AND is_active = true
        AND deleted_at IS NULL
    )
    OR
    -- User is inserting their own record (invite acceptance)
    user_id = auth.uid()
  );

-- UPDATE: org admins can update any member; members can update their own record.
--         Role-change restriction (a member can't promote themselves) is enforced
--         at the API layer — RLS cannot enforce column-level change restrictions.
CREATE POLICY "org_members_update" ON organization_members
  FOR UPDATE
  USING (
    -- Org admin in the same org
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role = 'org_admin'
        AND is_active = true
        AND deleted_at IS NULL
    )
    OR
    -- Member updating their own record
    user_id = auth.uid()
  );

-- Deletes are permanently disabled. Use is_active = false and deleted_at.
CREATE POLICY "org_members_no_delete" ON organization_members
  FOR DELETE
  USING (false);
