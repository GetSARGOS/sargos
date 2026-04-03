# SAR SaaS — Feature List
> Organized by build tier. MVP = ship in 3 months. Post-MVP = 3–12 months. Future = Year 2+.
> Features marked **[FULL]** get complete depth at that tier. Features marked **[LITE]** are functional but intentionally simplified and expanded later.

---

## Tier 1 — MVP (0–3 Months)

The goal of the MVP is one complete, trustworthy incident workflow. An IC must be able to open the app at callout, run the entire incident, and close it out — without touching another tool.

---

### Feature Dependency Map & Build Order

Features have cross-cutting dependencies that constrain build order. This map captures those constraints.

```
Feature 8a (Enforcement Infra) ─── no dependencies; build first or alongside Feature 3
  │
Feature 3 (Incident Lifecycle) ─── depends on 8a (tier checks on incident creation)
  │   delivers: command structure, subjects, log entries, op periods, closure flow
  │   triggers: QR token deactivation + personnel auto-checkout on close
  │
  ├── Feature 4 (Search Mapping) ─── depends on Feature 3 (incident with LKP/IPP)
  │     delivers: sector creation, sector-team assignment
  │
  └── Feature 5 (ICS Forms) ─── depends on Feature 3 + Feature 4
        requires: command structure, subjects, log, op periods (F3) + sectors (F4)
        delivers: multi-period form generation scoped to op period boundaries

Feature 8b (Stripe + Billing UI) ─── build last; all gated features already call checkTierAccess()
```

**Recommended build order for remaining MVP features:**

