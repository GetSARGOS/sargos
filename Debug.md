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

**Purpose:** Verify all automated tests pass in CI.
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
**Pass / Fail:** [ ]
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
**Pass / Fail:** [ ]
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
**Pass / Fail:** [ ]
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
- [ ] All tests passed
- [ ] Any failures documented and reported to Claude Code
- [ ] Migration 006 confirmed applied in Supabase

Tested by: _______________ Date: _______________

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
- [ ] App is running locally (`npm run dev`)
- [ ] Supabase local or cloud instance is connected
- [ ] Test user accounts exist (see Testing Environment Setup above)
- [ ] Any new environment variables are set in `.env.local`

---

### Test Suite [Feature Name]

#### TEST [N]: [Test Name]
**Purpose:** [What this test verifies]
**User:** [Which test account to use]
**Steps:**
1. [Exact step]
2. [Exact step]
3. [Exact step]
**Expected Result:** [Exactly what should happen]
**Pass / Fail:** [ ]
**Notes:** _______________

#### TEST [N]: Cross-Organization Isolation
**Purpose:** Verify that Org B cannot see Org A's data
**User:** admin@betasar.test
**Steps:**
1. Log in as admin@betasar.test
2. Attempt to access [specific resource from Org A] directly via URL
3. Open browser DevTools → Network tab → inspect any API responses
**Expected Result:** 0 records returned, or 403/404 response. No Org A data visible under any circumstance.
**Pass / Fail:** [ ]
**Notes:** _______________

#### TEST [N]: Unauthenticated Access Attempt
**Purpose:** Verify protected routes reject unauthenticated users
**User:** Logged out / incognito window
**Steps:**
1. Open an incognito browser window
2. Attempt to navigate directly to [protected route URL]
**Expected Result:** Redirected to login page. No data visible.
**Pass / Fail:** [ ]
**Notes:** _______________

#### TEST [N]: Role Restriction
**Purpose:** Verify lower-privilege roles cannot access higher-privilege actions
**User:** field@alphasar.test
**Steps:**
1. Log in as field@alphasar.test
2. Attempt to [action that requires IC or Admin role]
**Expected Result:** Action is unavailable or returns a 403. No data exposed.
**Pass / Fail:** [ ]
**Notes:** _______________

---

### Database Verification
Run these checks directly in the Supabase SQL editor:

```sql
-- [Description of what this query verifies]
[SQL query];
-- Expected result: [what you should see]
```

---

### Real-Time Sync Verification (if applicable)
1. Open the app in Browser A logged in as ic@alphasar.test
2. Open the app in Browser B logged in as ops@alphasar.test
3. [Specific action in Browser A]
4. Expected: [Specific change appears in Browser B within 2 seconds without refresh]
**Pass / Fail:** [ ]

---

### Offline Behavior Verification (if applicable)
1. Load the feature in the browser
2. Open DevTools → Network tab → set throttling to "Offline"
3. [Specific action]
4. Expected: [What should happen offline]
5. Re-enable network
6. Expected: [How sync should resolve]
**Pass / Fail:** [ ]

---

### Stress / Edge Case Tests

#### EDGE [N]: [Edge Case Name]
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