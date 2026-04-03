# Debug & Testing Guide — SAR SaaS Platform
> Claude Code appends a new testing section to this file at the end of every session, corresponding to the features built that session.
> This file is for the developer (you) to manually verify features before they are used in a real search incident.
> Every section must be completable by a non-developer using a browser, the app UI, and basic tools like Postman or browser DevTools.

---

## How To Use This File

After Claude Code completes a session and updates `build-log.md`, it will also append a new section here covering:
- What was built and what to verify
- Step-by-step manual test cases with exact inputs and expected outputs
- Edge cases and failure scenarios to deliberately trigger
- Database checks to run in the Supabase dashboard
- How to verify RLS is working (cross-org leakage check)
- How to verify real-time sync is working
- How to confirm offline behavior if applicable

Work through each section top to bottom before moving to the next feature. If anything does not behave as described, note it and report it to Claude Code at the start of the next session before asking it to build anything new.

The entry template is directly below. **New session entries are appended at the bottom of this file.**

---

## Debug Entry Template

Claude Code uses this template when appending a new session's test instructions. **Always append new entries at the bottom of this file — never insert between existing sessions.**

```
---

## Session [NUMBER] — [Feature Name]

### What Was Built
[1–2 sentences describing what was completed this session — mirrors the build-log.md entry]

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Dev server started: `npm run dev`
- [ ] Supabase local or cloud instance connected
- [ ] Test user accounts exist (see Testing Environment Setup below)
- [ ] Any new environment variables set in `.env.local`
- [ ] Any new migrations applied in Supabase SQL Editor (list them if applicable)

---

### TEST N: [Test Name]

**Purpose:** [What this test verifies]
**Tool:** [Browser / Terminal / curl / Supabase SQL Editor]
**Steps:**
1. [Exact step]
2. [Exact step]
3. [Exact step]

**Expected Result:** [Exactly what should happen]
**Pass / Fail:** [ ]
**Notes:** _______________

---

### TEST N: Cross-Organization Isolation

**Purpose:** Verify that Org B cannot see Org A's data.
**Tool:** Browser + Supabase SQL Editor
**Steps:**
1. Log in as admin@betasar.test
2. Attempt to access [specific Org A resource] directly via URL
3. Open DevTools → Network tab → inspect API responses

**Expected Result:** 0 records returned, or 403/404 response. No Org A data visible.
**Pass / Fail:** [ ]
**Notes:** _______________

---

### TEST N: Unauthenticated Access

**Purpose:** Verify protected routes reject unauthenticated users.
**Tool:** Browser (incognito window)
**Steps:**
1. Open an incognito browser window
2. Navigate directly to [protected route URL]

**Expected Result:** Redirected to login page. No data visible.
**Pass / Fail:** [ ]
**Notes:** _______________

---

### TEST N: Role Restriction

**Purpose:** Verify lower-privilege roles cannot perform higher-privilege actions.
**Tool:** Browser
**Steps:**
1. Log in as field@alphasar.test
2. Attempt to [action that requires IC or Admin role]

**Expected Result:** Action is unavailable or returns a 403. No data exposed.
**Pass / Fail:** [ ]
**Notes:** _______________

---

### Database Verification

Run in Supabase SQL Editor after the relevant tests:

```sql
-- [Description of what this query verifies]
[SQL query];
-- Expected: [what you should see]
```

---

### Real-Time Sync Verification (if applicable)

1. Open the app in Browser A logged in as ic@alphasar.test
2. Open the app in Browser B logged in as ops@alphasar.test
3. [Action in Browser A]
4. Expected: [Change appears in Browser B within 2 seconds without refresh]

**Pass / Fail:** [ ]

---

### Offline Behavior Verification (if applicable)

1. Load the feature in the browser
2. DevTools → Network → set throttling to "Offline"
3. [Specific action]
4. Expected: [What should happen offline]
5. Re-enable network
6. Expected: [How sync resolves]

**Pass / Fail:** [ ]

---

### Known Limitations
- [Deferred feature or known gap — what is NOT expected to work yet]

---

### Sign-Off
- [ ] All tests passed
- [ ] Any failures documented and reported to Claude Code
- [ ] Feature approved for use

Tested by: _______________ Date: _______________

---
```

---

## Testing Environment Setup

Before running any tests, confirm the following are in place:

### Two Test Organizations
Create two separate organizations in your app. You will use these to verify that data from Org A is never visible to a user logged into Org B.
- **Org A:** "Alpha SAR Team" — your primary test org
- **Org B:** "Beta SAR Team" — your cross-contamination check org

### Test User Accounts
Create one user per role in Org A. Use a consistent naming pattern so you know which account to use:
- `admin@alphasar.test` — Org Admin
- `ic@alphasar.test` — Incident Commander
- `ops@alphasar.test` — Operations Section Chief
- `field@alphasar.test` — Field Member
- `observer@alphasar.test` — Observer
- `admin@betasar.test` — Org Admin for Org B (cross-org testing only)

Keep these credentials in a local password manager. Never commit them to the repo.

### Browser Setup
Use two different browsers (e.g. Chrome and Firefox) or two Chrome profiles to stay logged into two different accounts simultaneously. This is essential for testing real-time sync and role-based visibility.

---

## Session Test Entries

**New entries are appended at the bottom of this file.**

---

## Session 0 — No Tests Yet

No application code has been built. Tests begin at Session 1.

---

## Session 1 — Database Foundation & Auth Infrastructure

### What Was Built
Supabase client utilities (server, browser, proxy), database migrations for `organizations` and `organization_members`, Next.js proxy auth guard, and Supabase auth callback route. No UI built this session.

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Supabase project is created and PostGIS extension is enabled (Dashboard → Database → Extensions)
- [ ] `.env.local` contains valid `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Supabase Auth redirect URL configured: Dashboard → Authentication → URL Configuration → add `http://localhost:3000/auth/callback`
- [ ] Dev server started: `npm run dev`

---

### TEST 1: Apply Migrations in Order

**Purpose:** Apply all four foundation migrations to the Supabase database.
**Tool:** Supabase Dashboard → SQL Editor
**Steps:**
1. Open SQL Editor in your Supabase project
2. Paste and run `supabase/migrations/001_extensions.sql` → confirm "Success. No rows returned."
3. Paste and run `supabase/migrations/002_organizations.sql` → confirm `organizations` table visible in Table Editor
4. Paste and run `supabase/migrations/003_organization_members.sql` → confirm `organization_members` table visible
5. Paste and run `supabase/migrations/004_organizations_rls.sql` → confirm no errors