1. **Feature 8a** — Enforcement infrastructure (small; enables tier gating in everything after)
2. **Feature 3** — Incident Lifecycle (largest feature; unblocks Features 4 and 5)
3. **Feature 4** — Search Mapping (unblocks Feature 5's ICS 204 sector data)
4. **Feature 5** — ICS Forms (all prerequisites met)
5. **Feature 8b** — Stripe integration + billing UI (last — everything is already gated)

Features 1, 2, 2b, 6, 7, 9 have no ordering constraints from these dependencies (1/2/2b/6 already built; 7/9 are independent).

**Cross-cutting notes:**
- Feature 2 personnel board gains sector assignment display (read-only) after Feature 4 ships
- Feature 6 RBAC: `incident_personnel.incident_role` is the authoritative source for per-incident authorization; `incident_command_structure` is a historical record for ICS form auto-fill, not an authorization table
- Both tables are written to on role assignment (dual-write pattern)

---

### 1. Organization & Team Management [FULL]

The foundation everything else is built on. Must be solid before anything else ships.

- Organization creation and onboarding flow
- Org profile: name, region, unit type (SAR, fire, EMS, combined)
- Hierarchical structure: Organization → Teams → Members
- Member roles:
  - **Org Admin** — manages billing, members, and org settings
  - **Incident Commander (IC)** — full incident control
  - **Operations Section Chief** — resource and assignment management
  - **Logistics** — equipment and supply tracking
  - **Field Member** — view assignments, check in/out, update status
  - **Observer** — read-only access (for agency liaisons, family liaisons) **[POST-MVP: deferred. Observer role stays in schema enum but is not exposed in the UI role selector at MVP. ICs assign liaisons as Field Member. Proper Observer access boundaries (what data Observers can/cannot see, potential subtypes for agency vs family liaisons) will be defined after field feedback.]**
- Role assignment per incident, not just per org (a field member can be IC on a different incident)
- Soft member deactivation (preserves historical data)

#### Member Invitations

- Org Admin sends invites from the Member Directory page (`/settings/members`)
- Admin enters email + selects role (`org_admin` or `member`) → creates row in `organization_invites`
- System sends invite email via Resend with a join link: `/invite/[token]`
- **Existing Supabase account:** clicking the link auto-joins the org (creates `organization_members` row), redirects to `/dashboard`
- **No account:** clicking the link redirects to `/signup?invite=[token]`. After signup + email confirmation, the invite is auto-accepted and the user joins the org
- Invites expire after 7 days (schema: `expires_at`)
- Org Admin can **revoke** a pending invite or **resend** it (generates a new token, resets `expires_at`, sends a new email)
- Duplicate invite to same email for same org is rejected
- Rate limit: 20 invites per org per hour

#### Team Management

- Team management lives under `/settings/teams` (Org Admin only)
- **Create team:** name, type (ground, k9, swift_water, etc.), description
- **Edit/delete team:** Org Admin can rename, change type, or soft-delete
- **Add members to teams:** searchable member dropdown. A member can be on multiple teams.
- **Team lead:** one member per team can be designated `role_in_team = 'lead'`
- **Remove member from team:** hard delete from `team_members` (junction table, no soft-delete per schema)
- **Incident assignment:** when the IC assigns personnel to a sector, they can assign individuals OR select a team (which assigns all team members at once). Individual assignment remains the default. Team assignment is a convenience shortcut.
- Teams are org-level, not incident-level — the same "K9 Unit" persists across incidents

#### Member Directory

- Member directory lives at `/settings/members` (same page as invite management)
- **All org members** see the directory (read access). **Org Admins** can edit any member's record. **Members** can edit their own record (display name, phone, certifications, availability).
- Members **cannot** change their own role (must be done by Org Admin)
- **Searchable** by name, **filterable** by role, availability, team, and certification
- **Availability status:** members self-manage (`available`, `unavailable`, `on_call`). Does NOT auto-update based on incident assignment — availability reflects general readiness, not current deployment.
- **Certifications:** displayed as badges. Filterable (e.g., "show me all members with Swift Water certification")
- **Deactivation:** Org Admin can deactivate a member (`is_active = false`). Deactivated members are hidden from the directory by default but can be shown via a "Show inactive" toggle. Deactivated members cannot log in or be assigned to incidents.

---

### 2. Real-Time Resource & Team Tracking [FULL]

**Priority 1. This is the feature that wins teams over.**

#### Personnel Tracking
- Live personnel status board — all members on an incident visible in one view
- Status options per member: Available, Assigned, In Field, Resting, Injured, Stood Down, Missing
- Assignment display: which team/sector each member is assigned to
- Check-in / check-out with timestamp (critical for accountability)
- Last known location timestamp (manual update from field, not GPS tracking)
- Quick-assign: drag member from available pool to a team or sector

#### Equipment & Resource Tracking
- Resource inventory per org: vehicles, radios, ropes, medical kits, etc.
- Resource status: Available, Deployed, Out of Service, Requested
- Resource assignment to an incident with check-out / check-in tracking
- Low-stock and out-of-service flagging
- Resource request log (what was requested, by whom, when fulfilled)

#### Sector Assignment Display
- **Depends on Feature 4:** Once sectors are created on the map (Feature 4), the personnel board displays which sector each person is assigned to (read-only from `assigned_sector_id`). Before Feature 4, the sector column is absent — team assignment is the only grouping.

#### Real-Time Sync
- All status changes propagate live to all connected users on the incident
- No page refresh required — Supabase Realtime powers the board
- Optimistic UI updates with rollback on failure
- Reconnection handling — board stays accurate if connection drops and restores

#### Accountability & Safety
- Personnel accountability report (PAR) — one-tap roll call that records who confirmed safe at a given time
- **Overdue field team alert:** IC sets `expected_return_at` per person during sector assignment. Client-side polling (60-second interval) checks for overdue personnel. When triggered: persistent red banner on the incident board (cannot be dismissed without action), audio chime via Web Audio API, and Browser Notifications API alert when the tab is backgrounded. Push/SMS delivery added with Feature 7.
- **Missing member alert:** IC sets a person's status to `missing` on the personnel board. Triggers the same alert mechanism (red banner + audio chime + browser notification) plus an `incident_log` entry and notification to all incident personnel. `missing` is a formal status on `incident_personnel` — distinct from other statuses because it represents an emergency, not a routine state.

---

### 2b. Spontaneous Volunteer QR Check-In [FULL]

**This feature eliminates one of the most painful manual tasks in field operations — processing walk-up volunteers.**

- Every active incident automatically generates a unique QR code
- IC can display or print the QR code at the staging area
- Any person scans the QR code with their native phone camera — no app download required
- Scan opens a mobile-optimized public web form capturing:
  - Full name and contact number
  - Any relevant certifications (Wilderness First Aid, Swift Water, K9 Handler, etc.)
  - Vehicle description and plate (for staging area management)
  - Medical conditions or limitations relevant to deployment
  - Agreement to terms and safety briefing acknowledgment
- On submission, the volunteer appears instantly on the IC's resource board as an **Unaffiliated Volunteer** — visually distinct from org members
- IC can assign, track, and check out unaffiliated volunteers exactly like org members for the duration of the incident
- Unaffiliated volunteer data is stored in the incident record for accountability and ICS 211 auto-fill
- QR code expires automatically when the incident is closed — scanning after closure shows a clear "incident closed" message
- IC can regenerate the QR code at any time (e.g., if it was shared beyond the staging area)
- All QR check-in data feeds directly into ICS 211 (Check-In/Check-Out List) automatically

---

### 3. Incident Lifecycle Management [FULL]

#### Pre-Requisite: Incident Board Tabbed Navigation

Before building Feature 3 content, convert the incident board (`/incidents/[id]`) from a vertically stacked layout to a tabbed layout. As the incident board grows across Features 2–5, a single scrolling page becomes unusable for ICs — especially in field conditions. This is a layout-only change: no new data, no new API routes.

**Tab structure (designed to accommodate all MVP features):**
- **Overview** — incident summary, command structure assignment, subject information, and incident status controls (suspend, close, hand-off). This is the primary landing tab and receives all Feature 3 content.
- **Personnel** — personnel status board, inline role assignment, check-out, and PAR roll call panel. Consolidates what is currently stacked on the page.
- **Resources** — resource/equipment board and QR check-in panel. Consolidates what is currently stacked on the page.
- **Map** — Mapbox search map, sector drawing and assignment, waypoints, and track overlays. Receives all Feature 4 (Search Mapping) content.
- **Forms** — ICS form review-and-export UI. Receives all Feature 5 (ICS Form Auto-Fill) content.
- **Log** — chronological, timestamped incident log with IC narrative entry form. Receives the incident log viewer built in this feature.

**Implementation notes:**
- Use the shadcn `Tabs` component (`npx shadcn@latest add tabs`) — it is Radix-based and keyboard navigable.
- Active tab persists in the URL query string (`?tab=personnel`) so the IC's view survives a page refresh and can be deep-linked from notifications.
- Each tab renders its panel only when active (lazy mount) to avoid unnecessary Supabase Realtime subscriptions on inactive tabs.
- The Personnel and Resources tabs keep their existing Realtime subscriptions active even when not focused — accountability board must stay current in the background.

---

#### Feature 3 Content

- Create new incident with: name, type, location (lat/lng + address), date/time, initial description
- Incident types: Lost Person, Overdue Hiker, Technical Rescue, Flood/Swift Water, Avalanche, Structure Collapse, Mutual Aid, Training
- Incident status: Planning, Active, Suspended, Closed
  - **Planning status [POST-MVP]:** The `planning` value exists in the schema enum but has no UI at MVP. All incidents are created as `active`. The planning toggle (for pre-planned operations, scheduled training exercises) and pre-assignment features will be added post-MVP after field feedback confirms the need. `planning` + `active` both count toward tier limits.
- Incident command structure assignment (who is IC, Ops, Logistics for this incident)
- Incident log — chronological, timestamped, immutable record of all actions and notes
- Add narrative entries to the log manually (IC notes, situation updates)
- Automatic log entries for key system events (member check-in, resource deployed, status change)
- **Subject information:** name, age, gender, physical description (free text), clothing description, subject type (hiker, child, dementia patient, etc.), last known point (LKP), last seen time, emergency contact name/phone
  - **Subject photos:** `photo_urls TEXT[]` on `incident_subjects` — multiple photos per subject (briefing photo, recent photo, found-condition photo). Stored in `photos` bucket at `{org_id}/{incident_id}/subjects/{subject_id}-{timestamp}.jpg`
  - **Height and weight:** `height_cm INTEGER`, `weight_kg NUMERIC(5,1)` stored in metric. UI accepts either metric or imperial and converts on save. BOLO descriptions generated from stored data.
  - **Multiple subjects per incident:** supported via the `incident_subjects` table (many-to-one with incidents). Subjects listed as cards on the Overview tab. `is_primary BOOLEAN DEFAULT false` designates the primary subject — used for ICS 209 auto-fill. First subject added is auto-set as primary. IC can change primary at any time.
  - **Intake condition:** captured via `physical_description` (free text). No structured enum — intake condition is inherently narrative ("diabetic, disoriented, wearing red jacket"). `found_condition` (enum) covers outcome at resolution.
- Subject medical notes (HIPAA-scoped — visible to IC and Medical roles only) **[POST-MVP: disabled at MVP. Requires HIPAA infrastructure (Supabase Team + BAA + field-level encryption + PHI access logging) before enabling. Access mechanism: separate `/medical` API endpoint (not column filtering on existing endpoint) — see claude-rules.md Section 8.]**
- **Operational period management:** lightweight `operational_periods` table with `period_number`, `starts_at`, `ends_at`, `objectives`, `weather_summary`, `created_by`. IC or Planning Section Chief clicks "Start New Period" on the Overview tab — system creates a new row, closes the previous period's `ends_at`, increments `incidents.current_operational_period`. ICS 202 auto-fills from `objectives`. ICS 204 knows time boundaries. Incident log filters by period using `starts_at`/`ends_at` boundaries. The `operational_period_hours` on `incidents` shows a suggested duration, but the IC decides when to transition.
- **Incident hand-off:** instant transfer — IC clicks "Hand Off to [member]" with a confirmation dialog. The dialog includes a dropdown for the outgoing IC's new role: Field Member, Observer, or Stood Down. On confirm: old IC's `incident_command_structure` row gets `relieved_at = now()`, new IC row inserted, both `incident_personnel.incident_role` fields updated, `incident_log` entry written ("IC transferred from [old] to [new]"), `audit_log` entry written, and all incident personnel notified (in-app at MVP, push/SMS with Feature 7). No acceptance step — SAR hand-offs happen face-to-face; the system records what already happened verbally. No undo — if the new IC wants to give it back, they execute another hand-off.
- Incident suspension with resume capability
- Incident closure with after-action summary field
- Incident archive — closed incidents are read-only but fully searchable

#### On Incident Close Checklist
When an incident is closed, the closure logic must perform all of the following in a single transaction:
1. Set `incidents.status = 'closed'` and `incidents.closed_at = now()`
2. Deactivate all active QR tokens: `UPDATE incident_qr_tokens SET is_active = false WHERE incident_id = $1 AND is_active = true`
3. Auto-checkout all remaining personnel: `UPDATE incident_personnel SET checked_out_at = now() WHERE incident_id = $1 AND checked_out_at IS NULL`
4. Write `incident_log` entry: "Incident closed by [actor name]"
5. Write `audit_log` entry: `action = 'incident.closed'`
6. Notify all incident personnel (in-app at MVP; push/SMS with Feature 7)

---

### 4. Search Mapping & Sector Planning [LITE at MVP, FULL at Post-MVP]

At MVP, teams get a functional map with the core planning tools. Advanced probability modeling and full sector analysis comes Post-MVP.

> **Ownership note:** Sector creation (polygon drawing) and sector-to-team assignment are Feature 4 deliverables. The personnel board (Feature 2) displays sector assignments read-only once sectors exist.

#### Base Mapping (MVP)
- Interactive map powered by Mapbox GL JS
- Basemap options: Topographic, Satellite, Street, Hybrid
- Last Known Point (LKP) pin — placed at incident creation, editable by IC
- Planning Point / Initial Planning Point (IPP) marker
- Draw search sectors (polygons) with label and color coding
- Assign a team to a sector directly from the map
- Sector status: Unassigned, Assigned, In Progress, Completed, Suspended
- Waypoint markers with notes (camps, hazards, access points, water sources)
- Track lines — manually plot a search track on the map
- Export map view as PNG for briefing use
- Offline tile caching for the incident area — download before deployment

#### CalTopo / KMZ Import (MVP)
- Import KMZ / KML files — teams migrating from CalTopo can bring their planning data in
- Import GPX tracks from GPS devices and phones

#### Drone & Aircraft Flight Path Tracking (MVP)
This feature directly supports the thoroughness verification workflow used by the team this product was designed with.

- **Drone flight path import** — import flight logs exported from drone software (DJI, Autel, Skydio) as KML/GPX/CSV. Rendered as a flight track overlay on the incident map with timestamp data
- Drone flight coverage area calculated and displayed as a shaded polygon — shows the IC what ground was actually observed from the air
- **Aircraft tracking overlay** — integrate with ADS-B flight tracking data (via ADS-B Exchange or similar open feed) to display real-time and historical flight paths of aircraft over the incident area. This includes law enforcement helicopters, air ambulances, and other search aircraft
- Filter aircraft tracks by time window (e.g., "show all flights over this area during the last 6 hours")
- Aircraft tracks saved to the incident record as a permanent coverage log
- Combined drone + aircraft coverage view — IC can visually verify which areas received aerial observation and which did not
- Coverage layers toggle on/off independently from other map layers
- All flight path data exportable as KML for agency reporting

---

### 5. ICS Form Auto-Fill & PDF Export [LITE at MVP]

> **Prerequisites:** Feature 3 (command structure, subjects, log data, operational periods) and Feature 4 (sector data for ICS 204). Feature 2 data (personnel, resources) is already available. All forms are scoped to a specific operational period — multi-period form generation is required at MVP.

At MVP, the five most critical forms are supported. Data captured in features 1–4 auto-populates the forms. Teams review, finalize, and export.

#### Forms Supported at MVP
- **ICS 201** — Incident Briefing: auto-populated from incident name, type, location, command structure, and initial log entries
- **ICS 204** — Assignment List: auto-populated from team assignments and sector data
- **ICS 211** — Check-In/Check-Out List: auto-populated from personnel tracking data
- **ICS 209** — Incident Status Summary: auto-populated from incident data, subject info, and resource counts
- **ICS 206** — Medical Plan: manually completed with medical officer guidance; subject medical notes feed in where appropriate

#### Form Behavior
- Forms open in a review-and-edit UI before export — auto-fill is a starting point, not a final document
- Export to PDF via React-PDF
- Forms are versioned per operational period — a new ICS 204 can be generated for each period
- Exported PDFs are saved to incident record in Supabase Storage
- Forms are printable for teams that need paper copies in the field

---

### 6. Authentication & Access Control [FULL]

- Email + password sign-up and login via Supabase Auth
- Email verification on sign-up
- **Password reset flow:**
  - Login page has a "Forgot password?" link → navigates to `/forgot-password`
  - `/forgot-password`: email input form. On submit → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`. Rate limited: 3 requests per email per hour via Upstash.
  - Supabase sends reset email (Resend in production, Supabase SMTP in dev)
  - User clicks link → lands on `/reset-password` with Supabase recovery token in URL
  - `/reset-password`: new password + confirm password form. On submit → `supabase.auth.updateUser({ password })`
  - On success → redirect to `/login` with toast: "Password updated. Sign in with your new password." No auto-login — forces the user to confirm the new credentials work.
  - Zod schemas: `ForgotPasswordSchema` (email required), `ResetPasswordSchema` (password + confirm, min 8 chars)
- Persistent sessions with automatic token refresh
- Role-based access enforced at both API and database (RLS) level
- Org-scoped access — a member of Org A cannot see anything from Org B

#### RBAC Authorization Model

Two role systems serve different scopes:

- **`organization_members.role`** — org-level authorization. Values: `org_admin`, `member`. Controls: billing, member management, team management, org settings.
- **`incident_personnel.incident_role`** — per-incident authorization (source of truth). Controls: all incident-scoped actions (PAR, QR tokens, role assignment, subject editing, closure, hand-off).
- **`incident_command_structure`** — historical record only, NOT an authorization table. Tracks who held each ICS role and when (`assigned_at` / `relieved_at`). Used for ICS 201 and ICS 203 auto-fill.

On role assignment, both `incident_command_structure` (historical record) and `incident_personnel.incident_role` (live authorization) are written to (dual-write pattern).

#### Permissions Matrix

| Action | Required Role |
|---|---|
| Manage billing, members, teams, org settings | `org_admin` |
| Create incident | Any active org member |
| Initiate PAR | `incident_commander` |
| Create / regenerate QR token | `incident_commander` |
| Hand off IC role | `incident_commander` |
| Close / suspend incident | `incident_commander` |
| Start new operational period | `incident_commander`, `planning_section_chief` |
| Assign personnel to sectors | `incident_commander`, `operations_section_chief` |
| Manage deployed resources | `incident_commander`, `operations_section_chief`, `logistics_section_chief` |
| Edit subject info | `incident_commander`, `planning_section_chief` |
| Add narrative log entry | Any incident personnel |
| View incident data | Any incident personnel (at MVP: all org members see all incidents) |
- Incident-scoped visibility **[POST-MVP]:** configurable per-org setting (`restrict_incident_visibility BOOLEAN DEFAULT false` on `organizations`). When enabled, non-command members see only incidents they are assigned to via `incident_personnel`. Command staff (IC, Ops Chief, Planning Chief, Logistics Chief, Safety Officer on any incident) see all org incidents. When disabled (default), all org members see all incidents — appropriate for small teams. At MVP, all members see all incidents. Implementation: API-layer filtering at MVP; migrate to RLS + API (belt and suspenders) post-MVP.

---

### 7. Notifications [LITE at MVP]

- Push notifications via Expo Push (mobile) for:
  - Incident callout (new incident created, member invited)
  - Assignment change (you have been assigned to Sector 3)
  - PAR roll call request
  - Overdue team alert (IC only)
- SMS via Twilio for:
  - Incident callout only — the one notification that must reach people who may not have the app open
- In-app notification center for all notification history
- User notification preferences (enable/disable push and SMS per category)

---

### 8a. Billing Enforcement Infrastructure [FULL]

Build early (before or alongside Feature 3). This is the enforcement layer that every feature calls to check tier access. It does not require Stripe — every org starts on Free tier.

- `checkTierAccess(orgId, action)` utility function — queries `subscriptions` table, returns `{ allowed, reason, limit, current, tier }`
- `SubscriptionContext` provider — loads tier + limits on app init, exposes `canDo(action)` for client-side UI gating (cosmetic only — API is the enforcement layer)
- Tier constants file defining what each tier gets (see Tier Matrix below)
- API helper that wraps the check — returns HTTP 403 with `{ error: "seat_limit_reached", limit, current, tier }`
- Every org gets a `subscriptions` row seeded on org creation (Free tier, active status)
- Retrofit enforcement into existing API routes (Features 1, 2, 2b) when 8a is built

#### Tier Matrix

| Capability | Free | Team | Enterprise |
|---|---|---|---|
| Org member seats | 5 | seat_cap (admin-configured) | unlimited |
| Active incidents (`planning` + `active`) | 1 | unlimited | unlimited |
| ICS form PDF export | No | Yes | Yes |
| Incident history retention | 90 days | unlimited | unlimited |
| Org branding (color + logo) | No | Yes | Yes |
| Audit log viewer | No | Yes | Yes |
| Push/SMS notifications (Feature 7) | No | Yes | Yes |
| Walk-up volunteers (QR check-in) | unlimited | unlimited | unlimited |
| Email support | No | Yes (48hr SLA) | Yes (4hr SLA) |
| API access | No | No | Yes |

---

### 8b. Stripe Integration & Billing UI [FULL]

Build last — after all MVP features are complete and already calling `checkTierAccess()`.

#### Pricing Model

Per-seat pricing with configurable seat count. Walk-up volunteers (QR check-in) are always unlimited on all tiers — never gate volunteer check-in during an active search.

- **Free** — $0. 5 org member seats, 1 active incident (`planning` + `active` count), no ICS form PDF export, 90-day incident history retention, no org branding, no audit log viewer. For evaluation only.
- **Team** — $6/seat/month billed annually ($72/seat/year) or $8/seat/month billed monthly. Minimum 6 seats. Org Admin configures a seat cap — auto-scales below the cap (members added freely), requires admin to raise the cap above it. Billed for actual member count, not the cap. Unlimited active incidents, unlimited incident history, ICS form PDF export, org branding (color + logo), audit log viewer, push/SMS notifications (Feature 7), email support (48hr SLA). At 15 seats: $1,080/year (44% above CalTopo's $750/yr for 5-6x the functionality, 80% below D4H's $5,300/yr).
- **Enterprise** — Contract pricing, no public rate. Targets state agencies, federal entities, and multi-county coordination bodies requiring FedRAMP authorization, SAML/SSO, white-labeling, or on-premise deployment. All Enterprise contracts are negotiated directly. Starting contracts in the $50,000–$250,000/year range. Unlimited seats, dedicated support (4hr SLA), SOC 2 attestation, API access.

**Compliance milestones (not visible to users — internal roadmap):**
- SOC 2 Type I: target at ~50-75 paying teams (~$60-90K ARR). Use Sprinto/Drata.
- SOC 2 Type II: target at ~100-150 teams (~$120-180K ARR). Unlocks institutional buyers.
- HIPAA: target at ~150-200 teams (~$180-240K ARR). Supabase Team + BAA. Enables subject medical fields.
- FedRAMP 20x Moderate: target at ~300-500 teams (~$360-600K ARR). AWS GovCloud migration. Enables federal contracts.

#### Enforcement Architecture

- **API enforcement (source of truth):** every mutation route checks seat count, active incident count, and feature access against `subscriptions` + `organizations` before proceeding. Returns HTTP 403 with clear error: `{ error: "seat_limit_reached", limit: 5, current: 5, tier: "free" }`
- **Client-side gating (cosmetic UX):** `SubscriptionContext` loads tier + limits on app init. UI proactively disables buttons, shows tooltips ("Upgrade to add more seats"), and hides gated features. Client is never the enforcement layer.
- **RLS stays clean:** authorization only, not billing. No subscription checks in RLS policies.

#### Subscription Lapse Behavior

- `past_due` or `canceled` → **read-only mode**. All data visible, all mutations return 403. Persistent banner: "Your subscription has lapsed. Update payment to restore access."
- Data is never deleted on lapse.
- If a team lapses mid-incident, they can still VIEW the personnel board and read logs — they just cannot modify anything.

#### Seat Count on Downgrade

- If a Team org cancels to Free with more than 5 members, **all existing members keep access**. No auto-deactivation — this is a life-safety platform. But no new members can be added until count drops below the Free limit. UI shows warning: "15/5 seats — remove members or upgrade."

#### Billing Infrastructure

- Stripe-powered subscription management via Stripe Billing
- Stripe Customer Portal for upgrade, downgrade, cancel, payment method update
- Org Admin is the billing owner
- Mid-cycle seat changes handled via Stripe prorated invoices
- Enterprise customers managed outside Stripe via direct invoicing
- Annual billing encouraged (lower Stripe fees: ~2.95% vs ~3.8% monthly). Consider offering 2 months free on annual plans.

---

### 9. Organization Branding & Theme [LITE at MVP, FULL at Post-MVP]

Every team has a identity. This feature lets them use it.

#### MVP (ships incrementally)
- **System / light / dark mode toggle** — available to all users immediately; respects OS preference by default; preference persists in localStorage
- **Application font** — replace the default system font with a typeface appropriate for emergency management and first responder use. Target fonts: IBM Plex Sans (used by FEMA and federal agencies, excellent legibility under stress) or Source Sans 3 (widely used in emergency management tooling). Implemented via `next/font/google` — a one-file change with no security or compliance risk. Apply globally across the application, including PDFs (via React-PDF font registration).
- **Default accent color: forest green** — replaces the grayscale default with a SAR-appropriate green across primary buttons, badges, and accents
- **Org color customization** — Org Admins can set a primary hex color for their organization
- Org color applied to: primary buttons, sidebar accent, status badge accents, and the org logo mark
- Member-facing views (incident board, check-in page) inherit the org's color
- Color is stored on the `organizations` table and served with the org profile

#### Post-MVP [FULL upgrade]
- Secondary/accent color picker (complementary color for backgrounds and subtle UI elements)
- Org logo upload — replaces the letter-mark in the nav and on PDFs
- Custom header color with auto-computed foreground color for legibility
- Dark mode variant of org colors (auto-computed from primary, or manually overridden)
- Theme preview before saving
- Color reset to SARGOS default

---

## Tier 2 — Post-MVP (3–12 Months)

Features that make the product significantly more powerful after the foundation is proven.

---

### 9. Advanced Search Planning [FULL upgrade from LITE]

- Probability of Area (POA) assignment per sector
- Probability of Detection (POD) tracking per completed sector
- Cumulative Probability of Success (POS) calculation across the search
- Search segment prioritization based on POA and terrain analysis
- Hasty search route suggestions based on LKP and terrain
- Lost Person Behavior (LPB) statistical profiles by subject type (hiker, dementia patient, child, etc.)
- Search theory documentation and operational period planning tools

### 10. Native Mobile App (Expo / React Native)

- Full feature parity with web for field-facing features
- Offline-first — full offline capability with background sync
- GPS location sharing (opt-in, IC-controlled, active incidents only)
- Push notification delivery
- Map interaction optimized for gloves and outdoor visibility
- Camera integration — attach photos to log entries and waypoints

### 11. Weather Integration

- Live weather overlay on the incident map (wind, precipitation, temperature)
- Hourly forecast for the incident area
- Automated weather alerts relevant to the operation (lightning, flash flood, wind advisory)
- Weather snapshot saved to incident record at key operational periods

### 12. Mutual Aid & Inter-Agency Coordination

- Mutual aid request workflow — request resources from another org in the platform
- Shared incident view — grant read-only access to a cooperating agency without full org membership
- Resource lending log between orgs
- Contact directory for regional agencies (Sheriff, NPS, USFS, EMS)

### 13. Training & Certification Management

- Member certification tracking (NASAR SARTECH, Wilderness First Aid, Swift Water, etc.)
- Certification expiry alerts
- Training exercise mode — run a full incident simulation without it appearing in operational records
- Training hour logging per member

### 14. After-Action Review (AAR) Tools

- Structured AAR template attached to each closed incident
- Timeline replay — scrub through the incident log chronologically with map state
- Metrics per incident: total personnel hours, search area covered, time to find (if applicable)
- AAR export to PDF for agency reporting

### 15. Additional ICS Forms

- **ICS 202** — Incident Objectives
- **ICS 203** — Organization Assignment List
- **ICS 205** — Incident Radio Communications Plan
- **ICS 213** — General Message
- **ICS 214** — Activity Log
- Custom form builder for agency-specific documentation requirements

### 16. Equipment Maintenance Tracking

- Maintenance schedule per equipment item
- Maintenance log with technician and date
- Out-of-service workflow with return-to-service sign-off
- Equipment inspection checklists (pre-deployment, post-deployment)

### 17. K9 Unit Management

K9 teams have documentation requirements that differ meaningfully from human resources. This feature treats each K9 as a tracked asset with its own record.

- K9 profile: name, breed, handler assignment, certification type (trailing, air scent, cadaver, water, avalanche), certifying body, and certification expiry
- Certification tracking with expiry alerts — mirrors the member certification system but scoped to the dog
- Deployment log per K9: date, incident, assigned sector, terrain type, weather conditions, hours worked
- Work/rest hour tracking per deployment — handlers are required to log this under NASAR and many state standards; the app enforces it automatically
- Alert log: record of any alerts, indications, or finds during a deployment with GPS coordinates and notes
- K9 medical notes: vaccinations, known health conditions, vet contact (scoped to handler and IC only)
- K9 availability status on the resource board — IC sees which dogs are available, deployed, or resting
- K9 deployment data feeds into ICS 204 (Assignment List) and the incident map (alert locations as waypoints)
- K9 history report exportable per dog for certification renewal documentation

---

## Tier 3 — Future / Year 2+ (Scaling to Federal & Global)

Features that support growth beyond volunteer teams into professional, state, and federal agencies.

---

### 17. Multi-Agency Coordination (MAC) Dashboard

- Unified command view across multiple organizations on a shared incident
- Resource pooling across agencies
- Unified ICS form generation for multi-agency incidents
- Role-based access across org boundaries for unified command incidents

### 18. CAD / Dispatch Integration

- Inbound CAD feed integration — auto-create incidents from dispatch alerts
- Integration targets: RapidSOS, Mark43, Tyler New World
- Two-way status sync between SAR platform and dispatch

### 19. Compliance & Audit Dashboard

- SOC 2 audit log viewer for Org Admins
- Data export for legal holds and FOIA requests
- HIPAA-compliant subject data handling with BAA support
- Configurable data retention policies per org

### 20. API & Integrations Platform

- Public REST API for agency integrations
- Webhook support for incident events
- CalTopo two-way sync
- Garmin inReach / SPOT integration for satellite tracker positions
- ArcGIS / ESRI data layer import

### 21. Analytics & Reporting

- Org-level dashboards: incidents per month, average response time, resource utilization
- Regional and state-level rollup reporting (for coordinating agencies)
- Export to formats required by FEMA and state emergency management agencies

### 22. White-Label & Government Deployment

- White-label option for state emergency management agencies
- FedRAMP Moderate authorized deployment on AWS GovCloud
- On-premise deployment option for federal customers
- SAML / SSO integration for government identity providers (CAC, PIV)

---

## Feature Count Summary

| Tier | Features | Target Timeline |
|---|---|---|
| MVP | 10 core feature groups (8 split into 8a + 8b) | Month 0–3 |
| Post-MVP | 9 expansion features | Month 3–12 |
| Future | 6 platform features | Year 2–5 |

---

*The MVP is designed so that every piece of data captured feeds the next feature. Personnel tracking feeds ICS forms. Sector assignments feed the map. The map feeds After-Action. Build the data model right in Month 1 and every subsequent feature is mostly a new UI on top of data you already have.*