# SAR SaaS — Database Schema
> This document is the authoritative data model for the platform. Claude Code must reference this before creating any migration, table, or query. Never invent a table or column that is not defined here. If a feature requires a schema change, document it here before implementing it.
>
> All tables use PostgreSQL via Supabase with the PostGIS extension enabled.

---

## Conventions

- All primary keys are `UUID` using `gen_random_uuid()` as default
- All tables have `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- All mutable tables have `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` maintained by a trigger
- All tenant-scoped tables have `organization_id UUID NOT NULL REFERENCES organizations(id)`
- Soft deletes use `deleted_at TIMESTAMPTZ DEFAULT NULL` — never hard delete user or incident data
- Geographic coordinates use PostGIS `GEOMETRY(Point, 4326)` — always EPSG:4326 (WGS84)
- Geographic polygons use PostGIS `GEOMETRY(Polygon, 4326)`
- All geometry columns have a GIST index
- All foreign key columns have a btree index
- Snake_case for all table and column names
- Row Level Security (RLS) is enabled on every table — policies defined per table below

---

## Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search on names and logs
```

---

## Schema Overview

```
organizations
  └── organization_members
  └── teams
        └── team_members
  └── resources (equipment inventory)
  └── incidents
        ├── incident_command_structure
        ├── incident_log
        ├── incident_subjects
        ├── incident_personnel (includes unaffiliated volunteers)
        ├── incident_resources
        ├── incident_sectors
        ├── incident_waypoints
        ├── incident_tracks (GPX/manual)
        ├── incident_flight_paths (drone + aircraft)
        ├── incident_qr_tokens
        ├── incident_par_events
        ├── ics_forms
        └── ics_form_versions
  └── k9_units
        └── k9_deployments
  └── notifications
  └── audit_log
  └── subscriptions
```

---

## Tables

---

### `organizations`

The top-level tenant. Every piece of data is scoped to an organization.

```sql
CREATE TABLE organizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE, -- URL-safe identifier e.g. "king-county-sar"
  unit_type         TEXT NOT NULL CHECK (unit_type IN (
                      'sar', 'fire', 'ems', 'law_enforcement', 'combined', 'other'
                    )),
  region            TEXT,
  state             TEXT,
  country           TEXT NOT NULL DEFAULT 'US',
  contact_email     TEXT,
  contact_phone     TEXT,
  logo_url          TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN (
                      'free', 'volunteer', 'professional', 'enterprise'
                    )),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN (
                      'active', 'past_due', 'canceled', 'trialing'
                    )),
  stripe_customer_id  TEXT UNIQUE,
  max_members       INTEGER NOT NULL DEFAULT 5, -- enforced by tier
  deleted_at        TIMESTAMPTZ DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS Policies:**
- `SELECT`: Members of the organization can read their own org record
- `UPDATE`: Org Admins only
- `INSERT`: Public (during onboarding flow) — immediately restricted after creation
- `DELETE`: Disabled — use `deleted_at`

**Indexes:**
```sql
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);
```

---

### `organization_members`

Joins users to organizations with an org-level role. A user can belong to multiple organizations.

```sql
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN (
                    'org_admin', 'member'
                  )),
  display_name    TEXT NOT NULL,
  phone           TEXT,
  certifications  TEXT[] DEFAULT '{}', -- e.g. ['SARTECH_II', 'WFA', 'Swift_Water_Rescue']
  availability    TEXT NOT NULL DEFAULT 'available' CHECK (availability IN (
                    'available', 'unavailable', 'on_call'
                  )),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
```

**RLS Policies:**
- `SELECT`: Members of the same organization
- `INSERT`: Org Admins, or the user themselves via invite token
- `UPDATE`: Org Admins, or the member themselves (own record only, cannot change own role)
- `DELETE`: Disabled — use `is_active = false` and `deleted_at`

**Indexes:**
```sql
CREATE INDEX idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);
```

---

### `teams`

Sub-groups within an organization (e.g. "K9 Unit", "Swift Water Team").

```sql
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  team_type       TEXT CHECK (team_type IN (
                    'ground', 'k9', 'swift_water', 'technical_rescue',
                    'air', 'medical', 'logistics', 'command', 'other'
                  )),
  description     TEXT,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS Policies:**
