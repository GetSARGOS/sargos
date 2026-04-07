# Claude Rules — SAR SaaS Platform
> These rules are non-negotiable constraints for this project. Claude Code must follow them in every file, every decision, and every suggestion. When in doubt, ask before deviating.

---

## 1. Identity & Purpose

This is a **Search and Rescue (SAR) SaaS platform** serving volunteer and professional emergency management teams. The software directly supports life-safety operations. Every architectural, security, and reliability decision must reflect that weight.

- Correctness and reliability always outrank speed of delivery
- Never take shortcuts that could compromise data integrity or system availability
- **Compliance roadmap — current state vs target:**
  - **Current (MVP):** SOC 2-ready architecture. No PHI collected or displayed. No HIPAA obligations at this tier. US-only market.
  - **Target (pre-Professional tier sales):** Supabase Team plan + HIPAA add-on + signed BAA. PHI fields enabled in UI. Application-level encryption for PHI columns. PHI read-access logging. Consult a HIPAA attorney before enabling.
  - **Target (Enterprise tier):** FedRAMP authorization. AWS GovCloud migration. SAML/SSO.
  - **Target (International expansion):** GDPR compliance (EU). Data residency controls (multi-region Supabase or regional deployments). PIPEDA compliance (Canada). Privacy Impact Assessments per market. Consult a data protection attorney before entering any non-US market. See Section 22 for internationalization architecture rules.
- Every architectural decision should keep the SOC 2 → HIPAA → FedRAMP → International path open, but MVP ships without HIPAA or international obligations

---

## 2. Approved Tech Stack

This stack is locked. Do not introduce technologies outside of it without explicit approval.

### Frontend
- **Framework:** Next.js (App Router) with TypeScript — strict mode always enabled
- **Styling:** Tailwind CSS only — no inline styles, no CSS modules, no styled-components
- **Mapping:** Mapbox GL JS — no Leaflet, no Google Maps
- **UI Components:** shadcn/ui built on Radix UI — no other component libraries
- **State Management:** Zustand for client state, React Query (TanStack Query) for server state
- **Forms:** React Hook Form with Zod validation
- **PDF Generation:** React-PDF (@react-pdf/renderer) for ICS form output
- **PWA:** next-pwa for service worker and offline support

### Backend & Database
- **Platform:** Supabase (PostgreSQL) — all database, auth, storage, and realtime needs go through Supabase
- **ORM / Query Layer:** Supabase JS client with typed queries generated from the database schema
- **Geospatial:** PostGIS extension — all geographic data uses PostGIS types and functions
- **Edge Functions:** Supabase Edge Functions (Deno) for server-side logic that cannot live in Next.js API routes
- **Realtime:** Supabase Realtime for all live collaboration features
- **Rate Limiting:** Upstash Redis (`@upstash/ratelimit`) for serverless-compatible API rate limiting

### Auth
- **Provider:** Supabase Auth — no third-party auth providers (Auth0, Clerk, etc.)
- **Authorization:** Row Level Security (RLS) enforced at the database level on every table — application-level checks alone are never sufficient

### Infrastructure & Hosting
- **Frontend Hosting:** Vercel
- **Backend:** Supabase Cloud
- **File Storage:** Supabase Storage — no direct S3 unless a migration to GovCloud requires it
- **CDN:** Vercel Edge Network (automatic)
- **DNS / SSL:** Managed through Vercel — always HTTPS, never HTTP

### Payments
- **Provider:** Stripe — no other payment processors

### Future Federal Path
- Architecture must support a migration to **AWS GovCloud** for the Supabase backend
- Do not create hard dependencies that would prevent a GovCloud migration

---

## 3. TypeScript Rules

- TypeScript strict mode is always on — `"strict": true` in tsconfig
- No use of `any` type — ever. Use `unknown` and narrow it properly
- All function arguments and return types must be explicitly typed
- All Supabase query results must be typed using generated database types (`supabase gen types typescript`)
- Zod schemas must be defined for all user input — validate at the boundary before it touches any logic or database call

---

## 4. Architecture Rules

### General
- **Separation of concerns:** UI components do not contain business logic. Business logic does not live in API routes. Keep layers clean.
- **Feature-based folder structure:** Organize code by feature domain (e.g., `/features/incidents`, `/features/resources`, `/features/ics-forms`), not by file type
- **No god files:** No single file should exceed 400 lines. Break it up.
- **No magic numbers or strings:** All constants go in a dedicated `/constants` directory with named exports
- **Internationalization is deferred to post-MVP.** UI strings are hardcoded in English. When i18n is introduced, use ICU MessageFormat via `next-intl`. Do not prematurely abstract strings — the cost of retrofitting is lower than the cost of maintaining an i18n layer before it's needed.

