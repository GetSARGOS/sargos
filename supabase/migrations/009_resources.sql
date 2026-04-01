-- Migration 009: resources
-- Org-level equipment and resource inventory

CREATE TABLE resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
                    'vehicle', 'radio', 'rope_rigging', 'medical',
                    'shelter', 'navigation', 'water_rescue', 'air', 'other'
                  )),
  identifier      TEXT, -- serial number, plate, call sign, tail number
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
                    'available', 'deployed', 'out_of_service', 'requested'
                  )),
  notes           TEXT,
  last_inspected_at TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_resources_organization_id ON resources(organization_id);
CREATE INDEX idx_resources_status ON resources(organization_id, status);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON resources
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- All org members can see their org's resources
CREATE POLICY "resources_select_org_members"
  ON resources FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Org admins can create and manage resources
CREATE POLICY "resources_insert_org_admins"
  ON resources FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "resources_update_org_admins"
  ON resources FOR UPDATE
  USING (is_org_admin(organization_id));
