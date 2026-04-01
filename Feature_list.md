# SAR SaaS — Feature List
> Organized by build tier. MVP = ship in 3 months. Post-MVP = 3–12 months. Future = Year 2+.
> Features marked **[FULL]** get complete depth at that tier. Features marked **[LITE]** are functional but intentionally simplified and expanded later.

---

## Tier 1 — MVP (0–3 Months)

The goal of the MVP is one complete, trustworthy incident workflow. An IC must be able to open the app at callout, run the entire incident, and close it out — without touching another tool.

---

### 1. Organization & Team Management [FULL]

The foundation everything else is built on. Must be solid before anything else ships.

- Organization creation and onboarding flow
- Org profile: name, region, unit type (SAR, fire, EMS, combined)
- Hierarchical structure: Organization → Teams → Members
- Member invitation via email with join link
- Member roles:
  - **Org Admin** — manages billing, members, and org settings
  - **Incident Commander (IC)** — full incident control
  - **Operations Section Chief** — resource and assignment management
  - **Logistics** — equipment and supply tracking
  - **Field Member** — view assignments, check in/out, update status
  - **Observer** — read-only access (for agency liaisons, family liaisons)
- Role assignment per incident, not just per org (a field member can be IC on a different incident)
- Member directory with contact info, certifications, and availability status
- Team groupings within an org (e.g., "Swift Water Team", "K9 Unit", "Ground Pounder Alpha")
- Soft member deactivation (preserves historical data)

---

### 2. Real-Time Resource & Team Tracking [FULL]

**Priority 1. This is the feature that wins teams over.**

#### Personnel Tracking
- Live personnel status board — all members on an incident visible in one view
- Status options per member: Available, Assigned, In Field, Resting, Injured, Stood Down
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

#### Real-Time Sync
- All status changes propagate live to all connected users on the incident
- No page refresh required — Supabase Realtime powers the board
- Optimistic UI updates with rollback on failure
- Reconnection handling — board stays accurate if connection drops and restores

#### Accountability & Safety
- Personnel accountability report (PAR) — one-tap roll call that records who confirmed safe at a given time
- Overdue field team alert — flag if a team has not checked in by their scheduled return time
- Missing member alert — IC can trigger a personnel search if a member is unaccounted for

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
- Incident command structure assignment (who is IC, Ops, Logistics for this incident)
- Incident log — chronological, timestamped, immutable record of all actions and notes
- Add narrative entries to the log manually (IC notes, situation updates)
- Automatic log entries for key system events (member check-in, resource deployed, status change)
- Subject information: name, age, description, last known point (LKP), physical condition
- Subject medical notes (HIPAA-scoped — visible to IC and Medical roles only)
- Incident hand-off: transfer IC role to another member with log entry
- Incident suspension with resume capability
- Incident closure with after-action summary field
- Incident archive — closed incidents are read-only but fully searchable

---

### 4. Search Mapping & Sector Planning [LITE at MVP, FULL at Post-MVP]

At MVP, teams get a functional map with the core planning tools. Advanced probability modeling and full sector analysis comes Post-MVP.

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
- Password reset via email
- Persistent sessions with automatic token refresh
- Role-based access enforced at both API and database (RLS) level
- Org-scoped access — a member of Org A cannot see anything from Org B
- Incident-scoped visibility — field members only see their assigned incident, not all org incidents simultaneously

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

### 8. Billing & Subscription [FULL]

Must ship at MVP — this is a SaaS, not a free tool.

- Stripe-powered subscription management
- Pricing tiers:
  - **Free** — 1 active incident, up to 5 members, no ICS form export. For evaluation only.
  - **Volunteer** — $50/month billed annually ($600/year). Unlimited incidents, up to 25 members, all core features. Priced below CalTopo's $750/year org tier — intentionally appetizing for volunteer teams. Covered by standard TOS, insurance, and API costs with no compliance overhead.
  - **Professional** — $149/month billed annually ($1,788/year). Up to 75 members, all features, SOC 2 Type II backed, priority support, HIPAA-ready data handling. Targets county sheriff units, hospital-based rescue teams, and any agency with an IT department requiring verified security compliance. Still a fraction of D4H's $5,300/year entry price.
  - **Enterprise** — Contract pricing, no public rate. Targets state agencies, federal entities, and multi-county coordination bodies requiring FedRAMP authorization, SAML/SSO, white-labeling, or on-premise deployment. All Enterprise contracts are negotiated directly. Starting contracts in the $50,000–$250,000/year range.
- Subscription management portal (upgrade, downgrade, cancel) via Stripe Customer Portal
- Org Admin is the billing owner
- Graceful feature degradation on subscription lapse — data is never deleted, features are gated
- Enterprise customers are managed outside Stripe via direct invoicing

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
| MVP | 9 core feature groups | Month 0–3 |
| Post-MVP | 9 expansion features | Month 3–12 |
| Future | 6 platform features | Year 2–5 |

---

*The MVP is designed so that every piece of data captured feeds the next feature. Personnel tracking feeds ICS forms. Sector assignments feed the map. The map feeds After-Action. Build the data model right in Month 1 and every subsequent feature is mostly a new UI on top of data you already have.*