### API Design
- All Next.js API routes must validate input with Zod before processing
- All API responses follow a consistent shape: `{ data, error, meta }`
- HTTP status codes must be semantically correct — never return 200 with an error in the body
- All mutations must be idempotent where possible
- Never expose raw database errors to the client — log them server-side, return sanitized messages
- **API versioning:** Internal API routes are unversioned. When the public API is built (Feature 20), introduce URL-based versioning (`/api/v1/`). Until then, breaking changes to internal APIs are coordinated through the mobile app release cycle.
- **Pagination:** All list endpoints must be paginated. Two patterns are used based on data characteristics:
  - **Cursor-based** for high-write/append-only tables: `incident_log`, `audit_log`, `notifications`. Query params: `?cursor=<opaque>&limit=25`. Response meta: `{ cursor, hasMore }`. Cursor is `created_at` + `id` of the last item, base64-encoded.
  - **Offset-based** for stable/low-write lists: member directory, team list, incident list, resources. Query params: `?page=1&pageSize=25`. Response meta: `{ page, pageSize, totalCount, totalPages, hasMore }`.
  - **Default page size:** 25. Incident log: 50. **Maximum page size:** 100.
  - **Shared utility:** `/lib/pagination.ts` exports `parseCursorParams()`, `parseOffsetParams()`, `buildCursorMeta()`, and `buildOffsetMeta()`. All list API routes use these helpers.
- **Error codes:** All API error responses include a machine-readable `code` field from a centralized registry at `/constants/error-codes.ts`.
  - Naming convention: `DOMAIN_ACTION` in `SCREAMING_SNAKE_CASE` (e.g., `INCIDENT_NOT_FOUND`, `ORG_SLUG_TAKEN`, `AUTH_SESSION_EXPIRED`).
  - Each entry is an object: `{ code: string, status: number }`. Multiple error codes may share an HTTP status (many-to-one).
  - Error response shape: `{ data: null, error: { code: 'INCIDENT_NOT_FOUND', message: 'Human-readable description' }, meta: null }`.
  - Every new API route must use error codes from the registry. If a new code is needed, add it to the registry first.

### Timezone Convention
- All timestamps in the database are `TIMESTAMPTZ` (stored as UTC). The API always returns ISO 8601 UTC strings.
- Each incident has a `timezone` column (IANA identifier, e.g., `'America/Los_Angeles'`). All users viewing an incident see times formatted in that incident's timezone.
- Timezone is set at incident creation (auto-detected from coordinates or manually selected) and editable by the IC.
- Client-side formatting only — use `Intl.DateTimeFormat` with the incident's `timezone` value. Never format times server-side.
- Project-wide display format: `DD MMM YYYY HH:mm z` (e.g., `03 Apr 2026 14:32 PST`). Defined as a constant in `/constants/date-format.ts`.
- Non-incident-scoped timestamps (org settings, billing, audit log viewer) use the user's browser timezone.

### Database
- Every table must have: `id` (UUID, default `gen_random_uuid()`), `created_at`, `updated_at`
- All `updated_at` columns must be automatically maintained via a PostgreSQL trigger
- Foreign keys must always have explicit `ON DELETE` behavior defined — never leave it implicit
- Migrations are versioned and sequential — never edit a migration that has already been applied
- No application logic in triggers or functions unless it is purely data-integrity logic (e.g., cascades, timestamps)
- PostGIS geometry columns must always have an SRID defined (use EPSG:4326 — WGS84)
- **No local Supabase / Docker.** This project does not use Docker or a local Supabase stack. The Next.js dev server runs against a Supabase Cloud development project. Migrations are applied via the Supabase Cloud SQL Editor (or `supabase db push` against the cloud project). Never run `supabase start`, `supabase db reset`, or any command that requires Docker.
- **Migration rollback strategy:**
  - **Dev Supabase project (pre-merge to `dev`):** If a migration has only been applied to your personal Supabase Cloud dev project and has never reached the shared `dev` branch, you may correct the migration file and re-apply it manually (drop the affected objects in the SQL Editor first if needed). Keep the migration history linear before opening a PR.
  - **Shared `dev` and production:** Never edit or delete an applied migration. Write a new compensating migration that corrects the issue (e.g., drop the bad column, rename the table back, restore the constraint). The compensating migration must have its own descriptive name (e.g., `018_fix_bad_column_from_017.sql`).
  - Migration files in `supabase/migrations/` remain the source of truth — every change applied via the SQL Editor must also exist as a numbered migration file in the repo so it can be replayed against staging/production.

### Multi-Tenancy
- Every table that holds tenant data must have an `organization_id` column
- RLS policies must filter by `organization_id` on every query — this is enforced at the database level, not just the application level
- No query may return data across organizations under any circumstance

### Offline Support
- Every feature used in the field must be designed offline-first
- Identify clearly which features are field features vs. command features
- Field features must use service worker caching and a local sync queue
- Sync conflicts must be resolved with a last-write-wins + timestamp strategy unless the data type requires merge logic

---

## 5. Security Rules

