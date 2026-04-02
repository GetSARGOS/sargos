-- Migration 007: teams and team_members
-- Sub-groups within an organization and their membership

CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  team_type       TEXT CHECK (team_type IN (
                    'ground', 'k9', 'swift_water', 'technical_rescue',
                    'air', 'medical', 'logistics', 'command', 'other'
                  )),
  description     TEXT,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  role_in_team    TEXT DEFAULT 'member' CHECK (role_in_team IN ('lead', 'member')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, member_id)
);

-- Indexes
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_member_id ON team_members(member_id);
CREATE INDEX idx_team_members_organization_id ON team_members(organization_id);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Teams: org members can read; org admins can write
CREATE POLICY "teams_select_org_members"
  ON teams FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "teams_insert_org_admins"
  ON teams FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "teams_update_org_admins"
  ON teams FOR UPDATE
  USING (is_org_admin(organization_id));

-- Team members: org members can read; org admins can write
CREATE POLICY "team_members_select_org_members"
  ON team_members FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "team_members_insert_org_admins"
  ON team_members FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "team_members_delete_org_admins"
  ON team_members FOR DELETE
  USING (is_org_admin(organization_id));
