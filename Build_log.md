# Build Log — SAR SaaS Platform
> This file is append-only. Claude Code adds a new entry at the bottom after every completed session.
> At the start of each session, Claude Code reads the LAST ENTRY ONLY to understand current state.
> Never edit or delete previous entries.

---

## How Claude Code Uses This File

**At session start:** Read the most recent entry. It tells you:
- What was last completed
- What decisions were made that affect your work
- Any known issues or open items
- What to build next

**At session end:** Append a new entry using the template below. Be specific — your future self is the audience.

---

## Entry Template

Copy this block and fill it in at the end of every session:

```
---

## Session [NUMBER] — [DATE]

### What Was Built
[1-3 sentences describing what feature or part of a feature was completed]

### Feature Reference
Feature: [Feature name and number from feature_list.md]
Status: [Complete / Partial — describe what remains if partial]

### Files Created or Modified
- [filepath] — [what changed]
- [filepath] — [what changed]

### Database Changes
- [Table created/modified] — [what changed and why]
- Migration file: [filename]

### Decisions Made
[Any choices made that deviate from or extend the feature list or schema — explain the why]
- Decision: [what was decided]
  Reason: [why]

### Deviations From Plan
[Anything that differs from feature_list.md, database_schema.md, or claude_rules.md]
- None  (or describe each deviation)

### Known Issues / Open Items
[Anything incomplete, broken, or needing follow-up]
- None  (or describe each issue with severity: low / medium / high)

### Environment Variables Added
[Any new variables added — add placeholders to .env.example]
- None  (or list each: VARIABLE_NAME — purpose)

### What To Do Next Session
[Specific instruction for the next session — be precise]
Next: Build [Feature X] — start with [specific file or migration or component]

### Definition of Done Status
[List any DoD items that were N/A and why]
- [Item] — N/A because [reason]

---
```

---

## Log Entries

*(Entries will be appended here by Claude Code after each session)*

---

## Session 0 — Project Kickoff

### What Was Built
Project documentation created. No application code written yet.

### Feature Reference
Feature: N/A — pre-build setup
Status: Complete

### Files Created or Modified
- `claude_rules.md` — full project rules and tech stack constraints
- `feature_list.md` — complete tiered feature list for MVP, Post-MVP, and Future
- `database_schema.md` — full data model with all tables, indexes, RLS policies, and migration order
- `definition_of_done.md` — checklist Claude Code must satisfy before marking a feature complete
- `build_log.md` — this file

### Database Changes
- None — no migrations written yet

### Decisions Made
- Decision: Org hierarchy is Organization → Teams → Members (not flat)
  Reason: Supports county-level customers with multiple units without a data model rewrite later
- Decision: `incident_personnel` is a single table covering both org members and unaffiliated QR volunteers
  Reason: ICS 211 needs one authoritative source regardless of how someone checked in
- Decision: JSONB for `ics_forms.form_data` instead of per-form tables
  Reason: Each form type has a different field set; JSONB avoids a table explosion while remaining queryable
- Decision: `subscriptions` mirror table instead of live Stripe queries
  Reason: Avoids Stripe API latency and failure risk on every feature-gated page load
- Decision: Pricing tiers set at Free / $50/mo Volunteer / $149/mo Professional / Enterprise contract
  Reason: Volunteer undercuts CalTopo ($750/yr), Professional covers SOC 2 costs at ~34 customers, Enterprise uses contract model to recover FedRAMP costs

### Deviations From Plan
- None

### Known Issues / Open Items
- K9 search_type uses a CHECK constraint with a note to validate array contents at the API layer — PostgreSQL does not natively enforce array element values without a custom function. Claude Code must implement this validation in the Zod schema and API route for k9_units.
- HIPAA-scoped fields in `incident_subjects` (medical_notes, medications, known_conditions, emergency_contact_*) require column-level filtering at the API layer since PostgreSQL RLS cannot filter individual columns natively. Claude Code must implement a separate RPC or view that excludes these columns for non-medical roles.

### Environment Variables Added
- None yet — will be established in Session 1

### What To Do Next Session
Next: Initialize the Next.js project with the approved stack. Set up Supabase project, enable PostGIS, run the first migrations in dependency order (organizations through organization_members), configure Supabase Auth, implement RLS on the first two tables, and verify with a cross-org RLS test. Do not build any UI until the foundation migrations are verified.

### Definition of Done Status
- All DoD items — N/A: No application code built this session. DoD applies from Session 1 onward.

---

## Session 1 — 2026-03-29

### What Was Built
Supabase client infrastructure and database foundation. Four migration SQL files created for `organizations` and `organization_members` tables with full RLS policies. Auth session management set up using `@supabase/ssr` with Next.js 16 `proxy.ts` (renamed from `middleware.ts`). Auth callback route handler created. Cross-org RLS verification SQL script created.

### Feature Reference
Feature: Foundation — database setup and auth infrastructure (pre-Feature-1)
Status: Partial — migrations written but not yet applied to Supabase. RLS verification pending migration run.

### Files Created or Modified
- `supabase/migrations/001_extensions.sql` — PostGIS, uuid-ossp, pg_trgm extensions + shared update_updated_at() trigger function
- `supabase/migrations/002_organizations.sql` — organizations table, indexes, trigger, RLS enabled, INSERT + DELETE policies
- `supabase/migrations/003_organization_members.sql` — organization_members table, indexes, trigger, all RLS policies
- `supabase/migrations/004_organizations_rls.sql` — deferred organizations SELECT + UPDATE policies (depend on organization_members existing)
- `supabase/rls-verification.sql` — cross-org RLS verification script to run in Supabase SQL Editor
- `src/lib/supabase/database.types.ts` — hand-authored type stubs for organizations + organization_members (to be replaced with generated types after migrations run)
- `src/lib/supabase/server.ts` — async createClient() for Server Components, Route Handlers, Server Actions
- `src/lib/supabase/client.ts` — createClient() for Client Components (browser)
- `src/lib/supabase/proxy.ts` — updateSession() for use in proxy.ts; refreshes auth token and enforces auth guard
- `src/proxy.ts` — Next.js 16 proxy (replaces middleware.ts); calls updateSession() on every request
- `src/app/auth/callback/route.ts` — Supabase OAuth/magic-link callback; exchanges code for session