- **Never commit secrets.** No API keys, tokens, passwords, or credentials in code or git history — ever. Use environment variables.
- **RLS is mandatory.** Every Supabase table that holds user or organization data must have RLS enabled and tested. A table with RLS disabled is a critical bug.
- **No client-side secrets.** The Supabase `service_role` key must never be exposed to the browser. Only the `anon` key with RLS goes to the client.
- **Input sanitization.** All user-supplied input is validated with Zod before use. Never trust client data.
- **SQL injection is impossible by design.** Use Supabase's query builder or parameterized queries only — never string-interpolate values into SQL.
- **Authentication on every protected route.** Use the Next.js proxy (`src/proxy.ts`) to enforce auth on all routes except explicitly public ones. No route is public by default.
- **RBAC enforced at two layers.** Role checks happen in both the API route and the RLS policy. Belt and suspenders.
- **Audit logging.** Any mutation to incident data, resource data, or user roles must write to an immutable audit log table with the acting user's ID and a timestamp.
- **HTTPS only.** Never allow HTTP. Enforce at the Vercel and Supabase level.
- **Dependency hygiene.** Run `npm audit` regularly. Do not add dependencies with known high-severity vulnerabilities.
- **Environment variables.** All environment variables must be documented in a `.env.example` file with placeholder values — never real values.
- **CORS policy.** Default CORS policy is same-origin. Cross-origin access is not permitted until the mobile app or public API requires it. When introduced, use an explicit allowlist — never `Access-Control-Allow-Origin: *` on authenticated endpoints.
- **CSRF protection.** All state-changing API routes must be protected against CSRF. For authenticated routes, the Supabase session cookie with `SameSite=Lax` provides implicit CSRF protection. For public POST endpoints (e.g., `/api/check-in/[token]`), validate the request origin header or use a CSRF token.
- **Content Security Policy.** A Content-Security-Policy header must be configured before production launch. Start with a strict policy (`default-src 'self'`) and add exceptions as needed for Mapbox, Supabase, Sentry, and Stripe. CSP violations must be reported to Sentry.

---

## 6. Scalability Rules

- **Design for 10,000 organizations from day one.** Every query must be scoped to an organization and must use indexed columns in WHERE clauses.
- **Index every foreign key.** Every `organization_id`, `user_id`, `incident_id`, and other FK column must have a database index.
- **Index geospatial columns.** All PostGIS geometry columns must have a GIST index.
- **Paginate everything.** No query may return an unbounded result set. All list endpoints must support cursor-based or offset pagination with a maximum page size.
- **No N+1 queries.** Use joins or batch queries — never fetch a list and then query each item individually.
- **Async where possible.** Long-running operations (PDF generation, bulk exports, notifications) must be handled asynchronously — do not block the request thread.
- **Stateless API layer.** Next.js API routes and Edge Functions must be stateless. All state lives in the database or Supabase Storage.
- **Connection pooling.** Use Supabase's built-in PgBouncer connection pooler — never open raw connections from serverless functions.

---

## 7. Reliability Rules

- **Error boundaries.** Every major UI section must have a React error boundary so one failing component does not crash the whole app.
- **Graceful degradation.** If a non-critical feature fails (e.g., weather overlay, external map tiles), the app must remain usable. Fail loudly in logs, silently in UI with a toast notification.
- **Loading and empty states.** Every data-fetching component must handle three states explicitly: loading, empty, and error. No component may render without handling all three.
- **Retry logic.** Network requests to external services must include exponential backoff retry logic (max 3 attempts).
- **Data validation at the boundary.** Validate all data coming from the database before rendering it — do not assume the database always returns the expected shape.
- **No silent failures.** All caught errors must be logged. A caught error that is swallowed with no log is a bug.
- **Optimistic UI with rollback.** For real-time collaborative features, use optimistic updates but always implement rollback on failure.
- **Realtime reconnection.** All Supabase Realtime subscriptions must implement reconnection logic — automatically resubscribe on connection drop. See Section 20 for full Realtime rules.

---

## 8. Compliance-Readiness Rules

These rules keep the SOC 2 → HIPAA → FedRAMP path open. Do not close these doors.

