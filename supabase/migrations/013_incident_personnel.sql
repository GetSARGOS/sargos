-- Migration 013: incident_personnel
-- Everyone on an incident — org members and unaffiliated walk-up volunteers.
-- Source of truth for the resource board and ICS 211.

CREATE TABLE incident_personnel (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Org member (null if unaffiliated volunteer)
  member_id         UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  -- Unaffiliated volunteer fields (null if org member)
  volunteer_name    TEXT,
  volunteer_phone   TEXT,
  volunteer_certifications TEXT[] DEFAULT '{}',
  volunteer_vehicle TEXT,
  volunteer_medical_notes TEXT,
  -- Common fields
  personnel_type    TEXT NOT NULL CHECK (personnel_type IN ('member', 'volunteer')),
  checkin_method    TEXT NOT NULL CHECK (checkin_method IN ('manual', 'qr_scan', 'app')),
  checked_in_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at    TIMESTAMPTZ DEFAULT NULL,
  status            TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
                      'available', 'assigned', 'in_field', 'resting', 'injured', 'stood_down'
                    )),
  incident_role     TEXT CHECK (incident_role IN (
                      'incident_commander', 'deputy_ic', 'safety_officer',
                      'public_information_officer', 'liaison_officer',
                      'operations_section_chief', 'planning_section_chief',
                      'logistics_section_chief', 'finance_section_chief',
                      'medical_officer', 'field_member', 'observer'
                    )),
  assigned_sector_id UUID REFERENCES incident_sectors(id) ON DELETE SET NULL,
  assigned_team_id   UUID REFERENCES teams(id) ON DELETE SET NULL,
  last_checked_in_at TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Either member_id or volunteer_name must be set
  CONSTRAINT incident_personnel_identity_check CHECK (
    (member_id IS NOT NULL AND volunteer_name IS NULL) OR
    (member_id IS NULL AND volunteer_name IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_incident_personnel_incident_id ON incident_personnel(incident_id);
CREATE INDEX idx_incident_personnel_member_id ON incident_personnel(member_id);
CREATE INDEX idx_incident_personnel_organization_id ON incident_personnel(organization_id);
CREATE INDEX idx_incident_personnel_status ON incident_personnel(incident_id, status);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON incident_personnel
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE incident_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_personnel_select_org_members"
  ON incident_personnel FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_personnel_insert_org_members"
  ON incident_personnel FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_personnel_update_org_members"
  ON incident_personnel FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Enable Realtime broadcasts for this table.
-- REPLICA IDENTITY FULL is required so UPDATE events include all old-row columns.
-- Without it, the postgres_changes filter (incident_id=eq.X) cannot be evaluated
-- for UPDATE events because the default identity only contains the primary key.
ALTER TABLE incident_personnel REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_personnel;