**Expected Result:** 4 migrations apply cleanly with no errors.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 2: RLS Cross-Organization Isolation

**Purpose:** Verify the RLS policies prevent cross-org data leakage.
**Tool:** Supabase Dashboard → SQL Editor
**Steps:**
1. Paste the full contents of `supabase/rls-verification.sql` into SQL Editor
2. Run the script
3. Read the "Messages" panel output

**Expected Result:** Exactly 6 PASS notices, 0 FAIL warnings.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 3: Proxy Auth Guard — Unauthenticated Redirect

**Purpose:** Verify the proxy.ts redirects unauthenticated users to /login.
**Tool:** Browser (incognito window)
**Steps:**
1. Open incognito window
2. Navigate to `http://localhost:3000/dashboard`

**Expected Result:** Redirected to `http://localhost:3000/login?next=/dashboard`. No dashboard content visible.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 4: Proxy Auth Guard — Public Paths Not Redirected

**Purpose:** Verify /login and /auth paths are reachable without a session.
**Tool:** Browser (incognito window)
**Steps:**
1. In incognito window, navigate to `http://localhost:3000/login`

**Expected Result:** Page loads without infinite redirect loop. URL stays at `/login` (even if the page shows a 404 — that's fine, the page doesn't exist yet).
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### Database Verification

Run in Supabase SQL Editor after applying all migrations:

```sql
-- Confirm both tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('organizations', 'organization_members')
ORDER BY table_name;
-- Expected: 2 rows
```

```sql
-- Confirm RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'organization_members');
-- Expected: both rows show rowsecurity = true
```

```sql
-- Confirm all 8 RLS policies exist
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'organization_members')
ORDER BY tablename, policyname;
-- Expected: 4 policies on organizations, 4 on organization_members
```

```sql
-- Confirm triggers attached
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_name = 'set_updated_at' AND event_object_schema = 'public';
-- Expected: 2 rows (organizations, organization_members)
```

---

### Sign-Off
- [ Passed ] All 4 tests passed
- [ Passed ] Any failures documented and reported to Claude Code before Session 2
- [ Passed ] Migrations confirmed applied in Supabase

Tested by: __Tyler Alex__ Date: __3/29/26__

---

## Session 2 — POST /api/organizations (Feature 1 API Layer)

### What Was Built
Vitest test infrastructure, `audit_log` migration, service role Supabase client, organization Zod schema, `createOrganization` business logic, and `POST /api/organizations` route handler. All 30 unit tests pass. No UI built this session.

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Migration 006 (`006_audit_log.sql`) applied in Supabase SQL Editor
- [ ] `.env.local` contains valid `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Dev server started: `npm run dev`
- [ ] A Supabase Auth user exists for testing (create in Supabase Dashboard → Authentication → Users)

---

### TEST 1: Apply Migration 006 (audit_log)

**Purpose:** Create the audit_log table required for compliance logging.
**Tool:** Supabase Dashboard → SQL Editor
**Steps:**
1. Paste and run `supabase/migrations/006_audit_log.sql`
2. Confirm "Success" and no errors
3. Verify `audit_log` appears in Table Editor

**Expected Result:** Table created with RLS enabled and 3 policies (select, no_update, no_delete).
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 2: Unit Tests Pass

**Purpose:** Verify all automated tests pass.
**Tool:** Terminal
**Steps:**
1. Run `npm test`
2. Observe output

**Expected Result:**
```
Test Files  3 passed (3)
     Tests  30 passed (30)
```
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 3: TypeScript Strict Mode

**Purpose:** Confirm zero TypeScript errors.
**Tool:** Terminal
**Steps:**
1. Run `npx tsc --noEmit`

**Expected Result:** No output (zero errors).
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 4: POST /api/organizations — Unauthenticated Returns 401

**Purpose:** Verify unauthenticated requests are rejected before any business logic runs.
**Tool:** curl or Postman
**Steps:**
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","slug":"test","unit_type":"sar","admin_display_name":"Admin"}'
```

**Expected Result:**
```json
{ "data": null, "error": "Unauthorized", "meta": null }
```
HTTP status: `401`
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 5: POST /api/organizations — Invalid Input Returns 400

**Purpose:** Verify Zod validation rejects invalid payloads.
**Tool:** curl or Postman
**Steps:**
Send with invalid slug (uppercase) and short name:
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your session cookie>" \
  -d '{"name":"A","slug":"INVALID SLUG","unit_type":"sar","admin_display_name":"J"}'
```

**Expected Result:**
```json
{ "data": null, "error": "Validation failed", "meta": { "issues": [...] } }
```
HTTP status: `400`. The `issues` array should contain at least 3 violations (name too short, slug pattern, display_name too short).
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 6: POST /api/organizations — Successful Creation Returns 201

**Purpose:** Full happy-path test: creates org + first org_admin.
**Tool:** curl or Postman (with a valid authenticated session)

**Setup:** Create a test user in Supabase Dashboard → Authentication → Users. Sign in via the app or Supabase's auth API to get a session cookie, OR use a bearer token from `supabase.auth.getSession()`.

**Steps:**
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your session cookie from browser DevTools>" \
  -d '{
    "name": "Alpha SAR Team",
    "slug": "alpha-sar-team",
    "unit_type": "sar",
    "region": "Pacific Northwest",
    "state": "WA",
    "admin_display_name": "Tyler Alex",
    "admin_phone": "+12065551234"
  }'
```

**Expected Result:**
```json
{ "data": { "organizationId": "<uuid>", "memberId": "<uuid>" }, "error": null, "meta": null }
```
HTTP status: `201`
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 7: POST /api/organizations — Duplicate Slug Returns 409

**Purpose:** Verify a second create attempt with the same slug is rejected.
**Tool:** curl or Postman
**Steps:**
1. Successfully run TEST 6 first
2. Send the exact same request body again (same slug: "alpha-sar-team")

**Expected Result:**
```json
{ "data": null, "error": "This slug is already taken", "meta": null }
```
HTTP status: `409`
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### Database Verification

Run in Supabase SQL Editor after TEST 6 succeeds:

```sql
-- Confirm org was created
SELECT id, name, slug, subscription_tier FROM organizations
WHERE slug = 'alpha-sar-team';
-- Expected: 1 row, subscription_tier = 'free'
```

