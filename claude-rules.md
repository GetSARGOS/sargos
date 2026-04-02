# Claude Rules — SAR SaaS Platform
> These rules are non-negotiable constraints for this project. Claude Code must follow them in every file, every decision, and every suggestion. When in doubt, ask before deviating.

---

## 1. Identity & Purpose

This is a **Search and Rescue (SAR) SaaS platform** serving volunteer and professional emergency management teams. The software directly supports life-safety operations. Every architectural, security, and reliability decision must reflect that weight.

- Correctness and reliability always outrank speed of delivery
- Never take shortcuts that could compromise data integrity or system availability
- This system will pursue SOC 2, HIPAA, and FedRAMP compliance — every decision should keep that path open

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

### API Design
- All Next.js API routes must validate input with Zod before processing
- All API responses follow a consistent shape: `{ data, error, meta }`
- HTTP status codes must be semantically correct — never return 200 with an error in the body
- All mutations must be idempotent where possible
- Never expose raw database errors to the client — log them server-side, return sanitized messages

### Database
- Every table must have: `id` (UUID, default `gen_random_uuid()`), `created_at`, `updated_at`
- All `updated_at` columns must be automatically maintained via a PostgreSQL trigger
- Foreign keys must always have explicit `ON DELETE` behavior defined — never leave it implicit
- Migrations are versioned and sequential — never edit a migration that has already been applied
- No application logic in triggers or functions unless it is purely data-integrity logic (e.g., cascades, timestamps)
- PostGIS geometry columns must always have an SRID defined (use EPSG:4326 — WGS84)

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
- **Authentication on every protected route.** Use Next.js middleware to enforce auth on all routes except explicitly public ones. No route is public by default.
- **RBAC enforced at two layers.** Role checks happen in both the API route and the RLS policy. Belt and suspenders.
- **Audit logging.** Any mutation to incident data, resource data, or user roles must write to an immutable audit log table with the acting user's ID and a timestamp.
- **HTTPS only.** Never allow HTTP. Enforce at the Vercel and Supabase level.
- **Dependency hygiene.** Run `npm audit` regularly. Do not add dependencies with known high-severity vulnerabilities.
- **Environment variables.** All environment variables must be documented in a `.env.example` file with placeholder values — never real values.

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
- **Realtime reconnection.** All Supabase Realtime subscriptions must implement reconnection logic — automatically resubscribe on connection drop.

---

## 8. Compliance-Readiness Rules

These rules keep the SOC 2 → HIPAA → FedRAMP path open. Do not close these doors.

- **Audit log is immutable.** The audit log table must have RLS that prevents any user, including admins, from deleting or updating rows. Insert only.
- **PII is isolated.** Personally identifiable information (names, contact info, subject/patient data) must be stored in clearly identified columns and tables. Do not scatter PII across the schema without awareness.
- **Data retention hooks.** Design data deletion flows from the start — every entity must have a soft-delete (`deleted_at`) before a hard-delete path. This supports data retention policies.
- **Session management.** Auth sessions must have a defined expiry. Supabase session tokens must be refreshed automatically. Stale sessions must redirect to login.
- **No logging of PII.** Server logs and error logs must never include user PII, credentials, or PHI. Log IDs and event types only.
- **Encryption at rest and in transit.** Rely on Supabase's encryption at rest. Never store sensitive data in localStorage or unencrypted cookies.
- **Dependency provenance.** Document every third-party dependency and its purpose. This is required for SOC 2 vendor management.

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

*Last updated: Project kickoff — SAR SaaS v0.1*