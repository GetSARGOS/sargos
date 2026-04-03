# Prompt: Resolve Feature Gaps

You are helping me resolve feature gaps in my SAR SaaS platform before I continue building. This is a **design session only** — no code, no migrations, no components. The output is updated documentation.

## Setup — Read These Files First (in this order):

1. `CLAUDE.md`
2. `claude-rules.md`
3. `feature-list.md`
4. `database-schema.md`
5. `build-log.md` — last entry only (Session 7)

Do NOT execute the "What To Do Next Session" instruction. This is a design session, not a build session.

## Context

A design review identified feature gaps — things implied by existing features that haven't been designed yet. These are split into **7 gaps that block upcoming features** (Feature 3 and beyond) and **3 Feature 1 completion items** that are important but not blocking.

For the blocking gaps: present 2–3 options with trade-offs, work through them **one at a time**, and wait for my decision.

For the Feature 1 completion items: present them together at the end. These need feature descriptions written but don't block Feature 3.

---

## Blocking Gaps (discuss one at a time)

---

### Gap 1: Subject Information Is Under-Specified (Feature 3)

The feature list says subjects have "name, age, description, last known point, physical condition." The schema (`incident_subjects`) has more columns (clothing, gender, subject_type, emergency contacts, medical fields, found_condition). But critical field information is missing from both:

- **Subject photo** — arguably the single most important piece of information for field searchers. There is no column in the schema, no Supabase Storage bucket defined, and no upload flow described. Every SAR team distributes a subject photo at briefing.
- **Height and weight** — standard BOLO (Be On the Lookout) fields. Not in the schema.
- **Multiple subjects per incident** — the schema supports it (incident_subjects is many-to-one with incidents), but the feature list never describes the UX. Can the IC add 3 missing hikers? How are they listed? Is there a "primary subject"?
- **"Physical condition" at intake vs `found_condition` at resolution** — the feature list says "physical condition" is captured when adding a subject, but the schema only has `found_condition` (an enum for outcome). There's no column for the subject's condition *before* they're found (e.g., "diabetic, possibly disoriented, wearing a red jacket" as a structured field vs free-text `physical_description`).

Decisions needed:
- Add a photo? If yes, where does it go — a column (URL) on `incident_subjects`, or a separate `incident_subject_photos` table for multiple photos?
- Add height/weight?
- How should multi-subject UX work?
- Is `physical_description` (free text) sufficient for intake condition, or does it need a structured field?

---

### Gap 2: Operational Periods Have No Management Mechanism (Feature 3 + Feature 5)

Feature 5 (ICS Forms) says forms are "versioned per operational period." The `ics_forms` table has an `operational_period INTEGER` column. The `incidents` table has `operational_period_hours INTEGER DEFAULT 12`. But there is **no table, no API, and no UI** to manage operational periods.

Questions that have no answer today:
- Who creates a new operational period — the IC? The Planning Section Chief?
- Is it automatic (every N hours) or manual (a button)?
- What data is associated with a period? (start time, end time, objectives, weather snapshot, staffing changes)
- Does the incident log segment by period?
- When the IC generates an ICS 204 for "Period 2," how does the system know what Period 2's boundaries are?

Decision needed: Is this a new `operational_periods` table, or is it just an integer counter on the incident with no backing entity?

---

### Gap 3: Incident Hand-Off Is Under-Specified (Feature 3)

Feature 3 says: "Incident hand-off: transfer IC role to another member with log entry." That's one sentence for a complex workflow.