- `SELECT`: Members of the organization
- `INSERT/UPDATE`: Org Admins
- `DELETE`: Disabled — use `deleted_at`

**Indexes:**
```sql
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
```

---

### `team_members`

Assigns org members to teams. Many-to-many.

```sql
CREATE TABLE team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  role_in_team    TEXT DEFAULT 'member' CHECK (role_in_team IN ('lead', 'member')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, member_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_member_id ON team_members(member_id);
CREATE INDEX idx_team_members_organization_id ON team_members(organization_id);
```

---

### `organization_invites`

Tracks pending email invitations to join an organization.

```sql
CREATE TABLE organization_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('org_admin', 'member')),
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      UUID NOT NULL REFERENCES organization_members(id),
  accepted_at     TIMESTAMPTZ DEFAULT NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_org_invites_token ON organization_invites(token);
CREATE INDEX idx_org_invites_organization_id ON organization_invites(organization_id);
CREATE INDEX idx_org_invites_email ON organization_invites(email);
```

---

### `resources`

Org-level equipment and resource inventory.

```sql
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
```

**Indexes:**
```sql
CREATE INDEX idx_resources_organization_id ON resources(organization_id);
CREATE INDEX idx_resources_status ON resources(organization_id, status);
```

---

### `incidents`

The central record for every search and rescue operation.

