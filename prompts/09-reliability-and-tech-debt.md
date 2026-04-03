# Prompt: Reliability Fixes & Tech Debt — Realtime Bug, Type Generation, Retry Logic, Audit Gaps

You are closing reliability and tech debt gaps identified in a comprehensive audit of the SAR SaaS platform. These range from a known Realtime bug that affects IC workflows to foundational infrastructure (generated types, retry logic) that should exist before more features are built.

This is a **build session** — you will write code, fix bugs, and generate types.

## Setup — Read These Files First (in this order):

1. `build-log.md` — last entry only (for current state)
2. `claude-rules.md` — Section 7 (Reliability), Section 20 (Realtime), Section 12 (Observability)
3. `definition-of-done.md` — for the checklist you must satisfy
4. `debug.md` — Session 6 "Known Limitations" for the Realtime bug description

Execute the "What To Do Next Session" instruction only if it is compatible with the work below. If not, this prompt takes priority — document why in the build log.

---

## Context

A full-project audit identified 5 reliability and tech debt issues. The most impactful is the Realtime second-tab bug (known since Session 6, root cause identified, never fixed). The most foundational is the hand-authored `database.types.ts` — 15 sessions of type stubs creates compounding risk of type drift.

Work through these **in order**.

---

## Fix 1: Regenerate `database.types.ts` (HIGH — Foundational)

**Problem:** `src/lib/supabase/database.types.ts` has been hand-authored since Session 1. Every table added since (17 migrations worth) uses manually typed stubs with `Relationships: []`. This is fragile and blocks type-safe joins.

**What to do:**

### 1a. Install Supabase CLI (if not installed)

```bash
npm install -D supabase
```

### 1b. Generate types from the live database

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/database.types.ts
```

The project ID is in the Supabase Dashboard URL: `https://supabase.com/dashboard/project/<project-id>`.

If the CLI cannot connect (missing credentials), use the linked project approach:
```bash
npx supabase login
npx supabase link --project-ref <project-id>
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

### 1c. Fix any type breakages

After regenerating, run `npx tsc --noEmit` and fix all errors. Expected breakage areas:
- Business logic files that reference `Database['public']['Tables']['...']` — the generated shape may differ from the hand-authored stubs
- The `Relationships` field will now be populated (instead of `[]`), which may change join inference
- `Functions` section will be auto-populated from the RPCs (`lookup_qr_token`, `increment_qr_scans`)

### 1d. Add a type generation script

Add to `package.json` scripts:
```json
"db:types": "supabase gen types typescript --linked > src/lib/supabase/database.types.ts"
```

### 1e. Update the build log

Remove the "PENDING: database.types.ts is still a hand-authored stub" note that has been carried forward since Session 1.

---

## Fix 2: Realtime Second-Tab Bug (MEDIUM — User-Facing)

**Problem:** From debug.md Session 6 Known Limitations:
> "A freshly opened second tab requires one page reload before Realtime updates propagate. Root cause: the Realtime subscription fires before `supabase.auth.getSession()` has restored the session from cookies, so the initial subscription has no auth token and receives no events."

This affects the IC workflow: an IC with two monitors (personnel board on one, map on another) won't see live updates on the second screen until they reload.

**Root cause:** The Realtime channel is created before the auth session is ready.

**The fix:** Subscribe inside `onAuthStateChange` listening for `INITIAL_SESSION` with a `cancelled` flag (the correct pattern from claude-rules.md Section 20 and MEMORY.md).

**What to do:**

### 2a. Identify all components with Realtime subscriptions

Search the codebase for `supabase.channel(` or `.on('postgres_changes'`. Expected locations:
- `src/features/incidents/components/personnel-board.tsx`
- `src/features/incidents/components/par-panel.tsx`
- Any other component that subscribes to Realtime

### 2b. Refactor each to use the correct subscription pattern

The correct pattern (from MEMORY.md):

```typescript
useEffect(() => {
  let cancelled = false;
  let channel: RealtimeChannel | null = null;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (cancelled) return;
    if (event === 'INITIAL_SESSION' && session) {
      // Session is ready — safe to subscribe
      channel = supabase
        .channel(`personnel-${incidentId}`)
        .on('postgres_changes', { /* ... */ }, handleChange)
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' && !cancelled) {
            // Real network failure — reconnect
            channel?.unsubscribe();
            // Re-subscribe after delay
          }
        });
    }
  });

  return () => {
    cancelled = true;
    subscription.unsubscribe();
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}, [incidentId]);
```

**Critical rules (from MEMORY.md):**
- WRONG: `getSession().then(setupChannel)` — races with `TOKEN_REFRESHED`
- WRONG: reconnect on `CLOSED` — fires when WE call `removeChannel`; infinite loop
- WRONG: handle `SIGNED_IN` — fires on every page load (cookie restore), double setup
- WRONG: handle `TOKEN_REFRESHED` for channel re-creation — internal listener already calls `setAuth(new_token)`
- CORRECT: `INITIAL_SESSION` (non-null) + `cancelled` flag. Only reconnect on `CHANNEL_ERROR`.

### 2c. Test

- Open the incident board in two tabs simultaneously
- Change a personnel status in Tab A
- Verify Tab B updates within 2 seconds **without a page reload**
- Document this in the debug.md entry as a regression test

---

## Fix 3: API Retry Logic (MEDIUM — Reliability)

**Problem:** `claude-rules.md` Section 7 says: "Network requests to external services must include exponential backoff retry logic (max 3 attempts)." No retry wrappers exist in the codebase.

This matters for Supabase calls during degraded network conditions (field command post with intermittent connectivity).

**What to build:**

### 3a. Create a retry utility

Create `/lib/retry.ts` that exports a generic retry wrapper:

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number; }
): Promise<T>
```

