# Prompt: Resolve Feature Interaction Gaps

You are helping me document cross-feature dependencies in my SAR SaaS platform. These are places where features depend on each other in ways that aren't documented — ordering constraints, shared data flows, and implicit prerequisites that will cause problems if built in the wrong sequence.

This is a **documentation-only session** — no code, no migrations. The output is updated documentation and a dependency map.

## Setup — Read These Files First:

1. `feature-list.md` — the primary subject
2. `database-schema.md` — to verify data flow between features
3. `claude-rules.md` — for architecture constraints that affect feature interactions
4. `build-log.md` — last entry only (Session 7)

Do NOT execute the "What To Do Next Session" instruction. This is a design session, not a build session.

---

## Context

A design review found 6 interaction gaps — features that depend on each other in ways not documented in `feature-list.md`. Without documenting these, a build session could start Feature 5 before Feature 3 is done and discover halfway through that the data it needs doesn't exist yet.

For each gap, I need you to:
1. Explain the dependency clearly
2. Identify which feature must come first
3. Propose how to document this in `feature-list.md` (dependency note, prerequisite section, or build order annotation)
4. Ask if I agree or want to restructure

Work through them **one at a time**.

---

## Gap 1: Feature 5 (ICS Forms) Is Blocked by Feature 3 (Incident Lifecycle)

Feature 5 says ICS forms auto-populate from existing data:
- **ICS 201** (Incident Briefing): "auto-populated from incident name, type, location, **command structure**, and initial log entries"
- **ICS 209** (Incident Status Summary): "auto-populated from incident data, **subject info**, and resource counts"
- **ICS 206** (Medical Plan): "**subject medical notes** feed in where appropriate"

But Feature 3 is what adds:
- Command structure assignment UI
- Subject information (name, age, LKP, medical notes)
- Incident log narrative entries

Without Feature 3, the ICS forms would have empty sections for command structure, subjects, and log-based briefing data. Feature 5 could be partially built (ICS 211 from personnel data, ICS 204 from team assignments), but 3 of the 5 MVP forms depend on Feature 3 data.

Decision needed:
- Is Feature 5 explicitly blocked by Feature 3? Or can a partial Feature 5 (ICS 211 + ICS 204 only) be built independently?
- Should `feature-list.md` annotate this dependency?

---

## Gap 2: Feature 4 (Mapping) and Feature 2 (Personnel) Have a Circular Dependency on Sectors

Feature 2 (Personnel Tracking) has `incident_personnel.assigned_sector_id` referencing `incident_sectors`. The feature list says: "Assignment display: which team/sector each member is assigned to."

But sectors are drawn on the map in Feature 4 (Search Mapping). The `incident_sectors` table exists (migration 012), but no UI to create sectors exists because the map hasn't been built.

So:
- Feature 2 wants to assign personnel to sectors → but sectors don't exist until Feature 4
- Feature 4 wants to assign teams to sectors on the map → but team/personnel assignment is Feature 2

Currently the personnel board has team assignment but no sector assignment. This is fine for now, but when should sector assignment be added — when Feature 4 is built, or retroactively into Feature 2?

Decision needed:
- Is sector assignment a Feature 4 deliverable or a Feature 2 enhancement?
- Should the feature list make this explicit?

---

## Gap 3: Feature 3 (Incident Closure) Must Deactivate Feature 2b (QR Tokens)

Feature 2b says: "QR code expires automatically when the incident is closed — scanning after closure shows a clear 'incident closed' message."

The `lookup_qr_token` RPC already filters `i.status != 'closed'`, so scanning a closed incident's QR code returns no results. But the `incident_qr_tokens.is_active` flag is NOT automatically set to `false` when an incident closes.

This means:
- The QR code functionally stops working (because the RPC filters by incident status) — good
- But the QR token record still says `is_active = true` — misleading in the database
- The QR panel on a closed incident would still show the token as "active" — confusing UI

When Feature 3 builds the incident closure flow, it needs to also deactivate all active QR tokens for that incident.

