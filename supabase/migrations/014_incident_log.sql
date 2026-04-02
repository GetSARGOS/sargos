-- Migration 014: incident_log
-- Immutable chronological record of everything that happens during an incident.
-- Never updated or deleted — append-only.

CREATE TABLE incident_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
                    'narrative',
                    'personnel_checkin',
                    'personnel_checkout',
                    'personnel_status_change',
                    'resource_deployed',
                    'resource_returned',
                    'sector_assigned',
                    'sector_status_change',
                    'subject_update',
                    'par_initiated',
                    'par_completed',
                    'role_assigned',
                    'incident_status_change',
                    'form_exported',
                    'flight_path_added',
                    'system'
                  )),
  message         TEXT NOT NULL,
  actor_id        UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  actor_name      TEXT, -- denormalized in case actor is deleted later
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at — append-only table
);

-- Indexes
CREATE INDEX idx_incident_log_incident_id ON incident_log(incident_id, created_at DESC);
CREATE INDEX idx_incident_log_organization_id ON incident_log(organization_id);
CREATE INDEX idx_incident_log_entry_type ON incident_log(incident_id, entry_type);

-- RLS
ALTER TABLE incident_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_log_select_org_members"
  ON incident_log FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Authenticated org members can append log entries
CREATE POLICY "incident_log_insert_org_members"
  ON incident_log FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

-- UPDATE and DELETE are intentionally omitted — no policies means no access