```sql
-- Confirm first org_admin was created
SELECT om.role, om.display_name, om.user_id
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE o.slug = 'alpha-sar-team';
-- Expected: 1 row, role = 'org_admin'
```

```sql
-- Confirm audit_log entry was written
SELECT action, resource_type, actor_email
FROM audit_log
ORDER BY created_at DESC
LIMIT 1;
-- Expected: action = 'organization.created', resource_type = 'organization'
```

```sql
-- Confirm audit_log RLS prevents update (run as authenticated non-admin user)
UPDATE audit_log SET metadata = '{}' WHERE true;
-- Expected: 0 rows updated (RLS blocks it)
```

---

### Cross-Organization Isolation

After creating a second org with a different user account, verify:
```sql
-- Logged in as user from Org B — this should return 0 rows
SELECT * FROM organizations
WHERE slug = 'alpha-sar-team';
-- Expected: 0 rows (RLS blocks access to Org A's data)
```

---

### Sign-Off
- [ passed ] All tests passed
- [ passed ] Any failures documented and reported to Claude Code
- [ passed ] Migration 006 confirmed applied in Supabase

Tested by: __Tyler Alex__ Date: __3/29/26__

---

## Session 3 — Feature 1 UI (Login / Signup / Onboarding / Dashboard)

### What Was Built
Authentication UI: /login, /signup, /onboarding (org creation), /dashboard shell. Full flow from account creation through org setup.

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Dev server started: `npm run dev`
- [ ] Supabase Auth redirect URL configured: Dashboard → Authentication → URL Configuration → `http://localhost:3000/auth/callback`
- [ ] A real email address is available to receive confirmation links

---

### TEST 1: Unauthenticated Redirect

**Purpose:** Verify the proxy redirects unauthenticated users away from protected routes.
**Tool:** Browser (incognito window)
**Steps:**
1. Open an incognito/private browser window
2. Navigate to `http://localhost:3000/dashboard`

**Expected Result:** Redirected to `/login?next=/dashboard`. No dashboard content visible.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 2: Authenticated Redirect From Login Page

**Purpose:** Verify that a logged-in user visiting /login is sent to /dashboard instead.
**Tool:** Browser
**Steps:**
1. Sign in successfully (see TEST 10)
2. While still logged in, navigate to `http://localhost:3000/login`

**Expected Result:** Immediately redirected to `/dashboard`.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 3: Signup Form Validation

**Purpose:** Verify client-side Zod validation on the signup form.
**Tool:** Browser
**Steps:**
1. Visit `http://localhost:3000/signup`
2. Submit the form with an empty email field
3. Submit with a weak password (fewer than 8 chars, no uppercase, no number)
4. Submit with mismatched passwords

**Expected Result:**
- "Please enter a valid email address" error on email field
- Password validation errors (min 8 chars, requires uppercase, requires number)
- "Passwords do not match" error on confirm password field

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 4: Signup Success

**Purpose:** Verify the signup form submits and transitions to the "check your email" state.
**Tool:** Browser
**Steps:**
1. Visit `http://localhost:3000/signup`
2. Fill in: a real email address, a strong password (e.g. `Test1234!`), and confirm password
3. Click "Create account"

**Expected Result:**
- "Check your email" state shown with the submitted email address
- Confirmation email arrives in inbox

**Pass / Fail:** [ Pass ]
**Notes:** Received a Supabase Auth email to my junk folder

---

### TEST 5: Email Confirmation → Onboarding Redirect

**Purpose:** Verify the auth callback redirects a new user (no org) to /onboarding.
**Tool:** Browser + email client
**Steps:**
1. Click the confirmation link from the email received in TEST 4

**Expected Result:**
- Browser redirects to `http://localhost:3000/onboarding`
- Auth session is active (DevTools → Application → Cookies: Supabase auth cookie present)

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 6: Onboarding Form Validation

**Purpose:** Verify client-side Zod validation on the org creation form.
**Tool:** Browser
**Steps:**
1. On `/onboarding`, click "Create organization" without filling any fields

**Expected Result:** Validation errors on: Organization name (required), URL handle (required), Display name (required).
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 7: Slug Auto-Generation and Manual Override

**Purpose:** Verify the slug field auto-populates from the org name and locks on manual edit.
**Tool:** Browser
**Steps:**
1. On `/onboarding`, type "King County Search & Rescue" in the Organization Name field

**Expected Result:**
- URL handle auto-fills with `king-county-search-rescue`
- Preview below the field shows `sargos.app/king-county-search-rescue`

2. Clear the URL handle field, type `kc-sar` manually, then click elsewhere
3. Change the Organization Name to something different

**Expected Result:**
- URL handle stays as `kc-sar` (slug lock active)
- Changing the org name does NOT overwrite the manual slug

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 8: Successful Org Creation

**Purpose:** Full happy path — org creation form submits and redirects to the dashboard.
**Tool:** Browser
**Steps:**
1. Fill the onboarding form:
   - Organization name: "Test SAR Team"
   - URL handle: `test-sar-[your-initials]` (make it unique to avoid a 409)
   - Unit type: Search & Rescue
   - Display name: "Your Name"
2. Click "Create organization"

**Expected Result:**
- Brief loading state ("Creating organization…")
- Redirect to `/dashboard`
- Dashboard shows: "Welcome, Your Name" and "Test SAR Team · SAR"
- Empty incident state visible

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 9: Duplicate Slug Error

**Purpose:** Verify the form surfaces a 409 conflict as a field-level error.
**Tool:** Browser
**Steps:**
1. Sign out (clear cookies or open a fresh incognito window with a new account)
2. Complete signup and email confirmation for a second account
3. On `/onboarding`, enter the same URL handle used in TEST 8
4. Submit the form

**Expected Result:** "This URL handle is already taken. Please choose another." error on the URL handle field.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 10: Login Form — Happy Path

**Purpose:** Verify a returning user can sign in and reach the dashboard.
**Tool:** Browser
**Steps:**
1. Visit `http://localhost:3000/login`
2. Enter the email and password from TEST 4
3. Click "Sign in"

**Expected Result:**
- Redirect to `/dashboard`
- Dashboard shows the org name created in TEST 8

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 11: Login With Wrong Password

**Purpose:** Verify incorrect credentials produce an error without exposing details.
**Tool:** Browser
**Steps:**
1. Visit `http://localhost:3000/login`
2. Enter a valid email but the wrong password
3. Click "Sign in"

