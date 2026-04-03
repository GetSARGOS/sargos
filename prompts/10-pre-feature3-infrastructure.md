# Prompt: Pre-Feature-3 Infrastructure — Error Codes, Pagination, Date Formatting, Seed Data, Build Log Fix

You are building shared infrastructure that Feature 3 (and all subsequent features) will depend on. These are utilities, constants, and seed data documented in earlier sessions but never created. Building them now prevents Feature 3 from being slowed by missing foundations.

This is a **build session** — you will write code, configuration, and seed data.

## Setup — Read These Files First (in this order):

1. `build-log.md` — last entry only (for current state)
2. `claude-rules.md` — Section 4 (Architecture Rules → API Design: pagination, error codes, timezone convention)
3. `database-schema.md` — for table structures needed by pagination and seed data
4. `feature-list.md` — Feature 3 section (to understand what's coming next)
5. `definition-of-done.md` — for the checklist you must satisfy

Execute the "What To Do Next Session" instruction only if it is compatible with the work below. If not, this prompt takes priority — document why in the build log.

---

## Context

Sessions 13 and 15 documented several shared utilities that "need to be created when the first Feature 3 API route is built." Building them during Feature 3 means the first Feature 3 session is spent on infrastructure instead of feature work. Building them now means Feature 3 hits the ground running.

Additionally, the build log has a sequencing issue and `supabase/seed.sql` (required by rules) doesn't exist yet, blocking authenticated Playwright e2e tests.

Work through these **in order**.

---

## Task 1: Error Code Registry (from Session 15)

**Documented in:** `claude-rules.md` Section 4 → API Design → Error codes

**What to build:**

### 1a. Create `/src/constants/error-codes.ts`

Export a registry of all error codes. Each entry is an object: `{ code: string, status: number }`.

Naming convention: `DOMAIN_ACTION` in `SCREAMING_SNAKE_CASE`.

Start with all error codes currently used or implied across the existing codebase, plus codes needed for Feature 3:

```typescript
// Auth
export const AUTH_UNAUTHORIZED = { code: 'AUTH_UNAUTHORIZED', status: 401 } as const;
export const AUTH_SESSION_EXPIRED = { code: 'AUTH_SESSION_EXPIRED', status: 401 } as const;
export const AUTH_FORBIDDEN = { code: 'AUTH_FORBIDDEN', status: 403 } as const;

// Organization
export const ORG_SLUG_TAKEN = { code: 'ORG_SLUG_TAKEN', status: 409 } as const;
export const ORG_NOT_FOUND = { code: 'ORG_NOT_FOUND', status: 404 } as const;

// Incident
export const INCIDENT_NOT_FOUND = { code: 'INCIDENT_NOT_FOUND', status: 404 } as const;
export const INCIDENT_CLOSED = { code: 'INCIDENT_CLOSED', status: 409 } as const;
export const INCIDENT_ALREADY_CLOSED = { code: 'INCIDENT_ALREADY_CLOSED', status: 409 } as const;

// Personnel
export const PERSONNEL_ALREADY_CHECKED_IN = { code: 'PERSONNEL_ALREADY_CHECKED_IN', status: 409 } as const;
export const PERSONNEL_NOT_FOUND = { code: 'PERSONNEL_NOT_FOUND', status: 404 } as const;

// QR
export const QR_TOKEN_INVALID = { code: 'QR_TOKEN_INVALID', status: 404 } as const;
export const QR_TOKEN_INACTIVE = { code: 'QR_TOKEN_INACTIVE', status: 410 } as const;

// Billing (for Feature 8a)
export const TIER_SEAT_LIMIT = { code: 'TIER_SEAT_LIMIT', status: 403 } as const;
export const TIER_INCIDENT_LIMIT = { code: 'TIER_INCIDENT_LIMIT', status: 403 } as const;
export const TIER_FEATURE_GATED = { code: 'TIER_FEATURE_GATED', status: 403 } as const;
export const SUBSCRIPTION_LAPSED = { code: 'SUBSCRIPTION_LAPSED', status: 403 } as const;

// Rate Limiting (for prompt 08)
export const RATE_LIMIT_EXCEEDED = { code: 'RATE_LIMIT_EXCEEDED', status: 429 } as const;

// CSRF (for prompt 08)
export const CSRF_ORIGIN_MISMATCH = { code: 'CSRF_ORIGIN_MISMATCH', status: 403 } as const;

// Validation
export const VALIDATION_FAILED = { code: 'VALIDATION_FAILED', status: 400 } as const;

// Generic
export const INTERNAL_ERROR = { code: 'INTERNAL_ERROR', status: 500 } as const;
```

Also export a helper type and a response builder:

```typescript
export type ErrorCode = typeof AUTH_UNAUTHORIZED; // infer the shape

export function errorResponse(errorCode: ErrorCode, message: string, meta?: Record<string, unknown>) {
  return Response.json(
    { data: null, error: { code: errorCode.code, message }, meta: meta ?? null },
    { status: errorCode.status }
  );
}
```

### 1b. Retrofit existing API routes (optional this session)

If time permits, update existing API routes to use `errorResponse()` instead of inline `Response.json()` calls. This is a mechanical find-and-replace. If time doesn't permit, leave this as a note for a future session — the important thing is the registry exists.

---

## Task 2: Pagination Utilities (from Session 15)

**Documented in:** `claude-rules.md` Section 4 → API Design → Pagination

**What to build:**

### 2a. Create `/src/lib/pagination.ts`

Export utilities for both pagination patterns:

**Offset-based** (for stable/low-write tables: members, teams, incidents, resources):
```typescript
export function parseOffsetParams(searchParams: URLSearchParams): { page: number; pageSize: number }
export function buildOffsetMeta(page: number, pageSize: number, totalCount: number): OffsetMeta
```
- Default page size: 25. Max: 100. Incident log default: 50.
- Response meta shape: `{ page, pageSize, totalCount, totalPages, hasMore }`

**Cursor-based** (for high-write/append-only tables: incident_log, audit_log, notifications):
```typescript
export function parseCursorParams(searchParams: URLSearchParams): { cursor: string | null; limit: number }
export function buildCursorMeta(items: Array<{ created_at: string; id: string }>, limit: number): CursorMeta
```
- Cursor is `created_at` + `id` of the last item, base64-encoded
- Response meta shape: `{ cursor, hasMore }`
- Default limit: 25. Incident log: 50. Max: 100.

### 2b. Export types

```typescript
export interface OffsetMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CursorMeta {
  cursor: string | null;
  hasMore: boolean;
}
```

### 2c. Tests

Write unit tests for:
- `parseOffsetParams` with default, custom, and out-of-range values
- `buildOffsetMeta` with various page/total combinations
- `parseCursorParams` with null cursor (first page) and encoded cursor
- `buildCursorMeta` with empty array, partial page, and full page

---

## Task 3: Date Format Constant (from Session 15)

**Documented in:** `claude-rules.md` Section 4 → Timezone Convention

**What to build:**

### 3a. Create `/src/constants/date-format.ts`

```typescript
/**
 * Project-wide display format for timestamps.
 * Example: "03 Apr 2026 14:32 PST"
 *
 * Usage with Intl.DateTimeFormat:
 * ```
 * new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS).format(date)
 * ```
 */
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
  hour12: false,
};

/**
 * Format a date using the incident's timezone.
 * All incident-scoped timestamps use this function.
 */
export function formatIncidentTime(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    ...DATE_FORMAT_OPTIONS,
    timeZone: timezone,
  }).format(d);
}

/**
 * Format a date using the user's browser timezone.
 * For non-incident-scoped timestamps (org settings, billing, audit log viewer).
 */
export function formatLocalTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS).format(d);
}
```