```sql
CREATE TABLE incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  incident_number   TEXT, -- agency-assigned number if applicable
  incident_type     TEXT NOT NULL CHECK (incident_type IN (
                      'lost_person', 'overdue_hiker', 'technical_rescue',
                      'swift_water', 'avalanche', 'structure_collapse',
                      'mutual_aid', 'training', 'other'
                    )),
  status            TEXT NOT NULL DEFAULT 'planning' CHECK (status IN (
                      'planning', 'active', 'suspended', 'closed'
                    )),
  location_address  TEXT,
  location_point    GEOMETRY(Point, 4326), -- incident origin / staging area
  lkp_point         GEOMETRY(Point, 4326), -- Last Known Point
  ipp_point         GEOMETRY(Point, 4326), -- Initial Planning Point
  started_at        TIMESTAMPTZ,
  suspended_at      TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  after_action_notes TEXT,
  operational_period_hours INTEGER NOT NULL DEFAULT 12, -- default op period length
  deleted_at        TIMESTAMPTZ DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS Policies:**
- `SELECT`: Org members — field members see only incidents they are assigned to
- `INSERT`: Org Admins and members with IC role (enforced at API layer)
- `UPDATE`: IC and above for this incident
- `DELETE`: Disabled — use `deleted_at`

**Indexes:**
```sql
CREATE INDEX idx_incidents_organization_id ON incidents(organization_id);
CREATE INDEX idx_incidents_status ON incidents(organization_id, status);
CREATE GIST INDEX idx_incidents_location_point ON incidents USING GIST(location_point);
CREATE GIST INDEX idx_incidents_lkp_point ON incidents USING GIST(lkp_point);
```

---

### `incident_command_structure`

Tracks who holds each ICS role for a given incident. Roles are per-incident, not per-org.

```sql
CREATE TABLE incident_command_structure (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id       UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  ics_role        TEXT NOT NULL CHECK (ics_role IN (
                    'incident_commander', 'deputy_ic', 'safety_officer',
                    'public_information_officer', 'liaison_officer',
                    'operations_section_chief', 'planning_section_chief',
                    'logistics_section_chief', 'finance_section_chief',
                    'medical_officer', 'observer'
                  )),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  relieved_at     TIMESTAMPTZ DEFAULT NULL, -- null = currently active in role
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_incident_command_incident_id ON incident_command_structure(incident_id);
CREATE INDEX idx_incident_command_member_id ON incident_command_structure(member_id);
CREATE INDEX idx_incident_command_organization_id ON incident_command_structure(organization_id);
```

---

### `incident_subjects`

The subject(s) of the search. HIPAA-sensitive — access strictly controlled.

```sql
CREATE TABLE incident_subjects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  age               INTEGER,
  gender            TEXT CHECK (gender IN ('male', 'female', 'nonbinary', 'unknown')),
  physical_description TEXT,
  last_known_point  GEOMETRY(Point, 4326),
  last_seen_at      TIMESTAMPTZ,
  clothing_description TEXT,
  subject_type      TEXT CHECK (subject_type IN (
                      'hiker', 'hunter', 'child', 'dementia_patient',
                      'despondent', 'climber', 'skier', 'other'
                    )),
  -- HIPAA-scoped fields: visible only to IC and medical_officer roles
  medical_notes     TEXT,
  medications       TEXT,
  known_conditions  TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  -- Outcome
  found_at          TIMESTAMPTZ,
  found_condition   TEXT CHECK (found_condition IN (
                      'alive_uninjured', 'alive_injured', 'deceased', 'not_found'
                    )),
  found_location    GEOMETRY(Point, 4326),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS Policies:**
- `SELECT` (non-HIPAA fields): All incident personnel
- `SELECT` (HIPAA fields: medical_notes, medications, known_conditions, emergency_contact_*): IC and medical_officer roles only — enforced at API layer with column-level filtering. Do not expose these columns in default queries.
- `INSERT/UPDATE`: IC and medical_officer roles only

**Indexes:**
```sql
CREATE INDEX idx_incident_subjects_incident_id ON incident_subjects(incident_id);
CREATE INDEX idx_incident_subjects_organization_id ON incident_subjects(organization_id);
CREATE GIST INDEX idx_incident_subjects_lkp ON incident_subjects USING GIST(last_known_point);
```

---

### `incident_personnel`

Everyone on an incident — org members and unaffiliated walk-up volunteers. This is the source of truth for the resource board and ICS 211.

```sql
CREATE TABLE incident_personnel (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Org member (null if unaffiliated volunteer)
  member_id         UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  -- Unaffiliated volunteer fields (null if org member)
  volunteer_name    TEXT,
  volunteer_phone   TEXT,
  volunteer_certifications TEXT[] DEFAULT '{}',
  volunteer_vehicle TEXT,
  volunteer_medical_notes TEXT,
  -- Common fields
  personnel_type    TEXT NOT NULL CHECK (personnel_type IN ('member', 'volunteer')),
  checkin_method    TEXT NOT NULL CHECK (checkin_method IN ('manual', 'qr_scan', 'app')),
  checked_in_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at    TIMESTAMPTZ DEFAULT NULL,
  status            TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
                      'available', 'assigned', 'in_field', 'resting', 'injured', 'stood_down'
                    )),
  -- Incident-level role (overrides org role for this incident)
  incident_role     TEXT CHECK (incident_role IN (
                      'incident_commander', 'deputy_ic', 'safety_officer',
                      'public_information_officer', 'liaison_officer',
                      'operations_section_chief', 'planning_section_chief',
                      'logistics_section_chief', 'finance_section_chief',
                      'medical_officer', 'field_member', 'observer'
                    )),
  -- Assignment
  assigned_sector_id UUID REFERENCES incident_sectors(id) ON DELETE SET NULL,
  assigned_team_id   UUID REFERENCES teams(id) ON DELETE SET NULL,
  last_checked_in_at TIMESTAMPTZ, -- last PAR confirmation
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_incident_personnel_incident_id ON incident_personnel(incident_id);
CREATE INDEX idx_incident_personnel_member_id ON incident_personnel(member_id);
CREATE INDEX idx_incident_personnel_organization_id ON incident_personnel(organization_id);
CREATE INDEX idx_incident_personnel_status ON incident_personnel(incident_id, status);
```

---

### `incident_qr_tokens`

Manages the QR code check-in tokens for each incident.

```sql
CREATE TABLE incident_qr_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  scans           INTEGER NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES organization_members(id),
  expires_at      TIMESTAMPTZ, -- null = expires when incident closes
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS Policies:**
- `SELECT`: Org members on the incident
- `INSERT`: IC and above
- `UPDATE` (is_active, expires_at): IC and above
- Public token lookup: one narrow RPC function only — `lookup_qr_token(token TEXT)` — returns only `incident_id` and `is_active`. No other data exposed publicly.

**Indexes:**
```sql
CREATE INDEX idx_qr_tokens_token ON incident_qr_tokens(token);
CREATE INDEX idx_qr_tokens_incident_id ON incident_qr_tokens(incident_id);
```

---

### `incident_log`

Immutable chronological record of everything that happens during an incident. Never updated or deleted.

```sql
CREATE TABLE incident_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
                    'narrative',        -- manual IC note
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
  metadata        JSONB DEFAULT '{}', -- structured data for the entry type
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at — this table is append-only
);
```

**RLS Policies:**
- `SELECT`: All incident personnel
- `INSERT`: System and authenticated incident personnel — via RPC only, never direct insert
- `UPDATE`: Disabled entirely
- `DELETE`: Disabled entirely

**Indexes:**
```sql
CREATE INDEX idx_incident_log_incident_id ON incident_log(incident_id, created_at DESC);
CREATE INDEX idx_incident_log_organization_id ON incident_log(organization_id);
CREATE INDEX idx_incident_log_entry_type ON incident_log(incident_id, entry_type);
```

---

### `incident_sectors`

Search sectors drawn on the map. Each sector is a polygon with assignment and status.

```sql
CREATE TABLE incident_sectors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL, -- e.g. "Sector Alpha", "Sector 3"
  boundary        GEOMETRY(Polygon, 4326) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN (
                    'unassigned', 'assigned', 'in_progress', 'completed', 'suspended'
                  )),
  color           TEXT DEFAULT '#3B82F6', -- hex color for map display
  assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  priority        INTEGER DEFAULT 0, -- higher = higher priority
  -- Post-MVP probability fields (nullable at MVP)
  poa             NUMERIC(5,4) CHECK (poa BETWEEN 0 AND 1), -- Probability of Area
  pod             NUMERIC(5,4) CHECK (pod BETWEEN 0 AND 1), -- Probability of Detection
  pos             NUMERIC(5,4) CHECK (pos BETWEEN 0 AND 1), -- Probability of Success
  terrain_type    TEXT,
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_incident_sectors_incident_id ON incident_sectors(incident_id);
CREATE INDEX idx_incident_sectors_organization_id ON incident_sectors(organization_id);
CREATE GIST INDEX idx_incident_sectors_boundary ON incident_sectors USING GIST(boundary);
```

---

### `incident_waypoints`

Point markers on the incident map — camps, hazards, water sources, evidence, etc.

```sql
CREATE TABLE incident_waypoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  waypoint_type   TEXT NOT NULL CHECK (waypoint_type IN (
                    'camp', 'hazard', 'access_point', 'water_source',
                    'evidence', 'k9_alert', 'find', 'helicopter_lz', 'other'
                  )),
  location        GEOMETRY(Point, 4326) NOT NULL,
  notes           TEXT,
  photo_urls      TEXT[] DEFAULT '{}',
  created_by      UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_incident_waypoints_incident_id ON incident_waypoints(incident_id);