**Expected Result:**
- Error alert: "Invalid email or password."
- User remains on the login page

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 12: Auth Error Page

**Purpose:** Verify the auth error page renders correctly for expired or invalid links.
**Tool:** Browser
**Steps:**
1. Navigate directly to `http://localhost:3000/auth/auth-code-error`

**Expected Result:** Page displays "Sign-in link expired" with a "Request a new link" button and a "Back to sign in" link.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 13: Error Boundary

**Purpose:** Verify the dashboard error boundary catches thrown errors without a white screen.
**Tool:** Browser + code editor
**Steps:**
1. Temporarily add `throw new Error('test boundary')` to `src/app/dashboard/page.tsx` before the return statement
2. Visit `/dashboard`

**Expected Result:** Error boundary UI shown: "Dashboard error" with a "Reload" button. App does not crash to a white screen.

3. Remove the temporary throw statement after verifying.

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### Supabase Verification

After completing Tests 4–8, verify in the Supabase Dashboard:

- **Authentication → Users**: New user visible with confirmed email status
- **Table Editor → organizations**: New row with correct name, slug, and unit_type
- **Table Editor → organization_members**: New row with `role: org_admin` and `is_active: true`
- **Table Editor → audit_log**: `ORGANIZATION_CREATED` entry present with the org's ID

---

### Sign-Off
- [ passed ] All 13 tests passed
- [ passed ] Any failures documented and reported to Claude Code
- [ passed ] Supabase Dashboard verification complete

Tested by: __Tyler Alex__ Date: __3/29/26__

---

## Session 4 — Feature 2: Real-Time Resource Tracking

### What Was Built
Migrations 007–015 covering all resource tracking tables (teams, invites, resources, incidents, command structure, sectors, personnel, log, and incident resources). Incident creation API and `/incidents/new` form, personnel check-in and status update API, live personnel board at `/incidents/[id]` with Supabase Realtime and optimistic status updates, and dashboard updated to list active incidents.

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Migrations 007–015 applied in Supabase SQL Editor **in order** (007 → 015) — no errors on any migration
- [ ] Dev server started: `npm run dev`
- [ ] Logged in as the test user from Session 3 (account with an existing org)
- [ ] Two browser tabs or windows ready for real-time testing (TEST 5)

---

### TEST 1: Apply Migrations 007–015

**Purpose:** Create all resource tracking tables and verify no migration errors.
**Tool:** Supabase Dashboard → SQL Editor
**Steps:**
1. Open SQL Editor in your Supabase project
2. Paste and run each file in order, confirming "Success. No rows returned." before proceeding to the next:
   - `supabase/migrations/007_teams.sql`
   - `supabase/migrations/008_organization_invites.sql`
   - `supabase/migrations/009_resources.sql`
   - `supabase/migrations/010_incidents.sql`
   - `supabase/migrations/011_incident_command_structure.sql`
   - `supabase/migrations/012_incident_sectors.sql`
   - `supabase/migrations/013_incident_personnel.sql`
   - `supabase/migrations/014_incident_log.sql`
   - `supabase/migrations/015_incident_resources.sql`
3. Open Table Editor and confirm all 9 new tables are visible

**Expected Result:** All 9 migrations apply cleanly with no errors. All tables visible in Table Editor.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 2: Dashboard Shows Incident List (Empty State)

**Purpose:** Verify the dashboard incident table renders correctly before any incidents exist.
**Tool:** Browser
**Steps:**
1. Log in and navigate to `/dashboard`
2. Verify the incident table renders with header columns: Incident, Type, Status, Location, Started
3. Verify the "No active incidents" empty state is visible
4. Verify the "+ New Incident" button is present in both the header and the empty state

**Expected Result:** Empty state visible. "+ New Incident" links to `/incidents/new`. No JavaScript errors in console.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 3: Create Incident

**Purpose:** Verify the incident creation form submits successfully and redirects to the incident board.
**Tool:** Browser
**Steps:**
1. Click "+ New Incident" from the dashboard
2. Fill in:
   - Incident Name: `Lost Hiker — Mt. Hood Test`
   - Type: `Lost Person`
   - Location: `Timberline Lodge Parking Lot`
   - Start Time: leave blank (should default to now server-side)
3. Click "Create Incident"

**Expected Result:** Redirected to `/incidents/<uuid>`. Incident board loads showing:
- Incident name and "Active" status badge
- Type: "Lost Person"
- Location: "Timberline Lodge Parking Lot"
- Personnel board with 1 person already checked in (you, as Incident Commander)

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 4: Board Shows IC Checked In

**Purpose:** Verify the incident board correctly shows the creating user automatically checked in as Incident Commander.
**Tool:** Browser
**Steps:**
1. On the incident board from TEST 3, inspect the personnel table
2. Verify your display name appears in the Name column
3. Verify the Role column shows "Incident Commander"
4. Verify the Status column shows "Available" with a green badge
5. Verify the Checked In column shows today's date and time

**Expected Result:** 1 row in the personnel table. Name, Role = "Incident Commander", Status = "Available", and a valid check-in timestamp are all populated.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 5: Status Update — Optimistic and Realtime

**Purpose:** Verify optimistic status updates apply immediately in the active tab and propagate via Supabase Realtime to other open tabs without a page refresh.
**Tool:** Browser (two tabs)
**Steps:**
1. Open `/incidents/<uuid>` in Tab A
2. Open the same URL in Tab B
3. In Tab A: change your status from "Available" to "In Field"
4. Observe Tab A immediately after clicking
5. Observe Tab B within 2 seconds

**Expected Result:**
- Tab A: status badge updates to "In Field" immediately (optimistic — no loading spinner or delay)
- Tab B: status badge updates to "In Field" within ~1 second via Supabase Realtime — no page refresh required

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 6: Check In — Duplicate Rejected

**Purpose:** Verify the check-in API rejects a member who is already checked in to the incident.
**Tool:** Browser + Supabase SQL Editor
**Steps:**
1. In Supabase Table Editor → `organization_members`, find your own member `id` UUID
2. On the incident board, click "+ Check In Member"
3. Enter your member UUID (the same member already checked in as IC)
4. Submit

**Expected Result:** Error shown: "Member is already checked in to this incident" (409 conflict). No duplicate row created in `incident_personnel`.

**Note:** To test a successful check-in, create a second test user via `/signup`, complete onboarding to add them to your org, then use their `organization_members.id`.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 7: Dashboard Reflects New Incident