### 3b. Tests

- Test `formatIncidentTime` with a known UTC timestamp and `America/Los_Angeles` timezone
- Test `formatLocalTime` returns a non-empty string

---

## Task 4: Database Seed Script (from claude-rules.md Section 11)

**Documented in:** `claude-rules.md` Section 11 → Testing Rules → Data seeding

**Problem:** `supabase/seed.sql` is required by the rules ("must exist with sample organizations, members, and incidents for local development") but doesn't exist. Without it, Playwright authenticated e2e tests remain blocked.

**What to build:**

### 4a. Create `supabase/seed.sql`

The seed script must:
- Create 2 test organizations (Alpha SAR Team, Beta SAR Team) — matching the debug.md test setup
- Create test users in `auth.users` (Supabase requires this for RLS to work)
- Create organization members with defined roles matching debug.md:
  - Alpha SAR: admin, IC, ops chief, field member, observer (5 members)
  - Beta SAR: admin (1 member, for cross-org testing)
- Create 1 active incident for Alpha SAR with:
  - 2 checked-in personnel (the admin as IC + the field member)
  - 1 incident_log entry
  - 1 audit_log entry
- Create 1 available resource for Alpha SAR
- **No real PII** — use obviously fake data (e.g., "Alice Admin", "phone: 555-0101")
- Include comments explaining the purpose of each section

**Important constraints:**
- Must work with `supabase db reset` (which replays all migrations then runs seed.sql)
- Must use known UUIDs for test users so Playwright can reference them
- Must NOT conflict with migrations (use INSERT, not CREATE TABLE)
- Password hashes: use Supabase's `crypt()` function or insert via `auth.users` with `encrypted_password`

### 4b. Document seed user credentials

Add a comment block at the top of `seed.sql` with the test credentials:
```sql
-- Test User Credentials (local dev only — never use in staging/production)
-- admin@alphasar.test / TestPassword1!
-- ic@alphasar.test / TestPassword1!
-- ops@alphasar.test / TestPassword1!
-- field@alphasar.test / TestPassword1!
-- observer@alphasar.test / TestPassword1!
-- admin@betasar.test / TestPassword1!
```