Decisions needed:
- Is the transfer instant (IC clicks "hand off to Jane" and it's done), or does Jane have to accept?
- What happens to the old IC's access level? Do they become a field member? An observer? Do they keep IC-level read access?
- Can a hand-off be reversed (the new IC hands back)?
- Is this just an update to `incident_command_structure` (relieve old IC, assign new IC), or is it a separate entity?
- Does a hand-off trigger a notification to all incident personnel?

---

### Gap 4: Overdue/Missing Member Alerts Have No Web Delivery Mechanism (Feature 2)

Feature 2 describes critical safety features:
- "Overdue field team alert — flag if a team has not checked in by their scheduled return time"
- "Missing member alert — IC can trigger a personnel search if a member is unaccounted for"

These depend on Feature 7 (Notifications), which lists Push via Expo (requires mobile app — Feature 10) and SMS via Twilio. But neither of those exists yet, and there's **no web-only alert mechanism defined**.

If an IC is running an incident from a laptop browser and a team is overdue, what happens? Today: nothing.

Decisions needed:
- Should the web app have its own alert mechanism independent of push/SMS? (Browser notifications? In-app banner? Audio alert? Flashing status on the personnel board?)
- What triggers "overdue"? (A scheduled return time on `incident_personnel`? A manual timer? A field on the sector assignment?)
- Is "missing member alert" a formal incident state change, or just a notification?
- Should these alerts be built as part of Feature 3 (incident lifecycle) with a simple in-app mechanism, deferring push/SMS to Feature 7?

---

### Gap 5: Subscription Tier Gating Is Completely Undefined (Feature 8)

Feature 8 says:
- Free: 1 active incident, 5 members, no ICS form export
- Volunteer: unlimited incidents, 25 members, all core features
- Professional: 75 members, all features, SOC 2
- Enterprise: contract pricing

But there is no design for **how enforcement works**:
- Where is the check performed? (API middleware that reads `subscriptions`? A React context? An RLS policy? All three?)
- What does the user see when they hit a limit? (A modal? A toast? A disabled button with tooltip? A dedicated upgrade page?)
- How are "active incidents" counted? (Does `planning` count? `suspended`?)
- What happens on subscription lapse? ("Graceful feature degradation" — what does that mean concretely? Read-only mode? Can they close active incidents?)
- When a member count exceeds the tier (e.g., downgrade from Professional to Volunteer with 40 members), what happens? Can existing members still log in?

Decision needed: Define the enforcement architecture and the user-facing behavior for each limit.

---

### Gap 6: Password Reset Flow Is Undefined (Feature 6)

Feature 6 lists "Password reset via email" as a requirement. The login page exists but has no "Forgot password?" link. Supabase provides `resetPasswordForEmail()` but the full flow needs design:

- Where does the user enter their email? (A dedicated `/forgot-password` page? A modal on the login page?)
- What does the reset email say?
- Where does the reset link go? (A `/reset-password` page with a new password form?)
- What happens after reset — auto-login, or redirect to login?
- Rate limiting on reset requests?

Decision needed: Write the feature description and identify which pages/components are needed.

---

### Gap 7: Incident-Scoped Visibility for Field Members Is Undefined (Feature 6)

Feature 6 says: "Incident-scoped visibility — field members only see their assigned incident, not all org incidents simultaneously."

This is a significant RLS and UI challenge:
- The current `incidents` RLS policy is "Org members can read" — that returns ALL org incidents.
- Restricting field members requires an RLS policy that joins through `incident_personnel` to check if the field member is checked in.
- But `organization_members.role` only has `org_admin` and `member` — there's no `field_member` role at the org level. Field roles are per-incident in `incident_command_structure`.
- The dashboard currently lists all org incidents. Would field members see a different dashboard?

Decisions needed:
- Who counts as a "field member" for visibility purposes? Is it anyone with `incident_role = 'field_member'`? Or anyone who isn't in `incident_command_structure` as IC/Ops/Planning/Logistics?
- Does this restriction apply to the API only, or also the dashboard UI?
- Is this an MVP requirement, or can it be deferred to post-MVP? (Most SAR teams are small enough that seeing all incidents isn't a security concern — it's more of a UX concern.)

---

## Feature 1 Completion Items (present together)

These three gaps are all Feature 1 (Organization & Team Management) sub-features that are described in the feature list but have no detailed design. They're important for Feature 1 completeness but **don't block Feature 3 or any other upcoming feature**. For each, write a full feature description for `feature-list.md`.

### C1: Member Invitations

The `organization_invites` table exists (migration 008). The feature list says "Member invitation via email with join link." No further detail exists.

Questions to answer in the feature description:
- Where does the Org Admin send invites? What does the invite email contain?
- What happens on click — existing account auto-joins? New user signs up first?
- Can invites be revoked or re-sent? What happens on expiry?

### C2: Team Management

The `teams` and `team_members` tables exist (migration 007). No API routes, forms, or UI exist.

Questions to answer:
- Where does team management live in the UI?
- Who can create/edit/delete teams?
- How are members added? Can a member be on multiple teams?
- Does the IC assign individuals or whole teams to sectors?

### C3: Member Directory

Feature 1 says "Member directory with contact info, certifications, and availability status." Nothing exists.

Questions to answer:
- Where does it live? What can members edit vs Org Admins?
- Is it searchable/filterable?
- Does availability auto-update based on incident assignment?

---

## Output Format

After we've resolved all gaps (7 blocking + 3 completion), produce:
1. A complete set of additions/edits to `feature-list.md` — exact text, with placement instructions
2. A complete set of additions/edits to `database-schema.md` — exact SQL and column definitions, if any schema changes were decided
3. A summary of all decisions made, formatted as a "Decisions" section suitable for appending to `build-log.md`

Do NOT write any code. This is documentation only.
