-- Migration 022: Add missing columns to incident_personnel
-- Aligns migration with database-schema.md:
--   safety_briefing_acknowledged: legal proof volunteer was briefed
--   expected_return_at: IC sets during sector assignment; client polls for overdue alerts
--   'missing' status: added to CHECK constraint for personnel accountability

ALTER TABLE incident_personnel
  ADD COLUMN safety_briefing_acknowledged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN expected_return_at TIMESTAMPTZ;

-- Expand status CHECK to include 'missing'
ALTER TABLE incident_personnel
  DROP CONSTRAINT incident_personnel_status_check,
  ADD CONSTRAINT incident_personnel_status_check CHECK (status IN (
    'available', 'assigned', 'in_field', 'resting', 'injured', 'stood_down', 'missing'
  ));