CREATE GIST INDEX idx_incident_waypoints_location ON incident_waypoints USING GIST(location);
```

---

### `incident_tracks`

Line geometries on the map — search tracks, routes, paths plotted manually or imported from GPX.

```sql
CREATE TABLE incident_tracks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  track_type      TEXT NOT NULL CHECK (track_type IN (
                    'search_track', 'route', 'gpx_import', 'manual'
                  )),
  path            GEOMETRY(LineString, 4326) NOT NULL,
  assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  recorded_at     TIMESTAMPTZ, -- when the track was recorded (not imported)
  source_filename TEXT, -- original GPX file name if imported
  notes           TEXT,
  created_by      UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_incident_tracks_incident_id ON incident_tracks(incident_id);
CREATE GIST INDEX idx_incident_tracks_path ON incident_tracks USING GIST(path);
```

---

### `incident_flight_paths`

Drone and aircraft flight paths overlaid on the incident map.

```sql
CREATE TABLE incident_flight_paths (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flight_type     TEXT NOT NULL CHECK (flight_type IN ('drone', 'aircraft')),
  source          TEXT NOT NULL CHECK (source IN (
                    'import',    -- uploaded file (drone logs, KML)
                    'adsb_live', -- live ADS-B feed
                    'adsb_historical' -- historical ADS-B query
                  )),
  aircraft_identifier TEXT, -- tail number, call sign, or drone serial
  aircraft_type   TEXT, -- e.g. "DJI Mavic 3", "Bell 407", "AS350"
  operator_name   TEXT,
  path            GEOMETRY(LineString, 4326) NOT NULL,
  coverage_area   GEOMETRY(Polygon, 4326), -- calculated coverage footprint for drones
  altitude_m      NUMERIC, -- average altitude in meters
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  source_filename TEXT, -- original file if imported
  raw_data        JSONB DEFAULT '{}', -- original telemetry data preserved
  notes           TEXT,
  created_by      UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_flight_paths_incident_id ON incident_flight_paths(incident_id);
CREATE INDEX idx_flight_paths_flight_type ON incident_flight_paths(incident_id, flight_type);
CREATE GIST INDEX idx_flight_paths_path ON incident_flight_paths USING GIST(path);
CREATE GIST INDEX idx_flight_paths_coverage ON incident_flight_paths USING GIST(coverage_area);
```

---

### `incident_resources`

Tracks which org resources are checked out to an incident.

```sql
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
```

**Indexes:**
```sql
CREATE INDEX idx_incident_resources_incident_id ON incident_resources(incident_id);
CREATE INDEX idx_incident_resources_resource_id ON incident_resources(resource_id);
CREATE INDEX idx_incident_resources_organization_id ON incident_resources(organization_id);
```

---

### `incident_par_events`

Personnel Accountability Report (PAR) roll calls. Each PAR is a timestamped event with per-person responses.

```sql
CREATE TABLE incident_par_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiated_by    UUID NOT NULL REFERENCES organization_members(id),
  initiated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  total_personnel INTEGER NOT NULL,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  unaccounted_ids UUID[] DEFAULT '{}', -- personnel IDs who did not respond
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incident_par_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  par_event_id    UUID NOT NULL REFERENCES incident_par_events(id) ON DELETE CASCADE,
  personnel_id    UUID NOT NULL REFERENCES incident_personnel(id) ON DELETE CASCADE,
  confirmed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_safe  BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT
);
```

**Indexes:**
```sql
CREATE INDEX idx_par_events_incident_id ON incident_par_events(incident_id);
CREATE INDEX idx_par_responses_par_event_id ON incident_par_responses(par_event_id);
```

---

### `ics_forms`

Stores generated ICS form data. One record per form type per incident. Versioned via `ics_form_versions`.

```sql
CREATE TABLE ics_forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_type       TEXT NOT NULL CHECK (form_type IN (
                    'ICS_201', 'ICS_202', 'ICS_203', 'ICS_204',
                    'ICS_205', 'ICS_206', 'ICS_209', 'ICS_211',
                    'ICS_213', 'ICS_214'
                  )),
  operational_period INTEGER NOT NULL DEFAULT 1,
  current_version INTEGER NOT NULL DEFAULT 1,
  form_data       JSONB NOT NULL DEFAULT '{}', -- the structured form field data
  created_by      UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  last_exported_at TIMESTAMPTZ,
  pdf_url         TEXT, -- Supabase Storage URL of most recent export
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id, form_type, operational_period)
);