**Purpose:** Verify the dashboard incident list shows the newly created incident with correct data.
**Tool:** Browser
**Steps:**
1. Navigate back to `/dashboard`
2. Verify the "Lost Hiker — Mt. Hood Test" incident appears in the table

**Expected Result:** Row visible with:
- Status: "Active" badge (green)
- Type: "Lost Person"
- Location: "Timberline Lodge Parking Lot"
- Started: today's date

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 8: Cross-Organization Isolation

**Purpose:** Verify Org B users cannot access Org A's incident data via the UI or directly via the database.
**Tool:** Browser + Supabase SQL Editor
**Steps:**
1. Note the incident UUID from TEST 3
2. Log in as your Org B test user
3. Navigate directly to `/incidents/<org-a-incident-uuid>`

**Expected Result (UI):** 404 page. No incident data visible.

**Supabase SQL verification** — run in SQL Editor:
```sql
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"<org-b-user-id>","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT * FROM incidents WHERE organization_id = '<org-a-org-id>';
ROLLBACK;
```
**Expected Result (SQL):** 0 rows returned.

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 9: Realtime Reconnection After Network Interruption

**Purpose:** Verify the Realtime subscription re-establishes automatically after a network interruption and future updates resume propagating.
**Tool:** Browser + DevTools
**Steps:**
1. Open the incident board in Tab A
2. Open DevTools → Network tab → set throttling to "Offline"
3. Wait 5 seconds
4. Set throttling back to "No throttling" (Online)
5. In Tab B, change a personnel status

**Expected Result:** Within ~3 seconds of coming back online, the Realtime subscription re-establishes and the status change propagates to Tab A without a page refresh. (A 2-second reconnect delay is intentional.)
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### Database Verification

Run in Supabase SQL Editor after TEST 3 completes:

```sql
-- Verify incident was created
SELECT id, name, status, incident_type, started_at FROM incidents LIMIT 5;
-- Expected: 1 row, status = 'active', incident_type = 'lost_person'
```

```sql
-- Verify IC was added to command structure
SELECT * FROM incident_command_structure WHERE ics_role = 'incident_commander';
-- Expected: 1 row for your incident
```

```sql
-- Verify IC was checked in as personnel
SELECT id, member_id, personnel_type, status, incident_role
FROM incident_personnel
WHERE incident_role = 'incident_commander';
-- Expected: 1 row, status = 'available', personnel_type = 'member'
```

```sql
-- Verify incident log entry was written
SELECT entry_type, message, actor_name, created_at
FROM incident_log
ORDER BY created_at DESC
LIMIT 5;
-- Expected: at least 1 row with entry_type = 'incident_created' or similar
```

```sql
-- Verify audit log entry was written
SELECT action, resource_type, created_at
FROM audit_log
WHERE action = 'incident.created'
ORDER BY created_at DESC
LIMIT 3;
-- Expected: 1 row, resource_type = 'incident'
```

---

### Known Limitations
- Check-in form uses raw UUID input — not user-friendly. Member search UI is deferred to a future session.
- No equipment tracking UI yet (`incident_resources` table exists, no UI built).
- No PAR roll calls yet (`incident_par_events` table not created).
- QR check-in (Feature 2b) deferred — no `incident_qr_tokens` table yet.

---

### Sign-Off
- [ Passed ] TEST 1 passed — all 9 migrations applied without errors
- [ Passed ] Tests 2–9 passed
- [ Passed ] Database verification complete
- [ ] Any failures documented and reported to Claude Code before the next session

Tested by: __Tyler Alex__ Date: __3/29/26__

---

## Session 5 — Feature 2b: Spontaneous Volunteer QR Check-In

### What Was Built
Migration 016 (`incident_qr_tokens`), QR token API routes, public check-in form at `/check-in/[token]`, QR panel on the incident board with generate/regenerate/deactivate/copy-link actions, and a mobile-optimized volunteer form (no login required).

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Migration 016 (`016_incident_qr_tokens.sql`) applied in Supabase SQL Editor — no errors
- [ ] Dev server started: `npm run dev`
- [ ] Logged in as the test user from previous sessions (account with an existing org and an active incident)
- [ ] One additional device or incognito tab available for simulating a volunteer's phone

---

### TEST 1: Apply Migration 016

**Purpose:** Create the `incident_qr_tokens` table and register the `lookup_qr_token` and `increment_qr_scans` RPCs.
**Tool:** Supabase Dashboard → SQL Editor
**Steps:**
1. Paste and run `supabase/migrations/016_incident_qr_tokens.sql`
2. Confirm "Success. No rows returned."
3. In Table Editor, confirm `incident_qr_tokens` table is visible
4. In Database → Functions, confirm `lookup_qr_token` and `increment_qr_scans` are listed

**Expected Result:** Table created, both functions visible, no errors.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 2: QR Panel Renders on Incident Board (Empty State)

**Purpose:** Verify the QR panel loads correctly below the personnel board when no QR token exists yet.
**Tool:** Browser
**Steps:**
1. Navigate to any active incident at `/incidents/<uuid>`
2. Scroll below the personnel board

**Expected Result:**
- "Volunteer QR Check-In" panel visible
- Header shows "No active QR code"
- "Generate QR Code" button is present and enabled
- No errors in the browser console

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 3: Generate QR Code

**Purpose:** Verify generating a QR token creates a new token in the database and displays the QR code in the panel.
**Tool:** Browser
**Steps:**
1. On the incident board from TEST 2, click "Generate QR Code"
2. Observe the QR panel

**Expected Result:**
- QR code SVG appears in the panel
- Header updates to "Active · 0 scans"
- "Deactivate" and "Regenerate" buttons appear
- Check-in URL appears in the URL bar below the QR code
- URL format: `http://localhost:3000/check-in/<32-char-hex-token>`

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 4: Copy Link

**Purpose:** Verify the "Copy Link" button copies the check-in URL to the clipboard.
**Tool:** Browser
**Steps:**
1. After TEST 3, click "Copy Link"

**Expected Result:**
- Button label changes to "✓ Copied!" for ~2 seconds
- Paste the clipboard into any text editor — it should contain the full `http://localhost:3000/check-in/<token>` URL

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 5: Public Check-In Page — Token Resolution

**Purpose:** Verify the `/check-in/[token]` page loads without auth and shows the correct incident/org name.
**Tool:** Browser (incognito window or separate device — no login)
**Steps:**
1. Copy the check-in URL from TEST 4
2. Open an **incognito** window (or use a different device/browser)
3. Paste and navigate to the check-in URL

