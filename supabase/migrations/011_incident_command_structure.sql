-- Migration 011: incident_command_structure
-- Tracks who holds each ICS role for a given incident

CREATE TABLE incident_command_structure (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id       UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  ics_role        TEXT NOT NULL CHECK (ics_role IN (
                    'incident_commander', 'deputy_ic', 'safety_officer',
                    'public_information_officer', 'liaison_officer',
                    'operations_section_chief', 'planning_section_chief',
                    'logistics_section_chief', 'finance_section_chief',
                    'medical_officer', 'observer'
                  )),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  relieved_at     TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incident_command_incident_id ON incident_command_structure(incident_id);
CREATE INDEX idx_incident_command_member_id ON incident_command_structure(member_id);
CREATE INDEX idx_incident_command_organization_id ON incident_command_structure(organization_id);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON incident_command_structure
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE incident_command_structure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_command_select_org_members"
  ON incident_command_structure FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- IC role enforcement happens at API layer; RLS allows any org member to insert
CREATE POLICY "incident_command_insert_org_members"
  ON incident_command_structure FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_command_update_org_members"
  ON incident_command_structure FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));