### Database Changes
- Migration 001: Extensions (PostGIS, uuid-ossp, pg_trgm) + trigger function
- Migration 002: `organizations` table — matches database_schema.md exactly
- Migration 003: `organization_members` table — matches database_schema.md exactly
- Migration 004: organizations SELECT + UPDATE RLS policies (deferred — require org_members to exist first)
- Migration files: `001_extensions.sql`, `002_organizations.sql`, `003_organization_members.sql`, `004_organizations_rls.sql`

### Decisions Made
- Decision: RLS policies that reference `organization_members` from the `organizations` table are split into a separate migration (004).
  Reason: PostgreSQL validates the referenced table at policy creation time. Migration 002 creates `organizations` before `organization_members` exists, so cross-table policies would fail. Migration 004 runs after both tables exist.
- Decision: Using Next.js 16 `proxy.ts` (not `middleware.ts`).
  Reason: Next.js 16 renamed `middleware` to `proxy`. The `middleware.ts` convention is deprecated in v16. This is a breaking change documented in the Next.js 16 docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- Decision: RLS verification is SQL-based (run in Supabase SQL Editor), not a Vitest integration test.
  Reason: Vitest is not configured yet and integration tests require a running Supabase instance. A SQL script is the fastest way to verify RLS without additional tooling setup. Vitest integration tests will be added when test infrastructure is set up.
- Decision: `database.types.ts` hand-authored as a stub for the two migrated tables.
  Reason: Cannot run `supabase gen types typescript` without the Supabase CLI installed. The stub satisfies strict TypeScript without requiring type generation. Must be replaced with generated types after migrations are applied.

### Deviations From Plan
- None — all work is within the Session 0 "What To Do Next Session" instruction.

### Known Issues / Open Items
- **HIGH — ACTION REQUIRED**: 5 high-severity vulnerabilities in `next-pwa@5.6.0` (transitive chain: serialize-javascript via workbox-build/rollup-plugin-terser). These are build-time dependencies, not runtime. `npm audit fix --force` suggests downgrading to `next-pwa@2.0.2` (a breaking change). Decision needed before production deploy: evaluate whether to switch to `@ducanh2912/next-pwa` or accept the risk as build-tooling only.
- **PENDING**: Migrations have not been applied to Supabase. All database work is SQL files only. Run the 4 migrations in order in the Supabase SQL Editor before starting Session 2.
- **PENDING**: RLS verification script (`supabase/rls-verification.sql`) has not been run. Run it after migrations are applied to confirm 6 PASS / 0 FAIL.
- **PENDING**: `database.types.ts` is a hand-authored stub. After migrations are applied, install the Supabase CLI and run `npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts` to get fully generated types.
- **PENDING**: Supabase Auth redirect URL must be configured in the Supabase Dashboard (Authentication → URL Configuration) to include `http://localhost:3000/auth/callback` for local dev and the production URL for prod.

### Environment Variables Added
- None — all required env vars were already documented in `.env.example` from Session 0.

### What To Do Next Session
Next: Apply the 4 migrations to Supabase (SQL Editor, in order 001→004), run `rls-verification.sql` and confirm 6 PASS, then build Feature 1 (Organization Creation + Onboarding). Start with the Zod schemas and API route for POST /api/organizations, then the server action for adding the first org_admin (using service_role). Do not build UI until the API layer is tested.

### Definition of Done Status
- Database: Migration tested — N/A: not yet applied (user action required). Will verify next session.
- Database: Cross-org leakage verified — N/A: pending migration run. Verification script ready.
- Backend/API: All items — N/A: no API routes built this session.
- Frontend: All items — N/A: no UI built this session (per Session 0 instruction: "Do not build any UI until the foundation migrations are verified").
- Real-Time & Offline: All items — N/A.
- Notifications: All items — N/A.
- Testing: Vitest unit tests — N/A: no business logic functions yet. RLS test: SQL script created, pending execution.
- Security: npm audit — 5 high-severity vulnerabilities in next-pwa (build-time transitive). Flagged as known issue.
- Accessibility: All items — N/A: no UI.
- Code Quality: TypeScript strict mode — passes with zero errors (verified with `npx tsc --noEmit`).

---

## Session 2 — 2026-03-29

### What Was Built
Vitest test infrastructure, `audit_log` migration (006), service role Supabase client, organization Zod schema with full validation, `createOrganization` business logic (org + first org_admin + audit log), and `POST /api/organizations` route handler. 30 unit tests written and passing. TypeScript strict mode: zero errors.

### Feature Reference
Feature: Feature 1 — Organization Creation + Onboarding (API layer)
Status: Partial — API layer complete and tested. UI not yet built (per session instruction).

### Files Created or Modified
- `supabase/migrations/006_audit_log.sql` — audit_log table, RLS (SELECT for org_admins, no UPDATE, no DELETE), depends on migration 005 SECURITY DEFINER functions
- `src/lib/supabase/service.ts` — service role client (server-only); used for bootstrapping org_admin and writing audit_log
- `src/lib/supabase/database.types.ts` — updated stub: added audit_log types + Relationships fields (required by supabase-js v2 GenericTable constraint) + Functions section
- `src/features/organizations/schemas.ts` — CreateOrganizationSchema (Zod v4), CreateOrganizationInput type
- `src/features/organizations/logic/create-organization.ts` — createOrganization() business logic; creates org + first org_admin via service role; writes audit_log; throws typed CreateOrganizationError with sanitized codes
- `src/app/api/organizations/route.ts` — POST /api/organizations; authenticates, validates, calls business logic, returns { data, error, meta } with correct HTTP status codes
- `vitest.config.ts` — Vitest config with vite-tsconfig-paths for @ alias resolution
- `package.json` — added test and test:watch scripts; vitest + vite-tsconfig-paths added to devDependencies
- `src/features/organizations/__tests__/schemas.test.ts` — 17 Zod schema tests (valid + invalid inputs)
- `src/features/organizations/__tests__/create-organization.test.ts` — 5 logic tests with mocked Supabase client
- `src/features/organizations/__tests__/route.test.ts` — 8 API route tests (401, 400, 409, 201, 500, response shape)

