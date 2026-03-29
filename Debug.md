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