- **Audit log is immutable.** The audit log table must have RLS that prevents any user, including admins, from deleting or updating rows. Insert only. Audit log entries are retained even after user account deletion (legal basis: GDPR Art 17(3)(e) — legal obligation / defense of legal claims for life-safety accountability records).
- **PII is isolated.** Personally identifiable information (names, contact info, subject/patient data) must be stored in clearly identified columns and tables. Do not scatter PII across the schema without awareness.
- **PHI is not collected at MVP.** The following fields exist in the schema as nullable columns but must NOT be exposed in any UI or API response until HIPAA infrastructure is in place: `incident_subjects.medical_notes`, `incident_subjects.medications`, `incident_subjects.known_conditions`, `incident_personnel.volunteer_medical_notes`. Enabling these fields requires: Supabase Team plan + HIPAA add-on + signed BAA + application-level encryption + PHI read-access logging + legal review.
- **PHI access mechanism (post-MVP).** When PHI fields are enabled, access uses **separate API endpoints** — not column-level filtering on existing endpoints:
  - `GET /api/incidents/[id]/subjects` — returns non-PHI fields for all authorized personnel.
  - `GET /api/incidents/[id]/subjects/[subjectId]/medical` — returns PHI fields for `incident_commander` and `medical_officer` only. This endpoint has its own access logging for HIPAA compliance.
  - `GET /api/incidents/[id]/personnel/[personnelId]/medical` — returns `volunteer_medical_notes` for `incident_commander`, `safety_officer`, and `medical_officer` only.
  - At MVP, only the non-PHI endpoints exist. The `/medical` endpoints are added when HIPAA infrastructure is in place. No existing code changes needed.
- **Data retention hooks.** Design data deletion flows from the start — every entity must have a soft-delete (`deleted_at`) before a hard-delete path. This supports data retention policies.
- **Account deletion strategy.** On user deletion request: pseudonymize/erase all profile data in `organization_members` and `incident_personnel` (replace display_name with "Deleted User #[hash]", clear phone, clear volunteer PII fields). `incident_log.actor_name` and `audit_log.actor_email` are retained under legal basis exception — SAR incident records are legal accountability documents. This must be documented in the privacy policy.
- **Session management.** Auth sessions must have a defined expiry. Supabase session tokens must be refreshed automatically. Stale sessions must redirect to login.
  - **Access token lifetime:** 24 hours (configured in Supabase Dashboard → Auth → Settings). Extended from the 1-hour default to accommodate field command post scenarios with intermittent connectivity.
  - **Refresh token lifetime:** 30 days. Extended from the 7-day default to prevent re-login during multi-day incidents.
  - **On full token expiry:** Force re-login with a clear message. Unsynced offline data in the service worker queue is preserved and synced after re-auth.
  - **PIN-based offline auth:** Deferred to Feature 10 (mobile app). Web MVP does not need it — command post laptops have intermittent connectivity, not zero connectivity.
- **No PII in operational logs.** Server logs, error logs, and Sentry events must never include user PII, credentials, or PHI. Log IDs and event types only. **Exception:** Compliance and accountability records (`audit_log.actor_email`, `incident_log.actor_name`) retain actor identity by design — this is required for SOC 2 audit trails and legal accountability for life-safety operations. See `database-schema.md` Key Design Decisions.
- **Encryption at rest and in transit.** Rely on Supabase's encryption at rest. Never store sensitive data in localStorage or unencrypted cookies. Post-MVP: application-level field encryption required for PHI columns before they are enabled in the UI.
- **Dependency provenance.** A dependency provenance document (markdown table: package name, purpose, license, category, risk notes) must exist before SOC 2 audit. Direct dependencies only. Must be updated on every dependency addition after creation. Not required at MVP.
- **Backup and disaster recovery.** Current state: Supabase Pro plan daily backups (7-day retention, RPO = 24 hours, RTO = managed by Supabase). The 24-hour RPO is a known risk during active incidents. Before SOC 2 audit: upgrade to Supabase Team plan for Point-in-Time Recovery (RPO drops to seconds). A standalone DR document must be created post-MVP.
- **Data residency.** Supabase project must be hosted in a US region (currently US West; target: US East Virginia). Vercel serverless functions must be pinned to a US region. Both must remain US-based. GovCloud migration deferred to Enterprise tier.

---

## 9. Code Quality Rules

- **No dead code.** Remove unused variables, imports, functions, and components before committing.
- **Comments explain why, not what.** Code should be readable enough that comments on *what* it does are unnecessary. Comments should explain *why* a decision was made.
- **Consistent naming conventions:**
  - Files and folders: `kebab-case`
  - React components: `PascalCase`
  - Functions and variables: `camelCase`
  - Database tables and columns: `snake_case`
  - Constants: `SCREAMING_SNAKE_CASE`
- **No hardcoded URLs.** All API endpoints, external service URLs, and environment-specific values must come from environment variables or a centralized config file.
- **One component per file.** React components get their own file. No barrel files that re-export dozens of things.

---

## 10. What to Do When Unsure

If a decision could affect security, multi-tenancy, data integrity, compliance, or the approved tech stack — **stop and ask before proceeding.** It is always better to ask than to introduce a pattern that is expensive to undo.

Do not:
- Introduce a new library without flagging it
- Disable or bypass RLS for convenience
- Use `any` to satisfy TypeScript
- Write a query that crosses organization boundaries
- Store secrets in code
- Merge a feature that lacks loading, error, and empty state handling

---

## 11. Testing Rules

Testing is not optional on a life-safety platform. Claude Code must write tests alongside features, not after.