---

## Task 5: Fix Build Log Ordering (LOW — Housekeeping)

**Problem:** The build log entries are out of chronological order. The sequence is:
```
Session 0 → 1 → 2 → 2-addendum → 3 → 4 → 3-addendum → 5 → 6 → 7 → 7-addendum → 8 → 9 → 10 → 11 → 12 → 14 → 15 → 13
```

Sessions 13, 14, and 15 are out of order (13 appears after 15). The CLAUDE.md instruction says "read the LAST ENTRY ONLY" — if the last entry is Session 13 but Session 15 was the actual last session, the next session starts with stale context.

**What to do:**

### 5a. Add a chronological index

At the top of the Log Entries section (just before the first session), add a chronological index:

```markdown
## Session Index (Chronological)

| Session | Date | Type | Summary |
|---------|------|------|---------|
| 0 | Pre-build | Planning | Documentation created |
| 1 | 2026-03-29 | Build | Database foundation + auth |
| 2 | 2026-03-29 | Build | Org creation API |
| 2-add | 2026-03-29 | Debug | Manual test results |
| 3 | 2026-03-29 | Build | Auth UI (login/signup/onboarding) |
| 4 | 2026-03-29 | Build | Incident board + Realtime |
| 3-add | 2026-03-29 | Debug | Session 3 manual tests |
| 5 | 2026-03-29 | Build | QR volunteer check-in |
| 6 | 2026-03-30 | Build | PAR, equipment, personnel improvements |
| 7 | 2026-04-01 | Build | Hardening sprint (Sentry, tests, debt) |
| 7-add | 2026-04-01 | Ops | Vercel deployment |
| 8 | 2026-04-02 | Docs | claude-rules.md gaps (Sections 17-21) |
| 9 | 2026-04-02 | Docs | CLAUDE.md gaps + DX audit |
| 10 | 2026-04-02 | Build | DX tooling (Playwright, coverage, commitlint) |
| 11 | 2026-04-02 | Docs | Compliance gaps (HIPAA/SOC 2 decisions) |
| 12 | 2026-04-02 | Docs | Schema gaps (soft-delete, storage) |
| 13 | 2026-04-03 | Docs | Feature gaps (billing, op periods, subjects) |
| 14 | 2026-04-03 | Docs | Interaction gaps (dependency map, RBAC) |
| 15 | 2026-04-03 | Docs | Missing decisions (pagination, timezone, errors) |
```

### 5b. Add a "Latest Session" marker

At the very top of the build log (after the template), add:

```markdown
**Latest session: 15** (2026-04-03) — Update this number when appending a new entry.
```

This way "read the LAST ENTRY" is unambiguous even if entries are out of order.

---

## Task 6: AGENTS.md Enhancement (LOW — Claude Code Optimization)

**Problem:** `AGENTS.md` currently contains only a Next.js 16 breaking changes reminder. This file is loaded into every Claude Code session. It should contain the critical patterns from MEMORY.md that prevent recurring bugs.

**What to add to AGENTS.md:**

```markdown
<!-- BEGIN:supabase-types -->
# Supabase JS v2 Type Requirements
- Tables MUST include `Relationships` field — supabase-js v2.100+ requires it via `GenericTable`
- Join syntax `.select('*, related(*)')` requires populated `Relationships` — use two queries + merge if `Relationships: []`
<!-- END:supabase-types -->

<!-- BEGIN:zod-hookform -->
# Zod v4 + @hookform/resolvers v5
- `zodResolver` returns `Resolver<z.input<T>>` — INPUT type, before defaults
- `useForm<>` type param: use `z.input<typeof Schema>`, NOT `z.infer<>`
- Export both: `z.infer<>` (for API/logic) and `z.input<>` (for form)
<!-- END:zod-hookform -->

<!-- BEGIN:shadcn-radix-nova -->
# shadcn radix-nova style
- `form` component NOT installable via CLI — write manually
- All imports use `from "radix-ui"`, NOT individual `@radix-ui/*` packages
- `Slot` is used as `Slot.Root`
<!-- END:shadcn-radix-nova -->
```

---

## Verification Checklist

Before marking this session complete, verify:

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npm test` — all existing + new tests pass
- [ ] `/src/constants/error-codes.ts` exists with registry + `errorResponse()` helper
- [ ] `/src/lib/pagination.ts` exists with both offset and cursor utilities + tests
- [ ] `/src/constants/date-format.ts` exists with format functions + tests
- [ ] `supabase/seed.sql` exists with 2 orgs, 6 users, 1 incident, 1 resource
- [ ] Build log has session index and "Latest session" marker
- [ ] AGENTS.md has critical patterns added
- [ ] No `any` types introduced
- [ ] No file exceeds 400 lines

---