**Expected Result:**
- Page loads showing: org name (small heading), incident name (large heading), "Complete this form to check in as a volunteer."
- No login redirect — the page is fully public
- "Contact Information" and "Qualifications" sections visible

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 6: Check-In Form Validation

**Purpose:** Verify client-side validation prevents incomplete form submission.
**Tool:** Browser (incognito, same window as TEST 5)
**Steps:**
1. On the check-in form, click "Check In" without filling in any fields

**Expected Result:**
- "Name must be at least 2 characters" error on name field
- "Enter a valid phone number" error on phone field
- "You must acknowledge the safety briefing to check in" error on the checkbox
- Form does not submit

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 7: Successful Volunteer Check-In

**Purpose:** Verify a completed form submission adds the volunteer to the personnel board via Realtime.
**Tool:** Two browser windows (Tab A: incident board logged in; Tab B/incognito: check-in form)
**Steps:**
1. In **Tab A** (logged in), open the incident board at `/incidents/<uuid>`
2. In **Tab B** (incognito), open the check-in URL from TEST 4
3. In Tab B, fill in:
   - Full Name: `Jane Volunteer`
   - Phone: `555-867-5309`
   - Check "Wilderness First Aid (WFA)"
   - Check the safety acknowledgment
4. Click "Check In"

**Expected Result:**
- Tab B: Shows "You're Checked In!" success state with confirmation message
- Tab A: Within 1–2 seconds, `Jane Volunteer` appears on the Personnel Board as an **Unaffiliated Volunteer** without a page refresh (Realtime INSERT)
- Tab A: Role column shows "—" (no incident role assigned yet)
- Tab A: Status shows "Available"

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 8: Scan Counter Increments

**Purpose:** Verify each successful check-in increments the scan counter on the QR panel.
**Tool:** Browser (Tab A from TEST 7)
**Steps:**
1. After TEST 7, observe the QR panel header in Tab A
2. Refresh the incident board page

**Expected Result:** Header shows "Active · 1 scan"

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 9: Regenerate QR Code

**Purpose:** Verify regenerating creates a new active token and deactivates the old one.
**Tool:** Browser (Tab A, logged in) + new incognito window
**Steps:**
1. Note the current check-in URL (the old token)
2. Click "Regenerate" on the QR panel
3. The QR code changes and a new URL appears in the panel
4. Open a **new incognito window** and navigate to the **old** check-in URL

**Expected Result:**
- Old URL shows: "QR Code No Longer Active — This QR code has been deactivated by the Incident Commander."
- New URL (from the regenerated token) opens the check-in form normally

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 10: Deactivate QR Token

**Purpose:** Verify deactivating a token prevents new check-ins via that URL.
**Tool:** Browser (Tab A, logged in) + incognito window
**Steps:**
1. Click "Deactivate" on the QR panel
2. Confirm: header changes to "No active QR code", "Generate QR Code" button reappears
3. Open the most recent check-in URL in an incognito window

**Expected Result:** Page shows "QR Code No Longer Active" message. The "Generate QR Code" button is available if IC wants to create a new one.

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 11: Invalid / Unknown Token

**Purpose:** Verify a garbage or expired token shows a clear error page.
**Tool:** Browser (incognito)
**Steps:**
1. Navigate to `http://localhost:3000/check-in/notarealtoken123`

**Expected Result:** "QR Code Not Found — This QR code is invalid, the incident has been closed, or the link has expired."

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 12: Unauthenticated Access Allowed (Check-In Page)

**Purpose:** Verify the check-in page is accessible without a session — no redirect to login.
**Tool:** Browser (incognito)
**Steps:**
1. In a fresh incognito window (no cookies, no session), navigate to any valid check-in URL

**Expected Result:** Check-in form loads normally. No redirect to `/login`.

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 13: Cross-Organization Token Isolation

**Purpose:** Verify a token for Org A's incident cannot be used to check volunteers into Org B's incident.
**Tool:** Supabase SQL Editor
**Steps:**
1. Verify the token → incident → organization chain is consistent:
```sql
SELECT q.id, q.token, i.name AS incident_name, o.name AS org_name
FROM incident_qr_tokens q
JOIN incidents i ON i.id = q.incident_id
JOIN organizations o ON o.id = q.organization_id
ORDER BY q.created_at DESC
LIMIT 5;
-- Expected: each token links to exactly one incident in exactly one org
```

**Expected Result:** Each row shows a consistent org_name → incident_name chain with no cross-org contamination.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### Database Verification

Run in Supabase SQL Editor after completing the above tests:

```sql
-- Verify incident_qr_tokens table has RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'incident_qr_tokens';
-- Expected: 1 row, rowsecurity = true
```

```sql
-- Verify RLS policies exist
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'incident_qr_tokens';
-- Expected: 3 policies (SELECT, INSERT, UPDATE)
```

```sql
-- Verify lookup_qr_token is granted to anon role
SELECT grantee, routine_name, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'lookup_qr_token';
-- Expected: at least 1 row with grantee = 'anon', privilege_type = 'EXECUTE'
```

```sql
-- Verify volunteer appeared in incident_personnel with correct type
SELECT volunteer_name, volunteer_phone, volunteer_certifications,
       personnel_type, checkin_method, status
FROM incident_personnel
WHERE personnel_type = 'volunteer'
ORDER BY checked_in_at DESC
LIMIT 3;
-- Expected: row(s) with personnel_type = 'volunteer', checkin_method = 'qr_scan'
```

```sql
-- Verify incident_log entry was written for QR check-in
SELECT entry_type, message, actor_name
FROM incident_log
WHERE entry_type = 'personnel_checkin'
ORDER BY created_at DESC
LIMIT 5;
-- Expected: entry with message like "Jane Volunteer checked in via QR code"
```

```sql
-- Verify only one token is active per incident at a time (after regenerate test)
SELECT incident_id, COUNT(*) AS active_count
FROM incident_qr_tokens
WHERE is_active = true
GROUP BY incident_id;
-- Expected: all rows show active_count = 1 (or 0 if deactivated)
```

---

### Known Limitations
- QR "Download / Print" button not yet implemented. Workaround: right-click the QR code SVG and "Save image as…"
- IC-only token creation is enforced at the API layer (org member required) but not at the DB level. Full RBAC tightening deferred.

---

