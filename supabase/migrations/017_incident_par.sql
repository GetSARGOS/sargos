-- Migration 017: incident_par_events + incident_par_responses
-- Personnel Accountability Report (PAR) roll call tracking

-- ─── incident_par_events ─────────────────────────────────────────────────────

CREATE TABLE incident_par_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiated_by    UUID NOT NULL REFERENCES organization_members(id),
  initiated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  total_personnel INTEGER NOT NULL DEFAULT 0,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  -- personnel IDs who did not respond when the PAR was completed
  unaccounted_ids UUID[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_par_events_incident_id ON incident_par_events(incident_id);
CREATE INDEX idx_par_events_organization_id ON incident_par_events(organization_id);

CREATE TRIGGER set_updated_at_incident_par_events
BEFORE UPDATE ON incident_par_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE incident_par_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "par_events_select_org_members"
  ON incident_par_events FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "par_events_insert_org_members"
  ON incident_par_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "par_events_update_org_members"
  ON incident_par_events FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- ─── incident_par_responses ──────────────────────────────────────────────────

CREATE TABLE incident_par_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  par_event_id    UUID NOT NULL REFERENCES incident_par_events(id) ON DELETE CASCADE,
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  personnel_id    UUID NOT NULL REFERENCES incident_personnel(id) ON DELETE CASCADE,
  confirmed_safe  BOOLEAN NOT NULL DEFAULT true,
  confirmed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One response per personnel per PAR event
  CONSTRAINT incident_par_responses_unique UNIQUE (par_event_id, personnel_id)
);

CREATE INDEX idx_par_responses_par_event_id ON incident_par_responses(par_event_id);
CREATE INDEX idx_par_responses_incident_id ON incident_par_responses(incident_id);
CREATE INDEX idx_par_responses_organization_id ON incident_par_responses(organization_id);

CREATE TRIGGER set_updated_at_incident_par_responses
BEFORE UPDATE ON incident_par_responses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE incident_par_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "par_responses_select_org_members"
  ON incident_par_responses FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Org members can submit responses (role enforcement at API layer)
CREATE POLICY "par_responses_insert_org_members"
  ON incident_par_responses FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

-- Enable Realtime broadcasts for PAR tables.
-- REPLICA IDENTITY FULL is required so UPDATE/DELETE events include all columns,
-- which allows the incident_id filter to be evaluated for UPDATE events.
ALTER TABLE incident_par_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_par_events;
ALTER TABLE incident_par_responses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_par_responses;