- Default: 3 attempts, exponential backoff (200ms, 400ms, 800ms)
- Throws the last error if all attempts fail
- Logs each retry attempt (but not the full error — no PII)

### 3b. Apply to critical mutation paths

The retry wrapper is NOT for every Supabase call. Apply it to:
- `POST /api/check-in/[token]` — volunteer check-in during field conditions
- `PATCH /api/incidents/[id]/personnel/[personnelId]` — status updates from the field
- Any future Twilio/Resend calls (notification dispatch)

Do NOT apply to:
- Read queries (retrying a read that returned empty data is confusing)
- Idempotent mutations that already succeeded (check-in duplicate detection handles this)

### 3c. Tests

- Write unit tests for `withRetry` — verify it retries on failure, respects max attempts, and returns success on first try without delay

---

## Fix 4: Audit Log IP Address and User Agent Capture (MEDIUM — Compliance)

**Problem:** The `audit_log` schema has `ip_address INET` and `user_agent TEXT` columns, but the `createOrganization` logic (and likely all other audit log writes) never populates them. SOC 2 auditors expect access pattern metadata.

**What to do:**

### 4a. Update the audit log write utility

Wherever audit log entries are written (search for `audit_log` inserts), extract and pass `ip_address` and `user_agent` from the request headers.

In Next.js API routes, these come from:
- IP: `request.headers.get('x-forwarded-for')` (Vercel sets this) or `request.headers.get('x-real-ip')`
- User Agent: `request.headers.get('user-agent')`

### 4b. Create a shared helper

Create a helper that extracts request metadata:

```typescript
// /lib/request-meta.ts
export function getRequestMeta(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null,
    userAgent: request.headers.get('user-agent') ?? null,
  };
}
```

### 4c. Pass through to all audit log writes

Update `createOrganization` and any other functions that write to `audit_log` to accept and pass `ipAddress` and `userAgent`. The API route handler calls `getRequestMeta(request)` and passes the result to the business logic function.

### 4d. Do NOT log IP/UA to Sentry

This metadata goes to the audit log only. Do not add IP addresses to Sentry events (PII scrubbing rule).

---

## Fix 5: Role Assignment Audit Logging (MEDIUM — Compliance)

**Problem:** When a role is assigned or changed on an incident (via `incident_command_structure` + `incident_personnel.incident_role` dual-write), the action is written to `incident_log` but NOT to `audit_log`. For SOC 2, role changes are a sensitive action that should appear in the compliance audit trail.

**What to do:**

### 5a. Identify where role assignments happen

Search for code that writes to `incident_command_structure` or updates `incident_personnel.incident_role`. Expected locations:
- `src/features/incidents/logic/create-incident.ts` (IC assignment on incident creation)
- `src/features/incidents/logic/update-personnel-status.ts` (inline role assignment)

### 5b. Add audit log writes

After the `incident_log` write, add an `audit_log` write:
```typescript
{
  organization_id: orgId,
  actor_id: userId,
  actor_email: userEmail,
  action: 'incident.role_assigned',
  resource_type: 'incident_personnel',
  resource_id: personnelId,
  ip_address: ipAddress,    // from Fix 4
  user_agent: userAgent,    // from Fix 4
  metadata: {
    incident_id: incidentId,
    role: newRole,
    previous_role: previousRole ?? null,
  }
}
```

### 5c. Tests

- Update existing unit tests for role assignment to verify `audit_log` insert is called
- Verify the metadata includes both the new and previous role

---

## Verification Checklist

Before marking this session complete, verify:

- [ ] `npx tsc --noEmit` — zero TypeScript errors (critical after type regeneration)
- [ ] `npm test` — all existing + new tests pass
- [ ] Realtime second-tab test: open two tabs → update in Tab A → Tab B updates without reload
- [ ] `database.types.ts` is now generated (not hand-authored)
- [ ] `npm run db:types` script exists and works
- [ ] `withRetry` utility has tests
- [ ] Audit log entries include `ip_address` and `user_agent`
- [ ] Role assignment writes to `audit_log` (not just `incident_log`)
- [ ] No `any` types introduced
- [ ] No file exceeds 400 lines

---
