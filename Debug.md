# Debug & Testing Guide — SAR SaaS Platform
> Claude Code appends a new testing section to this file at the end of every session, corresponding to the features built that session.
> This file is for the developer (you) to manually verify features before they are used in a real search incident.
> Every section must be completable by a non-developer using a browser, the app UI, and basic tools like Postman or browser DevTools.

---

## How To Use This File

After Claude Code completes a session and updates `build_log.md`, it will also append a new section here covering:
- What was built and what to verify
- Step-by-step manual test cases with exact inputs and expected outputs
- Edge cases and failure scenarios to deliberately trigger
- Database checks to run in the Supabase dashboard
- How to verify RLS is working (cross-org leakage check)
- How to verify real-time sync is working
- How to confirm offline behavior if applicable

Work through each section top to bottom before moving to the next feature. If anything does not behave as described, note it and report it to Claude Code at the start of the next session before asking it to build anything new.

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

*(Claude Code appends a new entry here after each session)*

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

## Debug Entry Template

Claude Code uses this template when appending a new session's test instructions:

```
---

## Session [NUMBER] — [Feature Name]

### What Was Built
[Brief description — mirrors the build_log.md entry]

### Pre-Test Checklist
Before running tests, confirm:
- [ ] Dev server started: `npm run dev`
- [ ] Supabase local or cloud instance connected
- [ ] Test user accounts exist (see Testing Environment Setup above)
- [ ] Any new environment variables set in `.env.local`

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
**Tool:** Browser
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

### Stress / Edge Case Tests

#### EDGE N: [Edge Case Name]
**Steps:** [How to trigger it]
**Expected Result:** [Graceful handling — no crash, no data loss, clear error message]
**Pass / Fail:** [ ]

---

### Sign-Off
- [ ] All tests passed
- [ ] Any failures documented and reported to Claude Code
- [ ] Feature approved for use

Tested by: _______________ Date: _______________

---
```