Decision needed:
- Should incident closure explicitly deactivate QR tokens (UPDATE `is_active = false`)?
- Is this documented as a Feature 3 requirement, or a cross-cutting concern?
- Should there be a general "on incident close" checklist in the feature list?

---

## Gap 4: Operational Periods Connect Feature 3 and Feature 5

ICS forms are keyed by `(incident_id, form_type, operational_period)`. Feature 5 says forms are "versioned per operational period — a new ICS 204 can be generated for each period."

But operational period management is a Feature 3 concept (incident lifecycle). Feature 3 doesn't currently describe how periods are managed.

The data flow is:
1. Feature 3 defines operational periods (start/end times, period number)
2. Feature 5 generates forms scoped to each period
3. The period boundary determines which personnel, resources, and log entries feed into each form

Without period management in Feature 3, Feature 5 can only generate forms for "period 1" (the entire incident as one blob). Multi-period ICS form generation requires Feature 3 to define the period mechanism first.

Decision needed:
- Is operational period management part of Feature 3, Feature 5, or its own sub-feature?
- Should the feature list explicitly state that multi-period form generation is blocked until period management is built?
- Is single-period form generation acceptable for MVP?

---

## Gap 5: Feature 1 (Org Roles) vs Feature 6 (RBAC) — Which Table Is Authoritative?

Feature 1 defines roles: IC, Ops Section Chief, Logistics, Field Member, Observer. Feature 6 says: "Role-based access enforced at both API and database (RLS) level."

But the schema has TWO role systems:
- `organization_members.role` — only `org_admin` and `member` (org-level)
- `incident_command_structure.ics_role` — IC, Ops, Planning, Logistics, etc. (per-incident)
- `incident_personnel.incident_role` — same ICS role set (per-incident, on the personnel record)

RLS policies need to know: when checking if someone can initiate a PAR, do you check `organization_members.role`, `incident_command_structure.ics_role`, or `incident_personnel.incident_role`?

Currently, IC-only actions (PAR initiation, QR token creation) are enforced "at the API layer" with a comment that RBAC will be tightened later. But "later" needs a design.

Decision needed:
- Which table is the source of truth for per-incident authorization?
- Should `incident_command_structure` and `incident_personnel.incident_role` be reconciled? (Currently both can say someone is IC — is that intentional?)
- Should the feature list document the RBAC model explicitly — which role can do what?
- Should a permissions matrix be added to the docs?

---

## Gap 6: Feature 8 (Billing) Is a Cross-Cutting Concern Affecting Every Feature

Feature 8 defines tier limits:
- Free: 1 active incident, 5 members, no ICS export
- Volunteer: unlimited incidents, 25 members
- Professional: 75 members
- Enterprise: unlimited

But there's no architecture for enforcement. Every feature needs to:
- Check the org's subscription tier before allowing gated actions
- Display appropriate UI when a limit is reached
- Handle downgrades gracefully (40 members on a Volunteer plan)

This isn't a feature dependency — it's an infrastructure dependency. The enforcement middleware/utility needs to exist BEFORE Feature 8 (billing UI) is built, and every existing feature needs to be retroactively gated.

Decision needed:
- Should Feature 8 be split into two parts? (8a: enforcement infrastructure, 8b: Stripe integration and billing UI)
- Which features are gated at which tier? (The feature list mentions a few but not all.)
- Should the feature list include a "Tier Matrix" — a table showing which features are available at each tier?
- At what point in the build sequence should enforcement be added? (Before Feature 3? After all MVP features? As a hardening pass?)

---

## Output Format

After we've resolved all 6 gaps, produce:
1. A **feature dependency map** — a simple list showing which features block which others, suitable for adding to `feature-list.md`
2. Updates to `feature-list.md` — dependency annotations, prerequisite notes, or restructured feature descriptions
3. A **recommended build order** for the remaining MVP features, based on the dependencies identified
4. A summary of all decisions made for the build log

Do NOT write any code. This is documentation only.
