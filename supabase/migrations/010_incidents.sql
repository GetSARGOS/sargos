-- Migration 010: incidents
-- Central record for every search and rescue operation

CREATE TABLE incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  incident_number   TEXT,
  incident_type     TEXT NOT NULL CHECK (incident_type IN (
                      'lost_person', 'overdue_hiker', 'technical_rescue',
                      'swift_water', 'avalanche', 'structure_collapse',
                      'mutual_aid', 'training', 'other'
                    )),
  status            TEXT NOT NULL DEFAULT 'planning' CHECK (status IN (
                      'planning', 'active', 'suspended', 'closed'
                    )),
  location_address  TEXT,
  location_point    GEOMETRY(Point, 4326),
  lkp_point         GEOMETRY(Point, 4326),
  ipp_point         GEOMETRY(Point, 4326),
  started_at        TIMESTAMPTZ,
  suspended_at      TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  after_action_notes TEXT,
  operational_period_hours INTEGER NOT NULL DEFAULT 12,
  deleted_at        TIMESTAMPTZ DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incidents_organization_id ON incidents(organization_id);
CREATE INDEX idx_incidents_status ON incidents(organization_id, status);
CREATE INDEX idx_incidents_location_point ON incidents USING GIST(location_point);
CREATE INDEX idx_incidents_lkp_point ON incidents USING GIST(lkp_point);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- All org members can see their org's incidents
CREATE POLICY "incidents_select_org_members"
  ON incidents FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Authenticated org members can create incidents (IC role enforced at API layer)
CREATE POLICY "incidents_insert_org_members"
  ON incidents FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

-- Authenticated org members can update incidents (IC role enforced at API layer)
CREATE POLICY "incidents_update_org_members"
  ON incidents FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));