CREATE TABLE ics_form_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         UUID NOT NULL REFERENCES ics_forms(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  form_data       JSONB NOT NULL,
  pdf_url         TEXT,
  exported_by     UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  exported_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_ics_forms_incident_id ON ics_forms(incident_id);
CREATE INDEX idx_ics_forms_organization_id ON ics_forms(organization_id);
CREATE INDEX idx_ics_form_versions_form_id ON ics_form_versions(form_id);
```

---

### `k9_units`

K9 asset records. Scoped to an organization.

```sql
CREATE TABLE k9_units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL, -- dog's name
  breed           TEXT,
  handler_id      UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  search_type     TEXT[] NOT NULL DEFAULT '{}' CHECK (
                    -- array must contain only valid values — enforced at API layer
                    -- valid values: 'trailing', 'air_scent', 'cadaver', 'water', 'avalanche', 'tracking'
                    cardinality(search_type) > 0
                  ),
  certifying_body TEXT, -- e.g. 'NASAR', 'FEMA', 'State OES'
  certification_level TEXT,
  certification_expires_at TIMESTAMPTZ,
  -- Medical (handler and IC only)
  vet_name        TEXT,
  vet_phone       TEXT,
  medical_notes   TEXT,
  vaccinations_current BOOLEAN DEFAULT true,
  vaccinations_expires_at TIMESTAMPTZ,
  -- Status
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
                    'available', 'deployed', 'resting', 'out_of_service', 'retired'
                  )),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_k9_units_organization_id ON k9_units(organization_id);
