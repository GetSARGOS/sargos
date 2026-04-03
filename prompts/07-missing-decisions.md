# Prompt: Resolve Missing Architectural Decisions

You are helping me make architectural decisions that have been deferred or left ambiguous in my SAR SaaS platform. These are decisions where the feature list or rules are vague enough that building could go multiple ways — and choosing wrong would mean rework.

This is a **documentation-only session** — no code, no migrations. The output is updated documentation and an architectural decision record.

## Setup — Read These Files First:

1. `claude-rules.md` — for the constraints that shape each decision
2. `feature-list.md` — for the features these decisions affect
3. `database-schema.md` — for the data model implications
4. `build-log.md` — last entry only (Session 7)

Do NOT execute the "What To Do Next Session" instruction. This is a design session, not a build session.

**Important:** This is prompt 07 of 07 in the design review series. Earlier prompts may have already resolved related decisions:
- Prompt 03 (Compliance) covers HIPAA BAA, PHI encryption, and PHI access logging
- Prompt 04 (Schema) covers volunteer medical notes HIPAA annotation and storage buckets
- Prompt 01 (Rules) covers file storage rules and rate limiting

If a decision below was already made in an earlier session, reference that decision rather than re-deciding. Ask me if you're unsure.

---

## Context

A design review found 8 architectural decisions that are missing or ambiguous. Each one will be encountered during upcoming build sessions. Making these decisions now, documented, prevents mid-session pivots and rework.

For each decision, I need you to:
1. Explain why a decision is needed now
2. Present 2–3 concrete options with trade-offs
3. Ask me which option I want
4. After I decide, document it in the appropriate file

Work through them **one at a time**.

---

## Decision 1: Pagination Pattern

`claude-rules.md` Section 6 says: "No query may return an unbounded result set. All list endpoints must support cursor-based or offset pagination with a maximum page size."

But no pagination has been implemented yet. Every list endpoint (`GET /api/incidents`, `GET /api/incidents/[id]/personnel`) returns all rows. This works while the dataset is small but violates the rules.

Decisions needed:
- **Cursor-based or offset pagination?** Cursor is better for real-time data (incident log, personnel board) but harder to implement. Offset is simpler but has known issues with concurrent inserts.
- **Default page size?** 25? 50? 100? Should it differ per endpoint?
- **Response shape:** The `{ data, error, meta }` pattern exists but `meta` has no defined pagination sub-shape. What does `meta.pagination` look like? (`{ page, pageSize, total, hasMore }` for offset? `{ cursor, hasMore }` for cursor?)
- **Shared utility:** Should there be a shared pagination utility in `/lib` that all API routes use, or is it inline per route?
- Where should the pagination contract be documented — `claude-rules.md`, `database-schema.md`, or a new `api_conventions.md`?

---

## Decision 2: Timezone Display Strategy

All timestamps in the database are `TIMESTAMPTZ` (stored as UTC). But SAR incidents happen in specific timezones, and the IC needs to see local time — "Team Alpha checked in at 14:32 PST," not "Team Alpha checked in at 22:32 UTC."

Currently the app displays raw timestamps with no timezone conversion. This will be confusing once real operations start.

Decisions needed:
- **Where does the timezone come from?**
  - The incident itself (a `timezone` column on `incidents`)? This makes sense because an incident happens in one location.
  - The organization (a `timezone` column on `organizations`)? Simpler but wrong for orgs that operate across time zones.
  - The user's browser (via `Intl.DateTimeFormat().resolvedOptions().timeZone`)? Easy but inconsistent — two users in different timezones would see different times for the same event.
- **Is timezone conversion a client-side or server-side concern?** (Client is simpler — just format with the timezone. Server means the API returns localized strings.)
- **What format for timestamps?** ISO 8601 always from the API, formatted client-side? Or a project-wide date format constant?

---

## Decision 3: Session Expiry for Field Operations

`claude-rules.md` Section 8 says: "Auth sessions must have a defined expiry. Supabase session tokens must be refreshed automatically. Stale sessions must redirect to login."

Supabase default: 1-hour access token, auto-refreshed via refresh token (refresh tokens last longer, configurable). But:
- A field team might lose cell service for 4+ hours in a canyon
- A command post laptop might be idle for 2 hours during a slow phase
- The mobile app (Feature 10) needs to survive overnight with no connectivity

If the access token expires and the refresh token can't reach Supabase, the user is locked out. For a life-safety platform, "please log in again" during an active search is unacceptable.

Decisions needed:
- **What should the access token lifetime be?** (1 hour default? 24 hours? Longer?)
- **What should the refresh token lifetime be?** (Supabase default is 1 week. Should it be longer for SAR use?)
- **What happens when both tokens expire?** (Force re-login? Auto-retry on reconnection? Cache the session locally?)
- **Does offline mode (Feature 10) need its own auth strategy?** (e.g., pin-based local access that re-authenticates when connectivity returns)

---

## Decision 4: Error Code Registry

API routes use typed error codes (e.g., `ORG_SLUG_TAKEN`, `INCIDENT_NOT_FOUND`, `INVALID_QR_TOKEN`). But each feature invents its own codes with no central registry. This causes:
- Inconsistent naming (is it `NOT_FOUND` or `INCIDENT_NOT_FOUND`? `UNAUTHORIZED` or `FORBIDDEN`?)
- Client-side error handling can't reliably switch on error codes
- No documentation of what codes exist

