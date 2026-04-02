-- Migration 012: incident_sectors
-- Search sectors drawn on the map. Created before incident_personnel
-- because incident_personnel has a FK reference to this table.

CREATE TABLE incident_sectors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  boundary        GEOMETRY(Polygon, 4326) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN (
                    'unassigned', 'assigned', 'in_progress', 'completed', 'suspended'
                  )),
  color           TEXT DEFAULT '#3B82F6',
  assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  priority        INTEGER DEFAULT 0,
  poa             NUMERIC(5,4) CHECK (poa BETWEEN 0 AND 1),
  pod             NUMERIC(5,4) CHECK (pod BETWEEN 0 AND 1),
  pos             NUMERIC(5,4) CHECK (pos BETWEEN 0 AND 1),
  terrain_type    TEXT,
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incident_sectors_incident_id ON incident_sectors(incident_id);
CREATE INDEX idx_incident_sectors_organization_id ON incident_sectors(organization_id);
CREATE INDEX idx_incident_sectors_boundary ON incident_sectors USING GIST(boundary);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON incident_sectors
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE incident_sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_sectors_select_org_members"
  ON incident_sectors FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_sectors_insert_org_members"
  ON incident_sectors FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_sectors_update_org_members"
  ON incident_sectors FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));
