# Prompt: Resolve Schema Gaps

You are helping me fix gaps in `database-schema.md` — the authoritative data model for my SAR SaaS platform. Every migration must match this document. Gaps here mean future migrations will be built against an incomplete model.

This is a **documentation-only session** — no code, no migrations. The output is an updated `database-schema.md`.

## Setup — Read These Files First:

1. `database-schema.md` — the file we're fixing
2. `claude-rules.md` — sections 4 (Architecture → Database), 5 (Security), 8 (Compliance)
3. `feature-list.md` — to verify schema supports all described features
4. `build-log.md` — last entry only (Session 7)

Do NOT execute the "What To Do Next Session" instruction. This is a design session, not a build session.

---

## Context

A design review found 6 schema gaps — missing columns, convention violations, and contradictions between the schema doc and the rules. These are all for tables and features that **already exist or are about to be built** (Feature 3 is next). Gaps for unbuilt features (notifications, billing, branding, user profiles) are deferred until those features are designed.

For each gap, present the situation and options. Wait for my decision before moving to the next.

**Important constraint:** Any schema changes decided here are documentation only. The actual migrations will be written in a future build session. Do NOT write SQL — just describe what the schema doc should say.

---

## Gap 1: Missing `deleted_at` on Multiple Tables

`claude-rules.md` Section 8 says: "Every entity must have a soft-delete (`deleted_at`) before a hard-delete path."

`database-schema.md` conventions say: "Soft deletes use `deleted_at TIMESTAMPTZ DEFAULT NULL` — never hard delete user or incident data."

Tables missing `deleted_at`:
- `incident_subjects`
- `incident_sectors`
- `incident_waypoints`
- `incident_tracks`
- `incident_flight_paths`
- `incident_resources`
- `ics_forms`
- `ics_form_versions`
- `notifications`

Some of these might be intentional omissions. For example:
- `incident_log` is append-only — `deleted_at` would be contradictory
- `audit_log` is append-only — same
- `incident_par_events` / `incident_par_responses` are arguably immutable records

Decision needed: For each table listed above — add `deleted_at`, or explicitly document why it's exempt? Should the schema doc have an "Exempt from soft-delete" note for append-only tables?

---

## Gap 2: Missing `organization_id` on `ics_form_versions`

Schema convention: "All tenant-scoped tables have `organization_id UUID NOT NULL REFERENCES organizations(id)`."

`ics_form_versions` has no `organization_id`. It joins to `ics_forms` via `form_id`, which has `organization_id`. But:
- RLS policies can't enforce org isolation directly on `ics_form_versions` without a join
- This is the only tenant-scoped table that violates the convention

Decision needed: Add `organization_id` to `ics_form_versions` (redundant but convention-compliant and RLS-friendly)? Or document this as an intentional exception?

---

## Gap 3: No `safety_briefing_acknowledged` Field for Volunteers

Feature 2b says volunteers check: "Agreement to terms and safety briefing acknowledgment."

The check-in form already has this checkbox in the UI, and the Zod schema validates it. But `incident_personnel` has no column to store whether the volunteer acknowledged the safety briefing. The acknowledgment is validated at submission time but not persisted.

For legal liability purposes, the IC needs proof that every volunteer was briefed.

Decision needed: Add a `safety_briefing_acknowledged BOOLEAN DEFAULT false` column to `incident_personnel`? Or is the fact of submission (the check-in record existing) sufficient as acknowledgment? Or should it be in the `metadata` JSONB on the `incident_log` entry?

---

## Gap 4: `audit_log.actor_email` Is PII in the Compliance Log

`claude-rules.md` Section 8 says: "No logging of PII. Server logs and error logs must never include user PII."

But `audit_log.actor_email` stores email addresses. The schema comment says: "denormalized in case user is deleted."

This is a direct contradiction. The rationale for the denormalization (preserving identity after deletion) is valid — but the rule forbids PII in logs.

Decision needed:
- Remove `actor_email` and rely solely on `actor_id`? (Risk: if user is deleted, we lose who performed the action.)
- Keep `actor_email` and update the rule to explicitly exempt the audit log? (Rationale: the audit log IS the compliance record — it needs to identify the actor.)
- Replace `actor_email` with a pseudonymous identifier? (e.g., a hash of the email.)
- Note: `incident_log.actor_name` has the same issue — denormalized name is PII.

---

## Gap 5: No Supabase Storage Bucket Structure Defined

The schema doc defines database tables but says nothing about file storage. Features that already reference storage URLs:
- `ics_forms.pdf_url` / `ics_form_versions.pdf_url` (Feature 5 — next after Feature 3)
- `organizations.logo_url` (exists in schema)
- `incident_waypoints.photo_urls` (exists in schema)

And upcoming features need storage:
- Feature 4: KML/KMZ/GPX file imports, drone flight logs
- Subject photos (identified as a feature gap, blocks Feature 3)

Currently these URL columns exist in the schema but no bucket structure, RLS policies, or naming conventions are defined.

Decision needed:
- Should `database-schema.md` include a "Storage Buckets" section?
- What buckets are needed? (One per content type? One per feature? One big bucket with path-based organization?)
- What are the RLS/access policies for each bucket?
- What are the file size limits?
- Or should this be deferred to a separate `storage_schema.md` document?

---

## Gap 6: `incident_personnel.volunteer_medical_notes` Has No HIPAA Annotation

`incident_subjects` has explicit HIPAA annotations in the schema doc:
```
-- HIPAA-scoped fields: visible only to IC and medical_officer roles
medical_notes     TEXT,
medications       TEXT,
known_conditions  TEXT,
```

But `incident_personnel.volunteer_medical_notes` stores medical info from walk-up volunteers ("Medical conditions or limitations relevant to deployment") with no HIPAA annotation, no API-layer filtering rule, and no access restriction beyond standard RLS.

If a volunteer writes "I have epilepsy" in the medical notes field, that's PHI. But any org member on the incident can read it via the standard personnel query.

**Note:** If the compliance session (prompt 03) already made a decision about PHI access logging or the HIPAA field access mechanism, reference that decision here rather than re-deciding.

Decision needed:
- Should `volunteer_medical_notes` be treated as HIPAA-scoped (same restrictions as subject medical data)?
- If yes, does the schema doc need the same annotation comment?
- Does the API need the same column-filtering approach planned for `incident_subjects`?
- Or is volunteer self-reported medical info in a different category than subject PHI? (Legally, it may be — the volunteer chose to disclose it for operational purposes, not as a patient.)

---

## Output Format

After we've resolved all 6 gaps, produce:
1. The complete updated `database-schema.md` — full file content with all changes applied
2. A summary of all decisions made for the build log
3. A list of migrations that will need to be written in future build sessions (table name, columns added/removed, reason)

Do NOT write any SQL or code. This is documentation only.