CREATE INDEX idx_k9_units_handler_id ON k9_units(handler_id);
```

---

### `k9_deployments`

Deployment log for each K9 on each incident. Source of truth for work/rest tracking and certification documentation.

```sql
CREATE TABLE k9_deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  k9_id           UUID NOT NULL REFERENCES k9_units(id) ON DELETE CASCADE,
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  handler_id      UUID NOT NULL REFERENCES organization_members(id),
  assigned_sector_id UUID REFERENCES incident_sectors(id) ON DELETE SET NULL,
  deployed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at     TIMESTAMPTZ,
  work_hours      NUMERIC GENERATED ALWAYS AS (
                    EXTRACT(EPOCH FROM (COALESCE(returned_at, now()) - deployed_at)) / 3600
                  ) STORED,
  terrain_type    TEXT,
  weather_conditions TEXT,
  -- Alert and find log
  alerts          JSONB DEFAULT '[]', -- array of {location: Point, timestamp, notes, alert_type}
  find_location   GEOMETRY(Point, 4326), -- if dog located subject
  found_at        TIMESTAMPTZ,
  -- Outcome
  result          TEXT CHECK (result IN (
                    'negative', 'alert_no_find', 'find', 'recalled', 'other'
                  )),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_k9_deployments_k9_id ON k9_deployments(k9_id);
CREATE INDEX idx_k9_deployments_incident_id ON k9_deployments(incident_id);
CREATE INDEX idx_k9_deployments_organization_id ON k9_deployments(organization_id);
CREATE GIST INDEX idx_k9_deployments_find_location ON k9_deployments USING GIST(find_location);
```

---

### `notifications`

Log of all notifications sent. Source of truth for the in-app notification center.

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  incident_id     UUID REFERENCES incidents(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN (
                    'incident_callout', 'assignment_change', 'par_request',
                    'overdue_alert', 'missing_member', 'system', 'billing'
                  )),
  channel         TEXT NOT NULL CHECK (channel IN ('push', 'sms', 'in_app')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  -- No PII in body — use IDs and generic descriptions only
  read_at         TIMESTAMPTZ DEFAULT NULL,
  sent_at         TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN (
                    'pending', 'sent', 'delivered', 'failed'
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_incident_id ON notifications(incident_id);
```

---

### `audit_log`

