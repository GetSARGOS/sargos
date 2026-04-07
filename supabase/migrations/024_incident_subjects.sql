-- Migration 024: incident_subjects
-- People being searched for or rescued. Multiple subjects per incident.
-- PHI fields (medical_notes, medications, known_conditions) exist in schema
-- but are NOT exposed in any UI or API response at MVP.
-- See claude-rules.md Section 8 for HIPAA requirements before enabling.

CREATE TABLE incident_subjects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id           UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  age                   INTEGER,
  gender                TEXT CHECK (gender IN ('male', 'female', 'nonbinary', 'unknown')),
  height_cm             INTEGER,       -- stored metric; UI accepts imperial and converts
  weight_kg             NUMERIC(5,1),  -- stored metric; UI accepts imperial and converts
  physical_description  TEXT,
  photo_urls            TEXT[] DEFAULT '{}',
  is_primary            BOOLEAN NOT NULL DEFAULT false,
  last_known_point      GEOMETRY(Point, 4326),
  last_seen_at          TIMESTAMPTZ,
  clothing_description  TEXT,
  subject_type          TEXT CHECK (subject_type IN (
                          'hiker', 'hunter', 'child', 'dementia_patient',
                          'despondent', 'climber', 'skier', 'other'
                        )),
  -- PHI fields — DISABLED AT MVP (see migration header comment)
  medical_notes         TEXT,
  medications           TEXT,
  known_conditions      TEXT,
  -- PII (not PHI) — restrict access at API layer
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  -- Outcome
  found_at              TIMESTAMPTZ,
  found_condition       TEXT CHECK (found_condition IN (
                          'alive_uninjured', 'alive_injured', 'deceased', 'not_found'
                        )),
  found_location        GEOMETRY(Point, 4326),
  deleted_at            TIMESTAMPTZ DEFAULT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incident_subjects_incident_id ON incident_subjects(incident_id);
CREATE INDEX idx_incident_subjects_organization_id ON incident_subjects(organization_id);
CREATE INDEX idx_incident_subjects_lkp ON incident_subjects USING GIST(last_known_point);
CREATE INDEX idx_incident_subjects_found_location ON incident_subjects USING GIST(found_location);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON incident_subjects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE incident_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_subjects_select_org_members"
  ON incident_subjects FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_subjects_insert_org_members"
  ON incident_subjects FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

CREATE POLICY "incident_subjects_update_org_members"
  ON incident_subjects FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()));