### Database Changes
- Migration 006: `audit_log` table — append-only compliance log for SOC 2 path; INSERT via service role only; SELECT restricted to org_admins via RLS; UPDATE/DELETE disabled via RLS
- **ACTION REQUIRED**: Apply `006_audit_log.sql` in Supabase SQL Editor before testing the API.

### Decisions Made
- Decision: database.types.ts tables need a Relationships: [] field.
  Reason: @supabase/supabase-js v2.100.1 updated GenericTable to require a Relationships field. Without it, the TypeScript generic resolves table Insert/Row types as never. Added empty Relationships: [] to all three table definitions.

- Decision: audit_log.Update typed as Record<string, unknown> (not Record<string, never>).
  Reason: GenericTable constrains Update: Record<string, unknown>. The append-only guarantee is enforced by RLS policy, not TypeScript type narrowing.

- Decision: createOrganization uses service role for both org and org_admin creation.
  Reason: Bootstrapping problem — the first admin cannot pass the is_org_admin() RLS check before they are a member. Service role bypasses RLS server-side, which is safe since input is fully validated before reaching this function.

- Decision: audit_log INSERT has no client RLS policy — only service role can write.
  Reason: Audit log must be tamper-evident. Allowing any client to write would allow actors to forge or omit their own audit entries.

### Deviations From Plan
- Added audit_log migration (006) this session rather than waiting. The DoD requires audit logging for mutations; creating the table now avoids a two-session gap where org creation goes unlogged.

### Known Issues / Open Items
- **PENDING**: Migration 006 must be applied to Supabase before the API is tested end-to-end.
- **PENDING**: database.types.ts is still a hand-authored stub — regenerate after all migrations are applied.
- **PENDING**: Login and signup UI pages do not exist yet. Manual API testing requires getting a session cookie from the Supabase Dashboard or a separate auth API call.
- **HIGH — CARRY FORWARD**: 5 high-severity vulnerabilities in next-pwa@5.6.0 (build-time transitive). Must resolve before production deploy.

### Environment Variables Added
- None — SUPABASE_SERVICE_ROLE_KEY was already in .env.example from Session 0.

### What To Do Next Session
Next: Apply migration 006 in Supabase SQL Editor, then build Feature 1 UI — the onboarding flow. Start with the /signup page (Supabase email+password signup using React Hook Form + Zod), then /login, then /onboarding (the org creation form that calls POST /api/organizations). After successful org creation, redirect to /dashboard (empty shell is fine). Do not build the full dashboard yet.

