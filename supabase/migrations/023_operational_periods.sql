-- Migration 023: operational_periods
-- Lightweight time-boundary table for ICS operational periods.
-- IC or Planning Section Chief starts new periods; system closes the previous one.
-- ICS 202 auto-fills objectives; ICS 204 uses time boundaries; log filters by period.

CREATE TABLE operational_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_number   INTEGER NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ, -- null = currently active period
  objectives      TEXT,
  weather_summary TEXT,
  created_by      UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id, period_number)
);

-- Indexes
CREATE INDEX idx_operational_periods_incident_id ON operational_periods(incident_id);
CREATE INDEX idx_operational_periods_organization_id ON operational_periods(organization_id);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON operational_periods
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE operational_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operational_periods_select_org_members"
  ON operational_periods FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "operational_periods_insert_org_members"
  ON operational_periods FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "operational_periods_update_org_members"
  ON operational_periods FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Enable Realtime for live operational period display
ALTER TABLE operational_periods REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE operational_periods;
