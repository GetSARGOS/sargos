-- Migration 008: organization_invites
-- Tracks pending email invitations to join an organization

CREATE TABLE organization_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('org_admin', 'member')),
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      UUID NOT NULL REFERENCES organization_members(id),
  accepted_at     TIMESTAMPTZ DEFAULT NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_org_invites_token ON organization_invites(token);
CREATE INDEX idx_org_invites_organization_id ON organization_invites(organization_id);
CREATE INDEX idx_org_invites_email ON organization_invites(email);

-- RLS
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Org admins can see their org's invites
CREATE POLICY "org_invites_select_org_admins"
  ON organization_invites FOR SELECT
  USING (is_org_admin(organization_id));

-- Org admins can create invites
CREATE POLICY "org_invites_insert_org_admins"
  ON organization_invites FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

-- Org admins can update invites (e.g. mark accepted)
CREATE POLICY "org_invites_update_org_admins"
  ON organization_invites FOR UPDATE
  USING (is_org_admin(organization_id));