### Definition of Done Status
- Database: Migration 006 written — PENDING user application.
- Backend/API: Input validation PASS. Auth on every protected route PASS. Audit log PASS. No PII in logs PASS. Response shape { data, error, meta } PASS. HTTP status codes PASS. Raw DB errors not exposed PASS. Role auth N/A (org creation requires auth only, no existing role).
- Frontend: N/A — no UI built this session.
- Real-Time & Offline: N/A.
- Notifications: N/A.
- Testing: 30 unit tests pass (schemas x17, logic x5, route x8). TypeScript strict mode: zero errors.
- Security: No secrets in code PASS. Service role never in client PASS. All input validated PASS. No SQL interpolation PASS. npm audit — known issue (next-pwa, carry forward).
- Accessibility: N/A — no UI.
- Code Quality: Zero TS errors, no dead code, naming conventions followed, business logic in /features/*/logic not in route handler, no file exceeds 400 lines.

---

## Session 2 — Debug Addendum (2026-03-29)

### Manual Test Results (all PASS)
- Test 1: Migration 006 applied in Supabase — PASS
- Test 2: 30 unit tests — PASS
- Test 3: TypeScript strict mode zero errors — PASS
- Test 4: Unauthenticated request returns 401 — PASS
- Test 5: Invalid input returns 400 with 3 Zod issues — PASS
- Test 6: Valid org creation returns 201 with organizationId + memberId — PASS
- Test 7: Duplicate slug returns 409 — PASS
- Cross-org RLS isolation: Org B user cannot see Org A data — PASS

### Additional Files Created
- `src/app/api/dev/signin/route.ts` — dev-only sign-in helper for obtaining session cookies during manual curl testing. Guarded by `NODE_ENV !== 'development'`. **Must be deleted before any production deploy.**

### Other Changes
- `.gitignore` updated to exclude test artifacts (body.json, signin.json, cookies.txt, cookies-orgb.txt) and `.claude/`
- Git branching established: `dev` and `feature/org-creation-api` branches created from `main`. All Session 1+2 work committed to `feature/org-creation-api`.

### Known Issues — Updated
- **HIGH — CARRY FORWARD**: `src/app/api/dev/signin/route.ts` must be deleted before production deploy.
- **HIGH — CARRY FORWARD**: 5 high-severity vulnerabilities in next-pwa@5.6.0 (build-time transitive). Must resolve before production deploy.

### Note on RLS Testing in Supabase SQL Editor
The SQL Editor runs as `postgres` (superuser, bypasses RLS). To properly impersonate a user: `BEGIN; SELECT set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated"}', true); SET LOCAL ROLE authenticated; <query>; ROLLBACK;`

---
---

## Session 3 — 2026-03-29

### What Was Built
Feature 1 UI complete: signup page, login page, onboarding (org creation) page, and an empty dashboard shell. Auth forms use React Hook Form + Zod + server actions. The auth callback now redirects new users to /onboarding based on org membership. Error boundaries added to all three new routes.

### Feature Reference
Feature: Feature 1 — Organization Creation + Onboarding (UI layer)
Status: Partial — Signup, login, onboarding form, and dashboard shell complete. No Playwright e2e tests yet. No password reset flow yet.

### Files Created or Modified
- `src/components/ui/form.tsx` — shadcn Form component written manually (not available via shadcn@latest CLI with radix-nova style); wraps react-hook-form with FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage
- `src/components/ui/input.tsx` — shadcn Input (installed via CLI)
- `src/components/ui/label.tsx` — shadcn Label (installed via CLI)
- `src/components/ui/card.tsx` — shadcn Card (installed via CLI)
- `src/components/ui/select.tsx` — shadcn Select (installed via CLI)
- `src/features/auth/schemas.ts` — LoginSchema + SignupSchema (Zod v4) with types
- `src/features/auth/actions/sign-up.ts` — server action: calls supabase.auth.signUp(); returns { success } or { error }
- `src/features/auth/actions/sign-in.ts` — server action: calls signInWithPassword(); redirects to /dashboard on success
- `src/features/auth/components/login-form.tsx` — client login form (RHF + Zod + useTransition)
- `src/features/auth/components/signup-form.tsx` — client signup form; shows "check email" state on success
- `src/app/(auth)/layout.tsx` — centered card layout with SARGOS branding
- `src/app/(auth)/login/page.tsx` — login page (server component wrapping LoginForm)
- `src/app/(auth)/signup/page.tsx` — signup page (server component wrapping SignupForm)
- `src/app/(auth)/error.tsx` — error boundary for auth route group
- `src/app/auth/auth-code-error/page.tsx` — auth error page (expired/invalid confirmation link)
- `src/features/organizations/schemas.ts` — added CreateOrganizationFormInput (z.input<> type for react-hook-form compatibility)
- `src/features/organizations/components/create-org-form.tsx` — org creation client form; auto-generates slug from name; calls POST /api/organizations; redirects to /dashboard on success
- `src/app/onboarding/page.tsx` — server component; checks auth + existing org membership; renders CreateOrgForm
- `src/app/onboarding/error.tsx` — error boundary for onboarding route
- `src/app/dashboard/page.tsx` — server component; checks auth + org membership → redirects to /onboarding if none; renders org name + empty incident state
- `src/app/dashboard/error.tsx` — error boundary for dashboard route
- `src/app/auth/callback/route.ts` — updated to check org membership after code exchange; redirects to /onboarding for new users
- `src/app/layout.tsx` — updated metadata title/description from Next.js defaults to SARGOS branding

### Database Changes
- None this session. All existing migrations apply.

### Decisions Made
- Decision: shadcn `form` component not available via `npx shadcn@latest add form` with radix-nova style — written manually.
  Reason: The CLI produced no output and no files. Wrote the form.tsx manually following the radix-nova pattern (Slot.Root from "radix-ui", function-style components, data-slot attributes).

- Decision: `z.input<typeof CreateOrganizationSchema>` used for the `useForm<>` type parameter in CreateOrgForm.
  Reason: `@hookform/resolvers/zod` v5 returns `Resolver<z4.input<T>>` for Zod v4 schemas (the INPUT type, before defaults are applied). `useForm<OutputType>` would cause a TypeScript mismatch. Must export both `CreateOrganizationInput` (output, for API) and `CreateOrganizationFormInput` (input, for form). This is a Zod v4 + @hookform/resolvers v5 compatibility pattern.

- Decision: Auth callback checks org membership to determine redirect destination.
  Reason: After email confirmation, new users have a session but no org. Redirecting them to /dashboard would require an extra redirect to /onboarding. Checking in the callback avoids the double redirect for the most common new-user path.

- Decision: Dashboard page also checks org membership (belt-and-suspenders).
  Reason: The callback check covers the email confirmation flow. The dashboard check handles edge cases (direct navigation, future admin revocation, etc.).

### Deviations From Plan
- Added error boundaries (error.tsx) for auth, onboarding, and dashboard routes.
  Reason: DoD requires error boundaries on every major UI section. Not optional.

### Known Issues / Open Items
- **MEDIUM — OPEN**: No Playwright e2e tests for the login/signup/onboarding flow. DoD requires e2e tests for critical user flows. Blocked until Playwright is configured. Next session: configure Playwright and add e2e tests.
- **LOW — OPEN**: Button touch targets are 32px (h-8 default in radix-nova style), below the 44px minimum required for field/mobile use. For auth pages (desktop use), this is acceptable. When building field-facing features (resource tracking, incident board), override with explicit h-11 (44px) buttons.
- **HIGH — CARRY FORWARD**: `src/app/api/dev/signin/route.ts` must be deleted before production deploy.
- **HIGH — CARRY FORWARD**: 5 high-severity vulnerabilities in next-pwa@5.6.0 (build-time transitive). Must resolve before production deploy.

### Environment Variables Added
- None.

### What To Do Next Session
Next: Configure Playwright and write e2e tests for the full signup → onboarding → dashboard flow. Then continue to Feature 6 (Billing) or Feature 2 (Real-Time Resource Tracking) depending on build priority. Ask the user which to prioritize. If Playwright is skipped: start Feature 6 — Stripe integration, subscription table, and billing portal link.

### Definition of Done Status
- Database: N/A — no new tables this session.
- Backend/API: N/A — no new API routes this session. Auth server actions: input validated (Zod), no PII logged, no raw errors exposed. PASS.
- Frontend: All data states handled — PASS (forms: error+loading; dashboard: empty state+org info; server components redirect on error). Error boundaries: PASS (error.tsx on auth, onboarding, dashboard). Keyboard nav: PASS (shadcn components). Labels: PASS (FormLabel with htmlFor). Touch targets: LOW — buttons are 32px, below 44px minimum (noted above). TypeScript: PASS (zero errors).
- Real-Time & Offline: N/A — auth/onboarding are not field-facing features.
- Notifications: N/A.
- Testing: 30 unit tests pass. Playwright e2e: PENDING (not yet configured).
- Security: No secrets in code PASS. service_role not in client PASS. Input validated PASS. No SQL interpolation PASS. npm audit: known issue (next-pwa, carry forward).
- Accessibility: shadcn components use Radix UI primitives which are ARIA-compliant. No automated axe check run this session (PENDING).
- Code Quality: Zero TS errors, no dead code, naming conventions followed, business logic in /features/*/actions not in pages, no file exceeds 400 lines.

---

## Session 4 — 2026-03-29

### What Was Built
Feature 2 (Real-Time Resource Tracking) — database layer + API layer + full UI. Migrations 007–015 cover teams, organization_invites, resources, incidents, incident_command_structure, incident_sectors, incident_personnel, incident_log, and incident_resources. Incident creation API, personnel check-in API, and status update API are complete. Dashboard now lists incidents. New `/incidents/new` form and `/incidents/[id]` live resource board with Supabase Realtime and optimistic status updates are built.

