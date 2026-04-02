-- Migration 015: incident_resources
-- Tracks which org resources are checked out to an incident

CREATE TABLE incident_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'deployed' CHECK (status IN (
                    'requested', 'deployed', 'returned', 'out_of_service'
                  )),
  checked_out_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_by  UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  checked_in_at   TIMESTAMPTZ,
  checked_in_by   UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incident_resources_incident_id ON incident_resources(incident_id);
CREATE INDEX idx_incident_resources_resource_id ON incident_resources(resource_id);
CREATE INDEX idx_incident_resources_organization_id ON incident_resources(organization_id);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON incident_resources
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE incident_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_resources_select_org_members"
  ON incident_resources FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Org members can deploy resources (logistics/IC role enforced at API layer)
CREATE POLICY "incident_resources_insert_org_members"
  ON incident_resources FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_resources_update_org_members"
  ON incident_resources FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));