Immutable record of all sensitive actions. Required for SOC 2 and HIPAA. Insert-only — no updates, no deletes, ever.

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     TEXT, -- denormalized in case user is deleted
  action          TEXT NOT NULL, -- e.g. 'incident.created', 'member.role_changed', 'form.exported'
  resource_type   TEXT NOT NULL, -- e.g. 'incident', 'organization_member', 'ics_form'
  resource_id     UUID,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}', -- non-PII context about the action
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at — append only
);
```

**RLS Policies:**
- `SELECT`: Org Admins can see their org's audit records only
- `INSERT`: Via server-side RPC only — never direct client insert
- `UPDATE`: Disabled entirely
- `DELETE`: Disabled entirely

**Indexes:**
```sql
CREATE INDEX idx_audit_log_organization_id ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
```

---

### `subscriptions`

Mirrors Stripe subscription state for fast in-app access without hitting Stripe's API on every request.

```sql
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id       TEXT,
  tier                  TEXT NOT NULL CHECK (tier IN (
                          'free', 'volunteer', 'professional', 'enterprise'
                        )),
  status                TEXT NOT NULL CHECK (status IN (
                          'trialing', 'active', 'past_due', 'canceled', 'unpaid'
                        )),
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,
  trial_ends_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
```

---

## Triggers

Apply this trigger to all tables with `updated_at`:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each mutable table:
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Repeat for: organization_members, teams, team_members, resources, incidents,
-- incident_command_structure, incident_subjects, incident_personnel,
-- incident_sectors, incident_waypoints, incident_tracks, incident_flight_paths,
-- incident_resources, ics_forms, k9_units, k9_deployments,
-- notifications, subscriptions
```

---

## RPC Functions (Server-Side Only)

These functions run with elevated privileges and must never be callable directly by the client without going through a secured API route.

```sql
-- Safe QR token lookup for public check-in form
CREATE OR REPLACE FUNCTION lookup_qr_token(p_token TEXT)
RETURNS TABLE (incident_id UUID, is_active BOOLEAN, incident_name TEXT, organization_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT q.incident_id, q.is_active, i.name, o.name
  FROM incident_qr_tokens q
  JOIN incidents i ON i.id = q.incident_id
  JOIN organizations o ON o.id = i.organization_id
  WHERE q.token = p_token
    AND i.status != 'closed'
    AND i.deleted_at IS NULL;
END;
$$;
```

---

## Migration Order

When building migrations, always follow this dependency order:

1. `organizations`
2. `organization_members`
3. `teams`
4. `team_members`
5. `organization_invites`
6. `resources`
7. `incidents`
8. `incident_command_structure`
9. `incident_subjects`
10. `incident_sectors`
11. `incident_personnel`
12. `incident_qr_tokens`
13. `incident_log`
14. `incident_waypoints`
15. `incident_tracks`
16. `incident_flight_paths`
17. `incident_resources`
18. `incident_par_events` + `incident_par_responses`
19. `ics_forms` + `ics_form_versions`
20. `k9_units`
21. `k9_deployments`
22. `notifications`
23. `audit_log`
24. `subscriptions`
25. Triggers (applied last, after all tables exist)

---

## Key Design Decisions

**Why `incident_personnel` instead of reusing `organization_members`?**
Because unaffiliated walk-up volunteers captured via QR code are not org members. A single table handles both types cleanly, and it means ICS 211 (check-in list) has one authoritative source regardless of whether the person is an org member or a stranger who showed up with a flashlight.

**Why denormalize `actor_name` in `incident_log` and `actor_email` in `audit_log`?**
Users can be deactivated or deleted. The log must remain accurate even years later. Denormalizing the name and email at write time ensures historical records are always readable.

**Why JSONB for `form_data` in `ics_forms`?**
ICS forms have different field sets per form type. JSONB allows each form type to store its own structure without requiring a separate table per form. The form schema is validated at the API layer before storage.

**Why JSONB for `alerts` in `k9_deployments`?**
Alert events during a deployment are variable in number and are always read as a complete set. Storing them as a JSONB array avoids a separate `k9_alerts` table while still being queryable and indexable when needed.

**Why a `subscriptions` mirror table instead of querying Stripe directly?**
Stripe API calls add latency and failure risk to every page load that needs to check feature access. The mirror table is updated via Stripe webhooks and gives instant, reliable subscription state.