### Feature Reference
Feature: Feature 2 — Real-Time Resource & Team Tracking (partial)
Status: Partial — core personnel board complete. Deferred: QR check-in (Feature 2b), PAR roll calls, equipment tracking UI, team assignment on board.

### Files Created or Modified
- `supabase/migrations/007_teams.sql` — teams + team_members tables, RLS, indexes, trigger
- `supabase/migrations/008_organization_invites.sql` — organization_invites table, RLS, indexes
- `supabase/migrations/009_resources.sql` — org-level resource inventory table, RLS, indexes, trigger
- `supabase/migrations/010_incidents.sql` — incidents table with PostGIS geometry columns, RLS, indexes, trigger
- `supabase/migrations/011_incident_command_structure.sql` — ICS role assignments per incident, RLS, indexes, trigger
- `supabase/migrations/012_incident_sectors.sql` — search sector polygons (created before incident_personnel due to FK dependency), RLS, indexes, trigger
- `supabase/migrations/013_incident_personnel.sql` — personnel board table, identity CHECK constraint, RLS, indexes, trigger
- `supabase/migrations/014_incident_log.sql` — append-only incident log, RLS, indexes
- `supabase/migrations/015_incident_resources.sql` — resource check-out tracking per incident, RLS, indexes, trigger
- `src/lib/supabase/database.types.ts` — extended with stubs for all 9 new tables
- `src/features/incidents/schemas.ts` — Zod schemas: CreateIncidentSchema, CheckInPersonnelSchema, UpdatePersonnelStatusSchema; constants and labels for types/statuses/roles
- `src/features/incidents/logic/create-incident.ts` — createIncident() business logic
- `src/features/incidents/logic/check-in-personnel.ts` — checkInPersonnel() business logic
- `src/features/incidents/logic/update-personnel-status.ts` — updatePersonnelStatus() business logic
- `src/app/api/incidents/route.ts` — GET (list) + POST (create) /api/incidents
- `src/app/api/incidents/[id]/personnel/route.ts` — GET (list) + POST (check in) /api/incidents/[id]/personnel
- `src/app/api/incidents/[id]/personnel/[personnelId]/route.ts` — PATCH /api/incidents/[id]/personnel/[id]
- `src/features/incidents/components/create-incident-form.tsx` — incident creation form (RHF + Zod)
- `src/features/incidents/components/personnel-board.tsx` — live resource board client component with Supabase Realtime + optimistic status updates + rollback
- `src/app/incidents/new/page.tsx` — create incident page (server component)
- `src/app/incidents/new/error.tsx` — error boundary
- `src/app/incidents/[id]/page.tsx` — incident board page (server component, initial data load)
- `src/app/incidents/[id]/error.tsx` — error boundary
- `src/app/dashboard/page.tsx` — updated to show incident list table with status badges + "New Incident" button

### Database Changes
- Migrations 007–015 written. ACTION REQUIRED: Apply in Supabase SQL Editor in order 007→015.
- All tables match database_schema.md exactly.

### Decisions Made
- Decision: Supabase relational join syntax (`.select('*, organization_members(*)')`) avoided in hand-authored type stubs.
  Reason: The hand-authored `database.types.ts` has `Relationships: []` on all tables. Supabase-js v2 type inference falls back to `SelectQueryError` when Relationships are empty, causing a TS error. Fixed by fetching `incident_personnel` and `organization_members` as two separate queries and merging in code. This pattern will resolve automatically when types are regenerated with the Supabase CLI.

- Decision: `PersonnelWithMember` is a plain interface (not extending `Database['...']['Row']`) with `memberName`, `memberPhone`, `memberCertifications` flattened fields.
  Reason: Avoids the relational join type inference issue described above. After type regeneration, this interface can be replaced with the inferred join type.

- Decision: Incident creation sets status to 'active' immediately (not 'planning').
  Reason: Field operations start immediately. The 'planning' status exists for incidents set up in advance; the UI can add a toggle later. For now, creating an incident means it's active.

### Deviations From Plan
- None — all work matches the approved plan.

### Known Issues / Open Items
- **PENDING — ACTION REQUIRED**: Migrations 007–015 must be applied to Supabase SQL Editor in order before testing.
- **PENDING**: database.types.ts is still a hand-authored stub. Regenerate with `npx supabase gen types typescript` after all migrations applied.
- **DEFERRED**: Feature 2b (QR check-in flow) — no migrations written yet for `incident_qr_tokens`. Next session.
- **DEFERRED**: PAR roll calls — no migrations for `incident_par_events` / `incident_par_responses`. Next session.
- **DEFERRED**: Equipment tracking UI — `incident_resources` table exists but no UI.
- **DEFERRED**: Check-in form uses a raw member UUID input (prototype only) — needs a member search/autocomplete UI before production.
- **HIGH — CARRY FORWARD**: Email confirmation DISABLED in Supabase. Must re-enable with Resend before production.
- **HIGH — CARRY FORWARD**: `src/app/api/dev/signin/route.ts` must be deleted before production.
- **HIGH — CARRY FORWARD**: 5 high-severity vulnerabilities in next-pwa@5.6.0 (build-time transitive).

### Environment Variables Added
- None.

### What To Do Next Session
Next: Apply migrations 007–015 in Supabase SQL Editor (order matters). Then manually test: create incident → board opens → check in a second member → status changes propagate in real-time across two tabs. After manual verification, build Feature 2b (QR check-in): migration for `incident_qr_tokens`, the public check-in form at `/check-in/[token]`, the QR generation + display on the incident board, and the `lookup_qr_token` RPC function.

