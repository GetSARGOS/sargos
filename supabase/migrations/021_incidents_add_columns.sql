-- Migration 021: Add timezone and current_operational_period to incidents
-- Required for Feature 3 (Incident Lifecycle Management):
--   timezone: IANA identifier used for all incident-scoped time display (client-side formatting)
--   current_operational_period: tracks which op period is active

ALTER TABLE incidents
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN current_operational_period INTEGER NOT NULL DEFAULT 1;