### Tools
- **Unit / Integration:** Vitest — for functions, hooks, and business logic
- **End-to-End:** Playwright — for critical user flows
- **Component:** React Testing Library — for UI component behavior

### What must always have tests
- Any function that touches incident data, resource tracking, or ICS form generation
- All Zod validation schemas — test valid inputs, invalid inputs, and edge cases
- All RLS policies — write tests that verify cross-organization data leakage is impossible
- All API routes — test authenticated, unauthenticated, and unauthorized scenarios
- Any sync or conflict-resolution logic for offline support

### What does not need tests
- Pure UI layout and styling components
- Next.js page wrappers that only compose other components

### Rules
- Tests live in a `__tests__` folder adjacent to the file they test, or in a `tests/e2e` folder for Playwright
- A feature is not complete until its critical-path tests pass
- Never delete or skip a test to make a build pass — fix the code or the test
- **Data seeding:** A database seed script (`supabase/seed.sql`) must exist with sample organizations, members, and incidents for the development Supabase project. The script is run manually via the Supabase Cloud SQL Editor against the dev project only — never against staging or production. Seed data must never contain real PII.

---

## 12. Observability & Error Monitoring Rules

### Tools
- **Error Tracking & Performance:** Sentry — integrated with Next.js and Vercel
- **Database Performance:** Supabase built-in dashboard for slow query monitoring
- **Uptime:** Vercel Analytics for frontend, Sentry for backend error rates

### Rules
- Sentry must be initialized in both the Next.js client and server/edge runtime
- All unhandled promise rejections and uncaught exceptions must flow to Sentry automatically
- Manually capture errors in any catch block that handles a degraded-but-recoverable failure
- **Never log PII to Sentry.** Scrub user names, emails, phone numbers, and subject data before sending to Sentry. Log IDs only.
- Add Sentry breadcrumbs for critical SAR workflows (incident creation, resource assignment, form submission) so errors have context
- Performance transactions must be tracked for map rendering and realtime sync operations — these are the most likely bottlenecks

---

## 13. Notification Rules

### Approved Stack
- **Push Notifications (mobile):** Expo Push Notifications — pairs with the React Native mobile app
- **SMS (operational alerts):** Twilio — for incident callouts and urgent field alerts
- **Transactional Email:** Resend — for account creation, org invites, password reset, and billing only

### Rules
- **Operational and incident alerts must never use email.** Email is for account and billing events only. Alerts go through push and/or SMS.
- Notification sending must always be async — never block a request waiting for Twilio or Expo to respond
- All notification dispatches must be logged to the audit log with recipient ID, channel, and timestamp — never the message content if it contains PII
- Users must be able to configure their notification preferences per channel (push, SMS) at the org and individual level
- SMS must include opt-out compliance language per TCPA requirements — Twilio handles this if configured correctly, but it must be configured
- Notification failures must be caught, logged to Sentry, and retried once — a failed alert during an active search is a critical failure

---

## 14. Mobile Architecture Rules

A React Native mobile app (using Expo) is planned. To avoid a full rewrite when it is built, the web app must be architected with this in mind from day one.

### Rules
- **Business logic must be framework-agnostic.** All logic that is not rendering (data fetching, state management, calculations, form validation, sync logic) must live in plain TypeScript modules under `/lib` or `/features/[domain]/logic`. It must not be tangled inside Next.js components or API routes.
- **Business logic functions must accept a Supabase client as a parameter** — never import a client directly. This allows the same logic to be called with a server client (Next.js), a browser client (web), or a mobile client (React Native). Zod schemas and pure utility functions are inherently portable.
- **Supabase client must be initialized in one shared location** and imported everywhere — never instantiated inline in a component
- **Zod schemas are shared.** Define all validation schemas in a location that can eventually be shared between the web and mobile codebases (e.g., a `/packages/shared` directory if a monorepo is adopted)
- **Design tokens and constants are shared.** Colors, spacing, and configuration values used in Tailwind on web should be mirrored in a constants file that React Native can consume
- When the mobile app is built, use **Expo** as the framework — this is the approved React Native toolchain
- The mobile app is a field tool — it must be fully offline-capable, lightweight, and optimized for glove-friendly touch targets (minimum 44x44pt touch areas)

---

## 15. Git & Version Control Rules

These rules exist so the codebase is readable and safe when a human developer joins in Year 2.

### Branching
- `main` is always deployable — it reflects production
- `dev` is the integration branch — features merge here first
- Feature branches are named: `feature/short-description` (e.g., `feature/ics-204-autofill`)
- Bug fixes: `fix/short-description`
- Never push directly to `main` or `dev`