### Sign-Off
- [ Pass ] Migration 016 applied — no errors
- [ Pass ] Tests 1–13 completed
- [ Pass ] Volunteer appears on personnel board via Realtime (TEST 7 passed)
- [ Pass ] Regenerate + deactivate flows work (TESTS 9–10)
- [ Pass ] Any failures documented and reported to Claude Code before next session

Tested by: __Tyler Alex__ Date: __3/30/26__

---

---

## Session 6 — Feature 2 Completion (Personnel Improvements, PAR Roll Calls, Equipment Tracking)

### What Was Built
Personnel board improved with member search dropdown, inline role assignment, and per-row check-out. PAR roll call system added (migration 017, API, real-time panel). Equipment tracking UI added (deploy/return resource with optimistic updates).

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Migration 017 (`017_incident_par.sql`) applied in Supabase SQL Editor — no errors
- [ ] Dev server started: `npm run dev`
- [ ] Logged in as test user from previous sessions (account with org + active incident)
- [ ] At least one org resource exists with status `available` (create via Supabase Table Editor if needed)
- [ ] A second org member account exists to use for check-in tests

---

### TEST 1: Apply Migration 017

**Purpose:** Create the `incident_par_events` and `incident_par_responses` tables required for PAR roll calls.
**Tool:** Supabase Dashboard → SQL Editor
**Steps:**
1. Paste and run `supabase/migrations/017_incident_par.sql`
2. Confirm "Success. No rows returned."
3. Open Table Editor and confirm both `incident_par_events` and `incident_par_responses` are visible

**Expected Result:** Both tables created with no errors.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 2: Member Check-In — Search Dropdown

**Purpose:** Verify the check-in form uses a name dropdown instead of the old UUID input.
**Tool:** Browser
**Steps:**
1. Navigate to an active incident at `/incidents/<uuid>`
2. Click "+ Check In Member"
3. Observe the check-in form

**Expected Result:**
- A searchable dropdown showing org member display names (not a raw UUID input field)
- Optional role selector also visible
- "Check In" button submits the form

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 3: Member Check-In — Happy Path

**Purpose:** Verify checking in a second member adds them to the board via Realtime.
**Tool:** Browser (two tabs)
**Steps:**
1. Open the incident board in Tab A
2. In Tab A, click "+ Check In Member"
3. Select your second test member from the dropdown
4. Optionally select a role (e.g., "Field Member")
5. Click "Check In"

**Expected Result:**
- Tab A: new member row appears on the board immediately
- Second tab (if open): member appears via Realtime without page refresh
- Role column shows the selected role (or blank if none selected)
- Status shows "Available"
- Checked In column shows today's date/time

**Pass / Fail:** [ Partial Pass]
**Notes:** _Works but the second tab needs to be reloaded atleast one time_

---

### TEST 4: Inline Role Assignment

**Purpose:** Verify clicking the role dropdown in a board row updates the role immediately.
**Tool:** Browser
**Steps:**
1. On the incident board, locate a checked-in org member row
2. Click the role dropdown in the Role column
3. Select a different role (e.g., "Field Member" → "Operations Section Chief")

**Expected Result:**
- Role updates immediately (optimistic)
- No page refresh required
- Role column shows the new role text

**Pass / Fail:** [ Pass ]
**Notes:** _Updates in 1 to 2 seconds_

---

### TEST 5: Check Out

**Purpose:** Verify checking out a member removes them from the active personnel list.
**Tool:** Browser
**Steps:**
1. On the incident board, locate a checked-in member row (not the IC)
2. Click "Check Out"

**Expected Result:**
- Row disappears from the board immediately (optimistic removal)
- No page refresh required
- Member no longer appears in the personnel list

**Pass / Fail:** [ Pass ]
**Notes:** _Takes 1 to 2 seconds but it does update correctly_

---

### TEST 6: PAR Roll Call — Initiate

**Purpose:** Verify initiating a PAR creates a new event and lists all checked-in personnel.
**Tool:** Browser
**Steps:**
1. Ensure at least 2 members are checked in to the incident (including yourself as IC)
2. Scroll below the personnel board to the "PAR Roll Call" panel
3. Click "Initiate PAR"

**Expected Result:**
- PAR panel updates to show an active roll call
- Each checked-in member appears with a "No response" status
- Progress bar shows 0 / N confirmed
- "Initiate PAR" button is replaced by a list of personnel with "Mark Safe" buttons

**Pass / Fail:** [ Pass ]
**Notes:** _This does not update on tab B until it is reloaded_

---

### TEST 7: PAR Roll Call — Mark Safe and Complete

**Purpose:** Verify marking all members safe closes the PAR and records the completion time.
**Tool:** Browser
**Steps:**
1. With an active PAR from TEST 6, click "Mark Safe" for each listed member
2. Observe the progress bar and panel state as each person is marked

**Expected Result:**
- Each "Mark Safe" click immediately changes that member's status to a green "Safe" indicator (optimistic)
- Progress bar increments (e.g., "1 / 2 confirmed", "2 / 2 confirmed")
- When all members are marked, panel shows "PAR Complete" with a timestamp
- "New PAR" button appears to start a fresh roll call

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 8: PAR Roll Call — New PAR

**Purpose:** Verify starting a new PAR after completion resets the panel.
**Tool:** Browser
**Steps:**
1. After TEST 7 completes (PAR shows "PAR Complete"), click "New PAR"

**Expected Result:**
- Panel resets: a fresh "Initiate PAR" button is shown
- Previous PAR event is preserved in the database (does not overwrite — creates a new row)

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 9: Equipment Deploy

**Purpose:** Verify deploying a resource moves it from "Available to Deploy" to the "Deployed" section optimistically.
**Tool:** Browser
**Steps:**
1. Scroll to the "Equipment & Resources" panel on the incident board
2. Confirm at least one resource appears in the "Available to Deploy" section
   - If none exist, add a resource via Supabase Table Editor: insert a row into `resources` with `organization_id` = your org's ID and `status = 'available'`
3. Click "Deploy" on an available resource

**Expected Result:**
- Resource moves immediately to the "Deployed" section (optimistic)
- "Available to Deploy" section either shows remaining resources or an empty state
- No page refresh required

**Pass / Fail:** [ Pass ]
**Notes:** Works correctly in the active tab. No Realtime sync to other tabs — known limitation, deferred.

---

### TEST 10: Equipment Return