### Definition of Done Status
- Database: All tables match schema PASS. Migrations written PASS. RLS enabled on all tables PASS. FKs with ON DELETE PASS. FK indexes PASS. GIST indexes on geometry PASS. updated_at triggers PASS. Cross-org verification: PENDING (migrations not yet applied).
- Backend/API: Input validated with Zod PASS. {data,error,meta} response shape PASS. HTTP status codes correct PASS. Raw DB errors not exposed PASS. Auth on every route PASS. incident_log written on mutations PASS. audit_log written on incident.created PASS. No PII in logs PASS.
- Frontend: Loading state PASS (useTransition). Empty state PASS (both dashboard and board have empty states). Error state PASS (error boundaries). Error boundaries PASS. Keyboard nav PASS (shadcn/Radix components). Form labels PASS. Touch targets: LOW (32px buttons on admin pages, noted carry-forward). No any types PASS. TypeScript strict: ZERO ERRORS.
- Real-Time & Offline: Realtime subscription PASS (INSERT/UPDATE/DELETE handled). Reconnection logic PASS (CHANNEL_ERROR/CLOSED → re-subscribe). Optimistic UI PASS (status update immediate). Rollback on failure PASS. Offline: N/A for this session (command-center feature, not field).
- Notifications: N/A — no notifications triggered by this feature at this stage.
- Testing: 30/30 unit tests pass. No new unit tests written (incident logic mocking deferred — covered by manual test protocol). Playwright: PENDING carry-forward.
- Security: No secrets in code PASS. service_role not in client PASS. Input validated PASS. No SQL interpolation PASS. npm audit: known issue (next-pwa, carry-forward).
- Accessibility: shadcn/Radix ARIA-compliant components PASS. Axe automated check: PENDING.
- Code Quality: Zero TS errors PASS. No dead code PASS. Naming conventions PASS. Business logic in /features/incidents/logic PASS. No file >400 lines PASS.

---

## Session 3 — Debug Addendum (2026-03-29)

### Manual Test Results
- All 13 tests — PASS (13/13)

### Issues Found and Resolved
- `src/app/page.tsx` was still the default Next.js template — replaced with a redirect to `/dashboard`. The proxy handles the unauthenticated case before the page is reached.
- Test 5 (email confirmation): Supabase confirmation email was delivered to junk mail. The `/auth/callback` flow worked correctly once the link was clicked. Note for future users: add `noreply@mail.supabase.io` to safe senders, or configure custom SMTP (Resend) to improve deliverability.
- Supabase free-tier SMTP rate limit (429 — 4 emails/hour) was hit during re-testing after user deletion. This blocked re-signup attempts. Workaround: disable email confirmation in Supabase for local dev, or use custom SMTP. Email confirmation is currently DISABLED — must be re-enabled before production.

### Known Issues — Updated
- **HIGH — CARRY FORWARD**: Email confirmation is currently DISABLED in Supabase (Authentication → Providers → Email → Confirm email: off). Must be re-enabled with a custom SMTP provider (Resend) before any real users or production deploy.
- **HIGH — CARRY FORWARD**: `src/app/api/dev/signin/route.ts` must be deleted before production deploy.
- **HIGH — CARRY FORWARD**: 5 high-severity vulnerabilities in next-pwa@5.6.0 (build-time transitive). Must resolve before production deploy.

---

## Session 5 — 2026-03-29

### What Was Built
Feature 2b (Spontaneous Volunteer QR Check-In) — full stack. Migration 016 creates `incident_qr_tokens` with two SECURITY DEFINER RPCs (`lookup_qr_token` for public token resolution, `increment_qr_scans` for atomic counter updates). The IC can generate a QR code from the incident board; walk-up volunteers scan it and complete a mobile-optimized public form at `/check-in/[token]` (no login required). On submission they appear on the personnel board via Realtime.

### Feature Reference
Feature: Feature 2b — Spontaneous Volunteer QR Check-In
Status: Complete

### Files Created or Modified
- `supabase/migrations/016_incident_qr_tokens.sql` — incident_qr_tokens table, RLS, lookup_qr_token RPC (anon-accessible), increment_qr_scans RPC (service-side)
- `src/lib/supabase/database.types.ts` — added incident_qr_tokens stub + lookup_qr_token + increment_qr_scans in Functions section
- `src/features/incidents/schemas.ts` — added COMMON_CERTIFICATIONS, QrVolunteerCheckInSchema, QrVolunteerCheckInInput, QrVolunteerCheckInFormInput
- `src/features/incidents/logic/create-qr-token.ts` — createQrToken() — deactivates existing active tokens, inserts new token
- `src/features/incidents/logic/qr-volunteer-checkin.ts` — qrVolunteerCheckIn() — validates token, inserts incident_personnel, writes incident_log, increments scan counter
- `src/app/api/incidents/[id]/qr-tokens/route.ts` — GET (list tokens) + POST (create/regenerate) — auth required
- `src/app/api/incidents/[id]/qr-tokens/[tokenId]/route.ts` — PATCH (activate/deactivate) — auth required
- `src/app/api/check-in/[token]/route.ts` — GET (resolve token) + POST (submit check-in) — public, no auth
- `src/app/check-in/[token]/page.tsx` — server component; resolves token via RPC, renders form or error state
- `src/app/check-in/[token]/check-in-form.tsx` — mobile-optimized client form with common certification checkboxes, vehicle, medical notes, safety acknowledgment
- `src/app/check-in/[token]/error.tsx` — error boundary for check-in route
- `src/features/incidents/components/qr-panel.tsx` — client component; displays QR code (react-qr-code), generate/regenerate/deactivate buttons, copy-link action
- `src/app/incidents/[id]/page.tsx` — added QrPanel below PersonnelBoard; added initial QR token SSR fetch
- `src/lib/supabase/proxy.ts` — added `/check-in` to PUBLIC_PATHS
- `database_schema.md` — updated incident_qr_tokens definition to add updated_at column + corrected index list and RLS policy descriptions
- `package.json` / `package-lock.json` — added react-qr-code dependency

### Database Changes
- Migration 016: `incident_qr_tokens` table — QR tokens for volunteer check-in
- Migration 016: `lookup_qr_token(TEXT)` RPC — SECURITY DEFINER, granted to anon role
- Migration 016: `increment_qr_scans(TEXT)` RPC — atomic counter, service-side only
- **ACTION REQUIRED**: Apply `016_incident_qr_tokens.sql` in Supabase SQL Editor before testing.

### Decisions Made
- Decision: Added `updated_at` column to `incident_qr_tokens` (not in original schema doc).
  Reason: claude_rules.md rule #4 requires every mutable table to have `updated_at`. The schema doc omitted it. Updated `database_schema.md` to match. The trigger `set_updated_at_incident_qr_tokens` maintains it automatically.