### Commits
- Use **Conventional Commits** format: `type(scope): description`
  - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`
  - Example: `feat(incidents): add resource assignment to ICS 204`
- Commit messages must describe *what changed and why*, not just *what file was touched*
- One logical change per commit — do not bundle unrelated changes

### Deployments
- Every push to a feature branch creates a **Vercel preview deployment** automatically
- Merges to `dev` deploy to a staging environment
- Merges to `main` deploy to production
- Database migrations must be reviewed before any merge to `main` — a bad migration in production is very difficult to undo

---

## 16. Accessibility Rules

WCAG 2.1 AA compliance is required. This is a federal procurement requirement on the FedRAMP path and the right thing to do.

### Rules
- All interactive elements (buttons, links, inputs, map controls) must be keyboard navigable and focusable
- All images and icons must have descriptive `alt` text, or `aria-hidden="true"` if purely decorative
- Color alone must never be the only way to convey meaning — this is especially critical for map overlays, status indicators, and alert states
- All form inputs must have associated `<label>` elements — never rely on placeholder text as a label
- Focus indicators must be visible — never use `outline: none` without providing an alternative focus style
- Use semantic HTML elements (`<nav>`, `<main>`, `<button>`, `<header>`) — do not use `<div>` for interactive elements
- Map features must have non-visual alternatives (text-based search grid summaries, screen-reader-accessible resource lists)
- Run `axe` accessibility checks (via axe-core or the Playwright axe integration) on all new pages before marking a feature complete

---

## 17. Rate Limiting & Request Limits

### Rate Limiting
- All API endpoints must be rate limited. Use **Upstash Redis** (`@upstash/ratelimit`) as the rate limiting backend — it is serverless-compatible and portable.
- **Public endpoints** (e.g., `/api/check-in/[token]`): Rate limit per IP address. Default: 10 requests per minute.
- **Authenticated endpoints**: Rate limit per authenticated user ID. Default: 60 requests per minute.
- **Expensive operations** (incident creation, PDF export, bulk operations): Rate limit per organization ID. Default: 20 requests per minute.
- Rate limit responses must return HTTP `429 Too Many Requests` with a `Retry-After` header.
- Rate limiting is enforced in the API route handler, not in the proxy — the proxy must remain fast and stateless.

### Request Body Size Limits
- JSON request body size is capped at **1MB** (the Next.js default). Do not increase this limit without explicit justification.
- File upload routes may increase the limit as needed, but must declare the limit explicitly in the route configuration.
- Any route that accepts file uploads must validate content type and file size before processing.

---

## 18. Caching Strategy

### HTTP Cache Headers
- **All tenant-scoped API responses** must set `Cache-Control: private, no-store`. No exceptions. Never use `s-maxage` on routes that return organization-specific data — Vercel's CDN cache keys are URL-based and cannot safely isolate tenants.
- **Public, non-tenant data** (if any exists in the future, e.g., a public status page) may use `s-maxage` with `stale-while-revalidate` for CDN caching.
- Do not override Vercel's automatic caching for hashed static assets (`_next/static/**`) or the CDN auto-purge on deploy.

### TanStack Query (React Query)
- **Global default `staleTime`:** 30 seconds. Individual queries override as needed.
- **Realtime-backed data** (incidents, personnel, resources): Set `staleTime: Infinity` and `gcTime: Infinity`. Supabase Realtime manages freshness — use `queryClient.invalidateQueries()` on Realtime events, not automatic refetching.
- **Semi-stable data** (org profile, member directory, role lists): `staleTime: 5 minutes`, `gcTime: 10 minutes`.
- **All tenant-scoped query keys must include `organizationId`.** On org switch or logout, call `queryClient.clear()` to wipe the entire cache — `invalidateQueries` is not sufficient because it may serve stale data from the previous org while refetching.
- Prefer `invalidateQueries` over `setQueryData` for Realtime updates — Realtime sends change deltas, not full snapshots. On Realtime channel reconnect, always invalidate all queries that channel covers (events may have been missed during disconnect).

### Map Tile Caching
- Mapbox tile caching is handled by Mapbox's CDN and the browser's built-in cache (12-hour device TTL). Do not override Mapbox's cache headers.
- Offline tile caching for field use is handled via a service worker with a **cache-first, network-fallback** strategy for Mapbox tile requests.
- Tile caches must be populated from the end user's device only — never proxy or redistribute tiles server-side (Mapbox TOS violation).
- Cached tiles must be evicted after **30 days** (Mapbox TOS maximum).
- Only the active incident area is cached for offline use, not arbitrary regions.

### What Must Never Be Cached
- Tenant-scoped API responses at the CDN/proxy layer
- Authentication tokens or session data
- Supabase Realtime event payloads (these are transient push events, not cacheable resources)

---

## 19. Environment-Specific Rules

Three environments exist: **local development** (Next.js dev server pointed at the dev Supabase Cloud project), **staging** (Vercel preview deployments from `dev`), and **production** (Vercel production from `main`). There is no local Supabase / Docker stack — all environments use Supabase Cloud projects, only the project URL and keys differ.

### What Differs by Environment
- **Email confirmation:** Disabled in local dev (Supabase Cloud dev project setting). Enabled in staging and production via Resend.
- **Sentry:** Disabled in local dev unless `SENTRY_FORCE_ENABLED=true`. Enabled in staging and production.
- **Stripe:** Test mode in local dev and staging. Live mode in production only.
- **Rate limiting:** Relaxed or disabled in local dev for faster iteration. Enforced in staging and production.
- **Seed data:** `supabase/seed.sql` is applied via the Supabase Cloud SQL Editor against the dev project only. Never run against staging or production.

### Dev-Only Utilities
- **Dev-only routes, pages, and API endpoints are prohibited.** No `/api/dev/*`, no `/dev/*` pages. If a development shortcut is needed, implement it as a local script (`scripts/`) or a Supabase seed — never as a deployed route. A dev-only route that reaches production is a security incident.
- Dev-only environment variables must be prefixed with `DEV_` and must never be set in Vercel project settings.

### Environment Detection
- Use `process.env.NODE_ENV` for build-time distinctions (`development` vs `production`).
- Use `process.env.VERCEL_ENV` for runtime deployment context (`development`, `preview`, `production`).
- Never branch application logic on environment — environment should only control configuration (DSNs, API keys, feature flags), not behavior.

---

## 20. Supabase Realtime Rules

### Subscription Lifecycle
- **The correct pattern:** Subscribe on `INITIAL_SESSION` (non-null session) with a `cancelled` flag to handle React Strict Mode double-invocation. `INITIAL_SESSION` fires once per listener registration after auth initialization (including token refresh), always with a valid session.
- **Do not** subscribe inside `getSession().then()` — this races with `TOKEN_REFRESHED` on first load.
- **Do not** handle `SIGNED_IN` for channel setup — it fires on every page load (cookie restore), causing double subscriptions.
- **Do not** handle `TOKEN_REFRESHED` for channel re-creation — Supabase's internal listener already calls `setAuth(new_token)` on the socket.
- **Do not** reconnect on `CLOSED` — CLOSED fires when the app calls `removeChannel`, causing infinite loops.
- **Do** reconnect on `CHANNEL_ERROR` (real network failure). On reconnect, invalidate all React Query keys that channel covers — events may have been missed during the disconnect.

### Channel Naming
- Channel names follow the pattern: `{entity}-{scope-id}` (e.g., `incident-board-{incidentId}`, `personnel-{incidentId}`, `resources-{incidentId}`).
- Always include the scoping ID in the channel name — never subscribe to a bare entity channel without a scope.

### Channel Type Selection
- **`postgres_changes`**: Use for database-driven state that multiple clients need to stay synchronized on (personnel status, resource assignments, incident updates). This is the default choice.
- **`broadcast`**: Use for ephemeral, non-persisted events (cursor positions, typing indicators, map viewport sync). Data is not stored — if a client is offline when the event fires, it misses it.
- **`presence`**: Use for online/active user tracking only (who is viewing this incident right now). Do not abuse presence for state synchronization.

### Payload & Performance
- Supabase Realtime has a **1MB message size limit**. Do not subscribe to tables with large text or JSONB columns without filtering via `.eq()` or column selection.
- Subscriptions on inactive tabs should be **lazy-unmounted** to reduce connection load — except for Personnel and Resources tabs on the incident board, which must stay subscribed in the background for accountability.
- Each page should subscribe to the minimum set of tables it needs. Do not subscribe to "everything" and filter client-side.

---

## 21. File Storage Rules (Supabase Storage)

### Bucket Structure
- One bucket per file category: `ics-forms`, `imports` (KML/KMZ/GPX), `flight-logs`, `photos`, `org-assets`.
- Bucket names are lowercase kebab-case.
- All buckets are **private by default**. Public buckets require explicit justification and approval.

### File Path Convention
- Files are stored at: `{organization_id}/{incident_id}/{filename}` for incident-scoped files, or `{organization_id}/{filename}` for org-scoped files (e.g., logos).
- Filenames must be sanitized — no spaces, no special characters beyond hyphens and underscores. Use a UUID or timestamp prefix to prevent collisions.

### Access Control
- RLS policies on Supabase Storage must enforce `organization_id` scoping — a member of Org A must never access files belonging to Org B.
- Signed URLs (time-limited) are the default access pattern for private files. Never generate permanent public URLs for tenant data.
- Signed URL expiry: 1 hour default. Shorter for sensitive files (subject photos, medical documents).

### Size & Type Limits
- **ICS form PDFs:** Max 10MB per file.
- **KML/KMZ/GPX imports:** Max 25MB per file.
- **Drone flight logs:** Max 50MB per file.
- **Photos:** Max 10MB per file. Accept JPEG, PNG, WebP, HEIC only.
- **Org logos:** Max 2MB. Accept PNG, SVG, WebP only.
- All uploads must validate content type server-side (not just the file extension) before writing to storage. Never trust the client-provided MIME type alone — read the file's magic bytes.

### Retention
- Files attached to closed incidents follow the org's data retention policy (soft-delete, then hard-delete after retention period).
- Orphaned files (not referenced by any database record) must be cleaned up by a periodic job — do not rely on manual deletion.

---

## 22. Internationalization Readiness

The platform is architected for US-first launch, but every decision must keep the international path open. International expansion is a Year 2+ goal — do not build i18n infrastructure at MVP, but do not close doors.

### Incident Management Data vs. Framework Presentation

This is a non-negotiable architectural rule:

- **The database stores incident management concepts, not ICS form numbers.** Tables like `incident_command_structure`, `operational_periods`, `incident_sectors`, and `incident_personnel` represent universal SAR concepts (who is in charge, what areas are being searched, who is deployed). These concepts exist in ICS, AIIMS, CIMS, and every other framework — the terminology differs, the data does not.
- **ICS form rendering is a presentation layer concern.** The `ics_forms` table stores structured `form_data` as JSONB. At MVP, the only renderer is ICS (US). Post-MVP, the same underlying data can be rendered as AIIMS templates (Australia), CIMS Action Plans (New Zealand), or custom agency forms — without changing the data model.
- **Display terminology must be configurable per organization.** The database uses ICS-derived column names (`incident_commander`, `operations_section_chief`, etc.) — this is fine and will not change. The **display labels** shown in the UI must be sourced from a terminology map, not hardcoded. At MVP, the terminology map is a static ICS-English map. Post-MVP, organizations select a framework (ICS, AIIMS, CIMS) which loads the appropriate terminology map (e.g., "Incident Commander" → "Incident Controller" for AIIMS/CIMS).
- **Do not hardcode ICS form type names in business logic.** The `form_type` CHECK constraint on `ics_forms` uses ICS identifiers (`ICS_201`, `ICS_204`, etc.). Business logic should reference these via constants, not string literals, so that adding non-ICS form types is a registry change, not a codebase-wide find-and-replace.

### International Framework Priority

When international framework support is built, the priority order is:

1. **Tier 1 (high ICS compatibility, English-speaking):** Canada (already ICS — zero adaptation), Australia (AIIMS — terminology mapping + form templates), New Zealand (CIMS — terminology mapping + form templates)
2. **Tier 2 (moderate compatibility):** UK mountain rescue (Gold-Silver-Bronze + JESIP), ICAR member organizations (international alpine rescue)
3. **Tier 3 (significant localization):** Continental Europe (FwDV 100, ORSEC), Scandinavia, APAC — these require framework-specific command structures, not just form template swaps

### Language & Localization

- **i18n is deferred to post-MVP.** UI strings are hardcoded in English. When i18n is introduced, use ICU MessageFormat via `next-intl`.
- **Do not prematurely abstract strings** — the cost of retrofitting is lower than the cost of maintaining an i18n layer before it's needed.
- **Units:** Metric/imperial conversion is already supported for subject height/weight. When entering international markets, all measurement displays must respect the org's locale preference (metric default for non-US).
- **Date/time:** The existing timezone convention (IANA identifiers, `Intl.DateTimeFormat`) is already internationally compatible. No changes needed.
- **Currency:** Stripe supports multi-currency billing. When international pricing is introduced, pricing tiers may differ by region. No architecture changes needed — Stripe handles currency natively.

### International Compliance

When entering non-US markets, the following compliance requirements apply. These are **not** MVP concerns but must not be architecturally blocked:

- **GDPR (EU/EEA):** Requires explicit consent for data processing, data portability (export), right to erasure (with existing legal basis exceptions for SAR accountability records), Data Processing Agreements with all sub-processors (Supabase, Vercel, Stripe, Sentry, Twilio, Resend), and a designated Data Protection Officer at scale. The existing `deleted_at` + pseudonymization pattern for account deletion is GDPR-compatible.
- **PIPEDA (Canada):** Similar to GDPR but with different consent thresholds. Canada is the most natural first international market — ICS-compatible, English-speaking, similar SAR culture.
- **Data residency:** Some jurisdictions require user data to stay in-country or in-region. The current single-region Supabase deployment (US West) must eventually support multi-region isolation. Do not create architecture that assumes a single database instance.
- **Privacy policy:** Must be updated per market to reflect local data protection law requirements. The existing GDPR Art 17(3)(e) carve-out for SAR accountability records applies in all jurisdictions with similar legal basis provisions.

### What This Means for MVP Code

- Use constants for ICS role names and form types — never string literals scattered through the codebase
- UI labels for roles and form names should come from a centralized map (even if that map is static ICS-English at MVP)
- Do not bake US-specific assumptions into business logic (e.g., don't assume imperial units, don't assume US phone number format for all users)
- The `organizations.country` column already exists (default `'US'`) — this is sufficient for MVP

---

*Last updated: 2026-04-04 — Added Section 22 (Internationalization Readiness), updated Section 1 compliance roadmap with international milestones*
