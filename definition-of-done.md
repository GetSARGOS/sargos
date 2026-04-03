# Definition of Done — SAR SaaS Platform
> Claude Code must satisfy every applicable item on this checklist before marking a feature complete and logging it in build-log.md. If an item does not apply to the current feature, mark it N/A with a one-line reason.

---

## 1. Database

- [ ] All new tables match the schema defined in `database-schema.md` exactly
- [ ] No table or column exists that is not in `database-schema.md` — if a new one was needed, `database-schema.md` was updated first
- [ ] Migration file is created, named sequentially, and tested (apply → verify → rollback → re-apply)
- [ ] RLS is enabled on every new table
- [ ] RLS policies are written and tested for all roles (org_admin, member, IC, field_member, observer, unauthenticated)
- [ ] All foreign keys have explicit `ON DELETE` behavior
- [ ] All foreign key columns are indexed
- [ ] All geometry columns have a GIST index
- [ ] `updated_at` trigger is applied to every mutable table
- [ ] No cross-organization data leakage is possible — verified by a test that attempts a cross-org query and confirms it returns zero rows

---

## 2. Backend / API

- [ ] All API routes validate input with a Zod schema before any logic executes
- [ ] All API responses follow the `{ data, error, meta }` shape
- [ ] HTTP status codes are semantically correct
- [ ] Raw database errors are never exposed to the client — sanitized messages only
- [ ] All mutations write an entry to `audit_log` (for sensitive actions) or `incident_log` (for incident actions)
- [ ] No PII is logged to Sentry, server logs, or audit metadata
- [ ] Authentication is verified on every protected route
- [ ] Role authorization is checked at the API layer (belt) in addition to RLS (suspenders)
- [ ] Long-running operations are handled asynchronously — no blocking the request thread
- [ ] Supabase connection pooler (PgBouncer) is used — no raw connections

---

## 3. Frontend

- [ ] All three data states are handled: loading, empty, error — no component renders without all three
- [ ] An error boundary wraps the new feature section
- [ ] All interactive elements are keyboard navigable
- [ ] All images and icons have `alt` text or `aria-hidden="true"`
- [ ] Color is not the only way meaning is conveyed (status indicators, alerts, map layers)
- [ ] All form inputs have associated `<label>` elements — no placeholder-only labels
- [ ] Touch targets are minimum 44x44px (for field/mobile use)
- [ ] No hardcoded URLs, API keys, or environment-specific values in component code
- [ ] No `any` type used in TypeScript — strict mode passes with zero errors
- [ ] No console errors or warnings in the browser during normal use

---

## 4. Real-Time & Offline

- [ ] If the feature includes live data: Supabase Realtime subscription is implemented with reconnection logic
- [ ] If the feature is used in the field: offline behavior is defined and implemented (cache strategy documented)
- [ ] Optimistic UI updates are implemented with rollback on failure for any mutation
- [ ] Sync conflicts are handled with last-write-wins + timestamp strategy (or documented alternative)

---

## 5. Notifications

- [ ] If the feature triggers a notification: notification is sent via the correct channel (push for assignments, SMS for callouts, never email for operational alerts)
- [ ] Notification dispatch is async — not blocking the request
- [ ] Notification is logged to the `notifications` table
- [ ] Notification failure is caught, logged to Sentry, and retried once

---

## 6. Testing

- [ ] Unit tests written for all business logic functions (validators, calculators, data transformers)
- [ ] API route tests cover: authenticated success, unauthenticated (401), unauthorized role (403), invalid input (400)
- [ ] RLS policy test written: confirms cross-org query returns zero rows
- [ ] If a new critical user flow was added: Playwright e2e test covers the happy path
- [ ] All tests pass: `npm run test`
- [ ] No tests were deleted or skipped to make the build pass

---

## 7. Security

- [ ] No secrets, tokens, or API keys appear anywhere in the code
- [ ] `service_role` key is not used in any client-side code
- [ ] All user input is validated with Zod before use
- [ ] No SQL string interpolation — parameterized queries or Supabase query builder only
- [ ] `npm audit` passes with no high-severity vulnerabilities

---

## 8. Accessibility

- [ ] `axe` accessibility check passes on all new pages (zero critical violations)
- [ ] New pages are navigable by keyboard only (tab through all interactive elements)
- [ ] Screen reader test: all meaningful content is announced correctly

---

## 9. Code Quality

- [ ] No dead code, unused imports, or commented-out blocks
- [ ] No file exceeds 400 lines
- [ ] Naming conventions followed: `kebab-case` files, `PascalCase` components, `camelCase` functions, `snake_case` DB, `SCREAMING_SNAKE_CASE` constants
- [ ] Business logic lives in `/lib` or `/features/[domain]/logic` — not inside components or API routes
- [ ] `.env.example` updated if any new environment variables were introduced

---

## 10. Build Log

- [ ] A new entry has been appended to `build-log.md` using the standard template
- [ ] The entry documents: what was built, decisions made, deviations from the plan, any known issues, and what Claude Code should read next session

---

*A feature is not done until every applicable checkbox is checked. If you are unsure whether an item applies, treat it as applicable.*