**Purpose:** Verify returning a deployed resource moves it back to available.
**Tool:** Browser
**Steps:**
1. With a resource in the "Deployed" section (from TEST 9), click "Return"

**Expected Result:**
- Resource moves immediately back to the "Available to Deploy" section (optimistic with rollback on failure)
- "Deployed" section reflects the removal immediately

**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### TEST 11: Unauthenticated Access Rejected

**Purpose:** Verify all new API routes (PAR, resources) reject unauthenticated requests.
**Tool:** Terminal / curl
**Steps:**
```bash
# PAR initiate — no auth
curl -X POST http://localhost:3000/api/incidents/<any-uuid>/par \
  -H "Content-Type: application/json" \
  -d '{}'

# Resource deploy — no auth
curl -X POST http://localhost:3000/api/incidents/<any-uuid>/resources \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Result:** Both return `401 Unauthorized` with `{ "data": null, "error": "Unauthorized", "meta": null }`.
**Pass / Fail:** [ Pass ]
**Notes:** _______________

---

### Real-Time Sync Verification

**Purpose:** Verify PAR responses propagate live to other connected users.

1. Open the incident board in **Browser A** (logged in as IC)
2. Open the same incident board in **Browser B** (same or different user, same org)
3. In Browser A: initiate a PAR roll call
4. Observe Browser B within 2 seconds

**Expected Result:** PAR panel in Browser B updates to show the active roll call without a page refresh.

5. In Browser A: mark one member safe
6. Observe Browser B

**Expected Result:** Confirmed count increments in Browser B within ~1 second.

**Pass / Fail:** [ Pass ]

---

### Database Verification

Run in Supabase SQL Editor after completing the tests above:

```sql
-- Verify PAR tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('incident_par_events', 'incident_par_responses')
ORDER BY table_name;
-- Expected: 2 rows
```

```sql
-- Verify RLS is enabled on PAR tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('incident_par_events', 'incident_par_responses');
-- Expected: both show rowsecurity = true
```

```sql
-- Verify a PAR event was created
SELECT id, incident_id, initiated_by, total_personnel, confirmed_count, completed_at
FROM incident_par_events
ORDER BY initiated_at DESC
LIMIT 3;
-- Expected: at least 1 row; completed_at should be populated if TEST 7 passed
```

```sql
-- Verify PAR responses were written
SELECT par_event_id, personnel_id, confirmed_safe, confirmed_at
FROM incident_par_responses
ORDER BY confirmed_at DESC
LIMIT 5;
-- Expected: 1 row per member marked safe
```

```sql
-- Verify unique constraint (no duplicate responses per PAR event + personnel)
SELECT par_event_id, personnel_id, COUNT(*)
FROM incident_par_responses
GROUP BY par_event_id, personnel_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)
```

```sql
-- Verify equipment was deployed (incident_resources row)
SELECT ir.id, r.name AS resource_name, ir.checked_out_by, ir.checked_out_at, ir.checked_in_at
FROM incident_resources ir
JOIN resources r ON r.id = ir.resource_id
ORDER BY ir.checked_out_at DESC
LIMIT 5;
-- Expected: at least 1 row; checked_in_at populated if TEST 10 passed
```

```sql
-- Verify incident_log entries were written for PAR and resource actions
SELECT entry_type, message, actor_name, created_at
FROM incident_log
WHERE entry_type IN ('par_initiated', 'par_completed', 'resource_deployed', 'resource_returned')
ORDER BY created_at DESC
LIMIT 10;
-- Expected: rows for each action performed during testing
```

---

### Known Limitations
- Drag-and-drop quick-assign is deferred (UX enhancement, no blocker).
- Overdue team alerts and missing member alerts are deferred — require notification infrastructure (Feature 7).
- IC-only enforcement for PAR initiation is at the API layer only; DB-level RBAC tightening deferred.
- ResourceBoard does not subscribe to Realtime — low-frequency command-center action, acceptable for MVP.
- **BUG (low):** A freshly opened second tab requires one page reload before Realtime updates propagate. Root cause: the Realtime subscription fires before `supabase.auth.getSession()` has restored the session from cookies, so the initial subscription has no auth token and receives no events. Fix: subscribe inside `onAuthStateChange` so the channel only establishes after session is confirmed ready. Not a blocker for single-tab use (primary IC workflow).

---

### Sign-Off
- [ Pass ] Migration 017 applied — no errors
- [ Pass ] Tests 1–11 completed
- [ Pass ] PAR real-time sync verified
- [ Pass ] Database verification SQL executed
- [ Pass? ] Any failures documented and reported to Claude Code before next session

Tested by: __Tyler Alex__ Date: __Tyler Alex__

---

## Session 10 — DX Tooling (2026-04-02)

### What Was Built
Developer experience tooling: Playwright, Vitest coverage, commitlint, lint-staged, PR template, and quick fixes. No feature code.

### What To Verify

#### Test 1: Unit tests still pass
1. Run `npm test`
2. **Expected**: 83 tests pass across 9 test files

#### Test 2: TypeScript strict mode
1. Run `npx tsc --noEmit`
2. **Expected**: Zero errors

#### Test 3: Commitlint enforcement
1. Try a bad commit: `git commit --allow-empty -m "bad message"`
2. **Expected**: Commit is rejected by commitlint (not conventional format)
3. Try a good commit: `git commit --allow-empty -m "chore: test commitlint"`
4. **Expected**: Commit succeeds
5. Undo the test: `git reset HEAD~1`

#### Test 4: Lint-staged runs on commit
1. Stage a .ts file with a minor change
2. Run `git commit -m "test(dx): lint-staged check"`
3. **Expected**: You see lint-staged output running eslint --fix and secretlint on staged files before the commit completes

#### Test 5: Playwright can run (requires dev server)
1. Start the dev server: `npm run dev`
2. In another terminal: `npm run test:e2e`
3. **Expected**: Playwright launches Chromium and runs 7 tests. Results depend on whether the app is connected to Supabase.

#### Test 6: Vitest coverage report
1. Run `npm run test:coverage`
2. **Expected**: Coverage report appears in terminal. `coverage/` directory created with lcov report.

### Checklist
- [ ] Test 1 — unit tests pass
- [ ] Test 2 — TypeScript strict mode clean
- [ ] Test 3 — commitlint blocks bad messages
- [ ] Test 4 — lint-staged runs pre-commit
- [ ] Test 5 — Playwright runs (with dev server)
- [ ] Test 6 — coverage report generated

Tested by: __________ Date: __________

---