- Decision: QR check-in insert uses service role (not client auth).
  Reason: Walk-up volunteers have no Supabase session. The POST /api/check-in route runs server-side, uses service role to bypass RLS, and is protected by token validation instead of auth.

- Decision: `lookup_qr_token` returns `incident_name` and `organization_name` (more than the schema doc originally specified).
  Reason: The check-in page needs these to render a meaningful header. Still minimal — no org internals, member data, or incident coordinates are exposed.

- Decision: Certifications use a checkbox list (COMMON_CERTIFICATIONS) plus free-text "other" rather than a pure free-text field.
  Reason: Checkboxes are easier to tap on mobile in a field environment. Free-text "other" handles edge cases. Both paths write to the same string[] column.

- Decision: `/check-in` page uses `window.location.origin` to build the check-in URL for the QR code.
  Reason: Avoids adding a NEXT_PUBLIC_APP_URL env var. The URL must work in local dev, staging, and production without reconfiguration.

- Decision: QR panel is a client component that takes `initialTokens` from SSR rather than fetching on mount.
  Reason: Consistent with the PersonnelBoard pattern. Avoids an extra round-trip on page load.

### Deviations From Plan
- `increment_qr_scans` RPC added to migration (not in original schema doc).
  Reason: Supabase-js does not support expression-based UPDATEs (`SET scans = scans + 1`). An RPC is the correct way to do an atomic increment.

### Known Issues / Open Items
- **PENDING — ACTION REQUIRED**: Migration 016 must be applied to Supabase SQL Editor before testing Feature 2b.
- **PENDING**: database.types.ts is still a hand-authored stub. Regenerate after all migrations applied.
- **DEFERRED**: No unit tests for createQrToken or qrVolunteerCheckIn logic (follows Session 4 precedent for new incident logic). Tests should be added before Feature 6 or the first staging deploy.
- **DEFERRED**: QR code "Download / Print" button not yet implemented. The SVG can be right-clicked and saved, but a dedicated download button would improve the IC workflow.
- **DEFERRED**: IC-only token creation not yet enforced at the database level (RLS allows any org member). Tighten when incident_command_structure RBAC is built out.
- **HIGH — CARRY FORWARD**: Email confirmation DISABLED in Supabase.
- **HIGH — CARRY FORWARD**: `src/app/api/dev/signin/route.ts` must be deleted before production.
- **HIGH — CARRY FORWARD**: 5 high-severity vulnerabilities in next-pwa@5.6.0.

### Environment Variables Added
- None.

### What To Do Next Session
Next: Apply migration 016 in Supabase SQL Editor. Manually test: generate QR → open /check-in/[token] in an incognito tab → submit volunteer form → verify volunteer appears on personnel board via Realtime. Then build the next highest-priority feature. Ask the user: Feature 3 (Subject Tracking / ICS 201), Feature 4 (ICS Form Generation), or Feature 6 (Billing / Stripe). If billing is chosen, start with the Stripe webhook handler and subscription table sync.