Decisions needed:
- **Should there be a centralized error code registry?** (A file like `/constants/error-codes.ts` or a section in `claude-rules.md`)
- **What's the naming convention?** (`RESOURCE_ACTION` like `INCIDENT_NOT_FOUND`? Or `domain.code` like `incidents.not_found`?)
- **Should error codes be enums, string constants, or a Zod union?**
- **Do HTTP status codes map 1:1 to error codes, or can multiple error codes share a status?** (e.g., both `ORG_SLUG_TAKEN` and `MEMBER_ALREADY_EXISTS` return 409)

---

## Decision 5: File Upload Size Limits

**Cross-reference:** Prompt 01 (Gap 7) may have established file storage rules. Prompt 04 (Gap 5) may have defined storage buckets. If limits were already decided there, confirm or adjust here.

No decision exists on file upload limits. Upcoming features need uploads:
- Feature 4: KML/KMZ files (typically 1–50 MB for complex maps)
- Feature 4: GPX tracks (typically 100 KB – 10 MB)
- Feature 4: Drone flight logs (CSV/KML, 1–100 MB for long flights)
- Feature 5: ICS form PDFs (generated, typically < 1 MB)
- Future: Subject photos (typically 2–10 MB each)
- Future: Org logos (typically < 2 MB)

Supabase Storage has a configurable max file size (default 50 MB on free tier).

Decisions needed:
- **What are the per-type limits?** (Different limits for KML vs photos vs PDFs?)
- **Is there a global max?** (e.g., 100 MB per file regardless of type)
- **Where are limits enforced?** (Client-side validation? API route? Supabase Storage config? All three?)
- **What's the content-type validation strategy?** (Accept any file extension? Validate MIME type? Validate magic bytes?)
- Where should limits be documented — `claude-rules.md`, `database-schema.md`, or the storage section?

---

## Decision 6: HIPAA Field Access Mechanism

**Cross-reference:** Prompt 03 (Gaps 2–3) may have decided on PHI encryption and access logging. Prompt 04 (Gap 6) may have decided on volunteer medical notes HIPAA scope. If the access mechanism was already chosen, confirm or refine here.

Session 0 (Build Log) flagged this as a known issue: "HIPAA-scoped fields in `incident_subjects` require column-level filtering at the API layer since PostgreSQL RLS cannot filter individual columns natively."

The plan mentioned "a separate RPC or view." Seven sessions later, no decision has been made. Feature 3 (which adds subject info to the UI) needs this resolved.

The HIPAA-scoped columns are:
- `incident_subjects.medical_notes`
- `incident_subjects.medications`
- `incident_subjects.known_conditions`
- `incident_subjects.emergency_contact_name`
- `incident_subjects.emergency_contact_phone`
- (Plus `incident_personnel.volunteer_medical_notes` — identified in schema gaps)

Decisions needed:
- **Option A: Two API endpoints.** `GET /api/incidents/[id]/subjects` returns non-HIPAA fields for all personnel. `GET /api/incidents/[id]/subjects/[subjectId]/medical` returns HIPAA fields for IC and medical_officer only. Clean separation, simple RLS.
- **Option B: PostgreSQL view.** Create a `incident_subjects_public` view that excludes HIPAA columns. RLS on the base table stays as-is. The view is what non-medical roles query.
- **Option C: API-layer column filtering.** One endpoint, one query, but the API strips HIPAA columns from the response based on the caller's role. Simplest to build, hardest to audit.
- Which approach? This blocks Feature 3.

---

## Decision 7: Observer Role Access Boundaries

Feature 1 says Observer is "read-only access (for agency liaisons, family liaisons)." But no one has defined what "read-only" means in scope.

Can an Observer see:
- The incident overview (name, type, status)? Almost certainly yes.
- The personnel board (who's assigned where)? Probably yes.
- Subject information (name, description)? Maybe — depends on the observer type.
- Subject medical notes? Almost certainly no.
- The full map with sectors and tracks? Probably yes.
- The incident log? Maybe — some entries may be sensitive.
- ICS forms? Depends on the form.
- The audit log? No — that's org admin only.

Without boundaries, the first RLS policy written for Observers will set a precedent that's hard to change.

Decisions needed:
- **What can Observers see?** Define it now, per-feature.
- **Are there Observer subtypes?** (Agency liaison vs family liaison have very different access needs. A sheriff's deputy should see the full picture. A subject's family member should see almost nothing.)
- **Is this an MVP concern, or can Observer access be deferred?** (If no Observers are used until post-MVP, the RLS policies can be written later.)

---

## Decision 8: Planning Status for Incidents

Feature 3 defines incident statuses: Planning, Active, Suspended, Closed.

Session 4 decided: "Incident creation sets status to 'active' immediately." This was pragmatic — field operations start immediately.

But the `planning` status still exists in the schema enum. Questions with no answers:
- Can a user create an incident in `planning` status? (e.g., a training exercise scheduled for next week)
- Can an incident go from `active` back to `planning`? (Probably not — that doesn't make sense.)
- Does `planning` count as "active" for subscription tier limits? (Free tier = 1 active incident)
- Does a `planning` incident show on the dashboard the same way as an `active` one?
- Can personnel check in to a `planning` incident?

Decision needed: Define the `planning` status lifecycle, or remove it from the enum if it's not needed.

---

## Output Format

After we've resolved all 8 decisions, produce:
1. Updates to `claude-rules.md` — any new rules or conventions
2. Updates to `feature-list.md` — any clarified feature behavior
3. Updates to `database-schema.md` — any schema annotations or column changes
4. A new or updated conventions document if one was decided (e.g., `api_conventions.md`, error code registry)
5. A summary of all decisions made for the build log

Do NOT write any code. This is documentation only.
