# Prompt: Security Hardening — Rate Limiting, CSRF, and CSP

You are helping me close security gaps identified in a comprehensive audit of the SAR SaaS platform. These are not theoretical — they affect endpoints that are live today.

This is a **build session** — you will write code, configuration, and tests.

## Setup — Read These Files First (in this order):

1. `build-log.md` — last entry only (for current state)
2. `claude-rules.md` — Section 5 (Security Rules), Section 17 (Rate Limiting), Section 18 (Caching)
3. `definition-of-done.md` — for the checklist you must satisfy

Execute the "What To Do Next Session" instruction only if it is compatible with the work below. If not, this prompt takes priority — document why in the build log.

---

## Context

A full-project audit identified 3 security gaps that must be closed before the next feature is built. One of them is **critical** — the platform's only public-facing endpoint (`POST /api/check-in/[token]`) has zero abuse protection. A bot could spam thousands of fake volunteer check-ins during an active search, flooding the IC's personnel board with garbage data.

These gaps exist because the rules document the correct patterns (claude-rules.md Sections 5 and 17) but the code was written before those sections were finalized.

Work through these **in order** — each builds on the previous.

---

## Gap 1: Rate Limiting (CRITICAL)

**Problem:** No rate limiting exists anywhere in the application. `claude-rules.md` Section 17 defines the full strategy (Upstash Redis, tiered limits), but zero code has been written.

**What to build:**

### 1a. Install and configure Upstash Redis rate limiter

- Install `@upstash/ratelimit` and `@upstash/redis`
- Create a rate limiting utility at `/lib/rate-limit.ts` that exports reusable limiters:
  - `publicLimiter` — 10 requests per minute per IP (for `/api/check-in/[token]`)
  - `authenticatedLimiter` — 60 requests per minute per user ID
  - `expensiveLimiter` — 20 requests per minute per organization ID (for incident creation, PDF export)
- Each limiter returns `{ success, limit, remaining, reset }` and the API route sets the `Retry-After` header on 429 responses
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.example`

### 1b. Apply rate limiting to existing routes

- `POST /api/check-in/[token]` — `publicLimiter` (per IP). This is the #1 priority.
- `POST /api/organizations` — `authenticatedLimiter` (per user)
- `POST /api/incidents` — `expensiveLimiter` (per org)
- `POST /api/incidents/[id]/personnel` — `authenticatedLimiter` (per user)
- `POST /api/incidents/[id]/par` — `authenticatedLimiter` (per user)
- `POST /api/incidents/[id]/qr-tokens` — `authenticatedLimiter` (per user)

### 1c. Rate limit response shape

All 429 responses must follow the standard `{ data, error, meta }` shape:
```json
{
  "data": null,
  "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Try again in 42 seconds." },
  "meta": { "retryAfter": 42 }
}
```

Include a `Retry-After` HTTP header with the seconds until the limit resets.

### 1d. Environment-specific behavior

- **Local dev:** Rate limiting should be relaxed or disabled unless `UPSTASH_REDIS_REST_URL` is set. Do not crash the app if Upstash credentials are missing — log a warning and skip the check.
- **Staging and production:** Enforced.
- Never branch application logic on environment — only branch on whether the env vars are present.

### 1e. Tests

- Write unit tests for the rate limit utility (mock the Redis client)
- Write an API route test for `POST /api/check-in/[token]` that verifies a 429 is returned after exceeding the limit

---

## Gap 2: CSRF Protection on Public POST Endpoint (HIGH)

**Problem:** `claude-rules.md` Section 5 says: "For public POST endpoints (e.g., `/api/check-in/[token]`), validate the request origin header or use a CSRF token."

The `POST /api/check-in/[token]` endpoint currently performs no origin validation. An attacker could craft a malicious page that auto-submits a form to this endpoint.

**What to build:**

### 2a. Origin validation middleware

- Create a utility at `/lib/csrf.ts` that exports `validateOrigin(request: Request): boolean`
- The function checks the `Origin` header (or `Referer` as fallback) against a list of allowed origins
- Allowed origins: `process.env.NEXT_PUBLIC_APP_URL` (if set), `localhost:3000` (dev only via `NODE_ENV`)
- If no `Origin` or `Referer` header is present (non-browser clients like curl), allow the request — CSRF is a browser-only attack vector
- If the `Origin` is present but doesn't match the allowlist, return `false`

### 2b. Apply to public POST routes

- `POST /api/check-in/[token]` — validate origin before processing. Return 403 with `{ data: null, error: { code: "CSRF_ORIGIN_MISMATCH", message: "Forbidden" }, meta: null }` if validation fails.

### 2c. Do NOT apply to authenticated routes

- Authenticated routes are protected by `SameSite=Lax` on the Supabase session cookie. No additional CSRF protection needed.

---

## Gap 3: Content Security Policy (MEDIUM)

**Problem:** `claude-rules.md` Section 5 says: "A Content-Security-Policy header must be configured before production launch. Start with a strict policy (`default-src 'self'`) and add exceptions as needed."

No CSP header exists. This should be configured now before more third-party integrations are added.

**What to build:**

### 3a. CSP header configuration

- Add CSP headers via `next.config.ts` security headers (the `headers()` function in Next.js config)
- Start with a strict base policy and add only the exceptions needed today:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co;
font-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mapbox.com https://*.tiles.mapbox.com;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

**Notes on `unsafe-inline` / `unsafe-eval`:**
- `unsafe-inline` for scripts: required by Next.js for inline script injection (hydration). Can be tightened to nonce-based later.
- `unsafe-eval` for scripts: required by Mapbox GL JS. Can be removed if Mapbox offers a CSP-compatible build in the future.
- `unsafe-inline` for styles: required by Tailwind's runtime style injection. Can be tightened to hash-based later.

### 3b. CSP violation reporting

- Add `report-uri` directive pointing to Sentry's CSP endpoint (if Sentry is configured)
- If Sentry DSN is not set, omit the `report-uri` directive — do not break local dev

### 3c. Test

- Add a Playwright test that loads a page and verifies the `Content-Security-Policy` header is present in the response

---

## Verification Checklist

Before marking this session complete, verify:

- [ ] `npm test` — all existing + new tests pass
- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] Rate limiting works: `curl` the check-in endpoint 11 times in 60 seconds → 11th request returns 429
- [ ] CSRF works: `curl -H "Origin: https://evil.com" -X POST /api/check-in/[token]` → returns 403
- [ ] CSP header present: check any page response headers in DevTools → Network → Response Headers
- [ ] `.env.example` updated with new Upstash variables
- [ ] No `any` types introduced
- [ ] No file exceeds 400 lines

---

## Environment Variables Needed

You will need to set up an Upstash Redis instance before testing rate limiting:
1. Go to https://console.upstash.com
2. Create a new Redis database (free tier is fine for dev)
3. Copy the REST URL and token
4. Add to `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

If you want to skip Upstash setup for now, the rate limiter should gracefully degrade (log warning, allow all requests) when credentials are missing.

---