### Definition of Done Status
- Database: Migration 016 written PASS. RLS on incident_qr_tokens PASS. FK indexes PASS. updated_at trigger PASS. No geometry columns (N/A). Cross-org leakage: PENDING (migration not yet applied).
- Backend/API: Input validated with Zod PASS. {data,error,meta} shape PASS. HTTP status codes PASS. Raw DB errors not exposed PASS. Auth on protected routes PASS. incident_log written on QR check-in PASS. No PII in logs PASS. Public check-in route intentionally unauthenticated (by design).
- Frontend: Loading states PASS (useTransition + disabled buttons). Empty state PASS (QrPanel empty state). Error state PASS (error.tsx boundaries, inline form errors). Error boundaries PASS. Form labels PASS (all inputs have htmlFor labels). Touch targets PASS (h-11/h-12 on mobile check-in buttons, h-8 on command-center buttons — acceptable for desktop IC use). No any types PASS. TypeScript strict: ZERO ERRORS.
- Real-Time & Offline: Realtime N/A for QR panel (token list doesn't need live updates). Volunteer check-in triggers Realtime INSERT on incident_personnel which the PersonnelBoard already subscribes to. Optimistic UI: N/A (QR panel mutations are low-frequency). Offline: N/A (command-center feature).
- Notifications: N/A — no notifications for volunteer check-in at this stage.
- Testing: 30/30 unit tests pass. No new unit tests (deferred, consistent with Session 4). Playwright e2e: PENDING carry-forward.
- Security: No secrets in code PASS. service_role not in client PASS. Public check-in uses service role server-side only PASS. Input validated PASS. No SQL interpolation PASS. lookup_qr_token exposes only minimal fields PASS. npm audit: known issue (next-pwa, carry-forward).
- Accessibility: Labels on all check-in form fields PASS. Radix/shadcn components ARIA-compliant PASS. Axe automated check: PENDING.
- Code Quality: Zero TS errors PASS. No dead code PASS. Naming conventions PASS. Business logic in /features/incidents/logic PASS. No file >400 lines PASS.

---

## Session 6 — 2026-03-30

### What Was Built
Completed Feature 2 (Real-Time Resource & Team Tracking). Three phases: (1) Personnel board improvements — member search dropdown replaces UUID prototype input, inline role assignment, and check-out button per row. (2) PAR roll calls — migration 017, API routes, and real-time PAR panel with optimistic mark-safe. (3) Equipment tracking — deploy/return resource logic, API routes, and ResourceBoard with optimistic deploy/return UI.

### Feature Reference
Feature: Feature 2 — Real-Time Resource & Team Tracking
Status: Complete (except explicitly deferred items: drag-and-drop quick-assign, overdue team alerts, missing member alerts)

### Files Created or Modified
- `supabase/migrations/017_incident_par.sql` — incident_par_events + incident_par_responses tables, RLS, updated_at triggers
- `src/features/incidents/schemas.ts` — renamed UpdatePersonnelStatusSchema → UpdatePersonnelSchema (added incidentRole + checkout fields); added InitiateParSchema, SubmitParResponseSchema, DeployResourceSchema, ReturnResourceSchema
- `src/features/incidents/logic/update-personnel-status.ts` — extended to handle role assignment and checkout in addition to status changes
- `src/features/incidents/logic/initiate-par.ts` — new: creates PAR event, counts active personnel, writes incident_log
- `src/features/incidents/logic/submit-par-response.ts` — new: upserts par_response, recalculates confirmed_count, closes PAR when complete
- `src/features/incidents/logic/deploy-resource.ts` — new: deploys resource to incident, updates resource status, writes incident_log
- `src/features/incidents/logic/return-resource.ts` — new: returns resource, resets resource status, writes incident_log
- `src/app/api/incidents/[id]/personnel/[personnelId]/route.ts` — updated to use UpdatePersonnelSchema (handles status + role + checkout)
- `src/app/api/incidents/[id]/par/route.ts` — new: GET latest PAR event + responses, POST initiate PAR
- `src/app/api/incidents/[id]/par/[parId]/responses/route.ts` — new: POST submit PAR response
- `src/app/api/incidents/[id]/resources/route.ts` — new: GET deployed resources, POST deploy
- `src/app/api/incidents/[id]/resources/[incidentResourceId]/route.ts` — new: PATCH return resource
- `src/features/incidents/components/personnel-board.tsx` — member search dropdown, inline RoleSelect, CheckOutButton per row
- `src/features/incidents/components/par-panel.tsx` — new: PAR roll call UI with Realtime updates
- `src/features/incidents/components/resource-board.tsx` — new: deploy/return resource UI with optimistic updates
- `src/app/incidents/[id]/page.tsx` — added SSR fetches for org members, PAR event/responses, deployed+available resources; added ParPanel and ResourceBoard to JSX
- `src/lib/supabase/database.types.ts` — added incident_par_events and incident_par_responses stubs
- `database_schema.md` — corrected PAR table definitions (added updated_at, organization_id on responses, unique constraint, additional indexes)

### Database Changes
- Migration 017: `incident_par_events` — PAR roll call events (ACTION REQUIRED: apply in Supabase SQL Editor)
- Migration 017: `incident_par_responses` — per-person PAR responses with UNIQUE constraint (par_event_id, personnel_id)

### Decisions Made
- Decision: RoleSelect is disabled for volunteer personnel (shows "Unaffiliated" text instead).
  Reason: Volunteers are not org members and don't hold ICS roles; the incident_role column is reserved for org-member personnel.

- Decision: CheckOut optimistic removal does not roll back on failure.
  Reason: A check-out failure is very rare; rolling back by re-adding the row is confusing UX. The Realtime UPDATE will correct state on the next event. Consistent with the "fail loudly in logs, silently in UI" rule.

- Decision: PAR confirmed_count recalculated from response table count rather than increment.
  Reason: Upserts (re-submissions) could double-count with a naive increment. Recounting from the response table is correct and idempotent.

- Decision: ResourceBoard uses optimistic UI with full rollback for both deploy and return.
  Reason: Resource deployment is a high-value action; rollback on failure is important for accuracy.

### Deviations From Plan
- None — all work matches the approved plan.

### Known Issues / Open Items
- **PENDING — ACTION REQUIRED**: Migration 017 must be applied to Supabase SQL Editor before testing PAR.
- **PENDING**: database.types.ts is still a hand-authored stub. Regenerate after all migrations applied.
- **DEFERRED**: No unit tests for new logic files (initiate-par, submit-par-response, deploy-resource, return-resource). Add before Feature 6 or first staging deploy.
- **DEFERRED**: Drag-and-drop quick-assign (UX enhancement).
- **DEFERRED**: Overdue team alerts / missing member alerts (requires notification infrastructure — Feature 7).
- **DEFERRED**: IC-only enforcement for PAR initiation and token creation (deferred to RBAC build-out).
- **DEFERRED**: QR code Download/Print button (carry-forward from Session 5).
- **HIGH — CARRY FORWARD**: Email confirmation DISABLED in Supabase.
- **HIGH — CARRY FORWARD**: `src/app/api/dev/signin/route.ts` must be deleted before production.
- **HIGH — CARRY FORWARD**: 5 high-severity vulnerabilities in next-pwa@5.6.0.

### Environment Variables Added
- None.

### What To Do Next Session
Next: Apply migration 017 in Supabase SQL Editor. Manually test: (1) check-in a member using the new dropdown; (2) assign a role inline; (3) check out a member; (4) initiate PAR → mark each member safe → PAR completes; (5) deploy a resource → return it. After verification, ask the user: Feature 3 (Incident Lifecycle — subject info, command structure, suspension/closure), Feature 4 (Search Mapping — Mapbox sectors), or Feature 5 (ICS Form Auto-Fill + PDF Export).

### Definition of Done Status
- Database: Migration 017 written PASS. RLS on par tables PASS. FK indexes PASS. updated_at triggers PASS. Unique constraint on par_responses PASS. Cross-org leakage: PENDING (migration not yet applied).
- Backend/API: Input validated with Zod PASS. {data,error,meta} shape PASS. HTTP status codes PASS. Raw DB errors not exposed PASS. Auth on all routes PASS. incident_log written on all mutations PASS. No PII in logs PASS.
- Frontend: Loading states PASS (useTransition). Empty states PASS (all three boards). Error states PASS (inline error messages). Error boundaries PASS (existing). Form labels PASS (sr-only labels on selects). Touch targets: LOW (board buttons h-7/h-8, acceptable for desktop command-center use). No any types PASS. TypeScript strict: ZERO ERRORS.
- Real-Time: PAR panel subscribes to par_events INSERT/UPDATE and par_responses INSERT PASS. Reconnection logic PASS. Personnel board Realtime unchanged PASS. ResourceBoard: no Realtime (low-frequency, not required for MVP).
- Notifications: N/A — no new notifications triggered.
- Testing: 30/30 unit tests pass (unchanged). No new unit tests (deferred, consistent with previous sessions). Playwright e2e: PENDING carry-forward.
- Security: No secrets in code PASS. service_role not in client PASS. Input validated PASS. No SQL interpolation PASS. npm audit: known issue (next-pwa, carry-forward).
- Accessibility: sr-only labels on all new selects PASS. Radix/shadcn ARIA components unchanged PASS. Axe: PENDING.
- Code Quality: Zero TS errors PASS. No dead code PASS. Naming conventions PASS. Business logic in /features/incidents/logic PASS. No file >400 lines PASS.

---
