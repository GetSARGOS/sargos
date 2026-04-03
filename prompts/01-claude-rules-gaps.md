# Prompt: Resolve claude-rules.md Gaps

You are helping me fix gaps in `claude-rules.md` — the non-negotiable rules file for my SAR SaaS platform. This is the foundational constraint document that every build session references. Gaps here propagate into every feature, schema decision, and code review.

This is a **documentation-only session** — no code, no migrations, no components. The output is an updated `claude-rules.md`.

## Setup — Read These Files First (in this order):

1. `claude-rules.md` — the file we're fixing
2. `CLAUDE.md` — to understand how claude-rules.md is referenced
3. `feature-list.md` — to understand what the rules need to support
4. `build-log.md` — last entry only (Session 7), to understand current project state and patterns already established

Do NOT execute the "What To Do Next Session" instruction. This is a design session, not a build session.

---

## Context

A design review found gaps in `claude-rules.md` — rules that are missing, outdated, too vague, or don't cover scenarios we've already encountered. These are split into two groups: **7 full gaps** that need multi-option discussion, and **5 quick decisions** that need a one-line rule each.

For the full gaps: present 2–3 options with trade-offs, ask for my decision, then draft the rule text. Work through them **one at a time**.

For the quick decisions: present them all at once at the end, with a recommended one-liner for each. I'll approve or adjust.

---

## Full Gaps (discuss one at a time)

---

### Gap 1: No Migration Rollback Strategy (Section 4 — Architecture Rules → Database)

Section 4 says: "Migrations are versioned and sequential — never edit a migration that has already been applied."

This tells Claude what NOT to do, but not what TO do when a migration is wrong. Seven sessions in, all migrations have been applied successfully, but a bad migration is inevitable. The Definition of Done even says "apply → verify → rollback → re-apply" — but there's no process for what "rollback" means.

Decision needed: What's the documented strategy when a migration has been applied and turns out to be wrong? Compensating migration? Drop and recreate? Different rules for dev vs production?

---

### Gap 2: No Rate Limiting Rules (Missing Section)

There are no rules about API rate limiting anywhere in the document. This is:
- A SOC 2 requirement (abuse prevention)
- Critical for public endpoints like `/api/check-in/[token]` (could be abused to flood incident personnel records)
- Important for the future public API (Feature 20)
- Standard practice for any SaaS product

Decision needed: Should rate limiting rules be added? If yes — what tier? (Per-IP? Per-user? Per-org?) What tool? (Next.js middleware-level? Vercel's built-in? Upstash Redis?) Should this be a new section or added to an existing one?

Also consider: **request body size limits** for JSON payloads (separate from file uploads). A malicious actor could POST a 100MB JSON body to any endpoint. Should there be a default max body size rule?

---

### Gap 3: No Caching Strategy Rules (Missing Section)

No rules about HTTP caching anywhere. This affects:
- Map tiles (Mapbox) — should be aggressively cached
- Static assets — Vercel handles this, but no explicit rule
- API responses — should incident lists be cached? Org profiles? Subscription status?
- Offline support (Feature 4 mentions "offline tile caching")
- `stale-while-revalidate` patterns for React Query

Decision needed: Should caching rules be added? If yes — should this be its own section or part of Section 6 (Scalability)?

---

### Gap 4: Section 5 References "Next.js Middleware" — Outdated

Section 5 (Security Rules) says: "Authentication on every protected route. Use Next.js middleware to enforce auth on all routes except explicitly public ones."

But the project uses Next.js 16, which renamed `middleware.ts` to `proxy.ts`. The codebase already uses `src/proxy.ts`. The rule references a deprecated API.

Decision needed: Update the rule text to reference `proxy.ts`. Straightforward — just confirming the wording.

---

### Gap 5: No Environment-Specific Rules (Missing Section)

There are no rules distinguishing dev, staging, and production behavior. Currently:
- Email confirmation is disabled in dev (noted in build log as a carry-forward)
- Sentry has a `SENTRY_FORCE_ENABLED` flag for non-production
- Stripe would need test mode vs live mode
- The dev signin route was manually deleted — there's no rule about dev-only utilities

This matters because:
- Without rules, each session reinvents environment handling
- A "dev-only" utility slipping into production is a security risk (it already happened once — `dev/signin/route.ts`)
- Staging needs to behave like production in some ways but not others

Decision needed: Should environment rules be their own section? What behaviors differ across environments?

---

### Gap 6: No Realtime Channel/Subscription Rules (Expand Section 7 — Reliability)

Section 7 says: "All Supabase Realtime subscriptions must implement reconnection logic — automatically resubscribe on connection drop."

That's one rule for a complex subsystem. After 7 sessions, Realtime patterns have been discovered through trial and error (documented in MEMORY.md). Missing rules:
- Channel naming conventions (currently ad-hoc — `incident-board-{id}`, etc.)
- When to use `postgres_changes` vs `broadcast` vs `presence`
- Payload size limits (Supabase has a 1MB limit per message)
- Which subscriptions stay active in background tabs vs lazy-mount
- The correct subscription lifecycle pattern (INITIAL_SESSION + cancelled flag, per MEMORY.md)

Decision needed: Should Realtime get its own section or expanded rules within Section 7? How prescriptive should the rules be?

---

### Gap 7: No File Storage Rules (Missing Section)

No rules about Supabase Storage anywhere. The project will need storage for:
- ICS form PDFs (Feature 5)
- KML/KMZ/GPX file imports (Feature 4)
- Drone flight logs (Feature 4)
- Subject photos (identified as a feature gap)
- Org logos (Feature 9 post-MVP)
- Camera photos from mobile app (Feature 10)

Without rules, each feature will invent its own bucket naming, access control, file size limits, and naming conventions.

Decision needed: Should file storage rules be their own section? What should they cover — bucket structure, naming conventions, size limits, content-type validation, RLS on storage?

---

## Quick Decisions (present all at once)

These gaps are real but don't need full multi-option discussions. For each one, I've included a recommended one-line rule. Present them all together and let me approve, modify, or reject each.

### Q1: No API Versioning Strategy

Currently all routes are unversioned. The public API (Feature 20) is Year 2+. The mobile app (Feature 10) is post-MVP.

**Recommended rule** (add to Section 4 → API Design): "Internal API routes are unversioned. When the public API is built (Feature 20), introduce URL-based versioning (`/api/v1/`). Until then, breaking changes to internal APIs are coordinated through the mobile app release cycle."

### Q2: No CORS Policy

Everything is same-origin today. Mobile app and public API are future concerns.

**Recommended rule** (add to Section 5 → Security): "Default CORS policy is same-origin. Cross-origin access is not permitted until the mobile app or public API requires it. When introduced, use an explicit allowlist — never `Access-Control-Allow-Origin: *` on authenticated endpoints."

### Q3: No Data Seeding Strategy

All test data is created manually. A dev seed script would help onboarding but isn't a security/reliability concern.

**Recommended rule** (add to Section 11 → Testing): "A database seed script (`supabase/seed.sql`) must exist with sample organizations, members, and incidents for local development. Seed data must never contain real PII. The seed script is not run in staging or production."

### Q4: Mobile Shared Code Boundary Is Vague

Section 14 says logic must be "framework-agnostic" but current logic files import Next.js-specific Supabase clients.

**Recommended rule** (update Section 14): "Business logic functions must accept a Supabase client as a parameter — never import a client directly. This allows the same logic to be called with a server client (Next.js), a browser client (web), or a mobile client (React Native). Zod schemas and pure utility functions are inherently portable. The `@/` path alias is a build-tool concern, not a portability concern."

### Q5: No Internationalization Rules

No i18n exists. FedRAMP path and bilingual SAR teams may need it eventually.

**Recommended rule** (add to Section 4 → General): "Internationalization is deferred to post-MVP. UI strings are hardcoded in English. When i18n is introduced, use ICU MessageFormat via a library like `next-intl`. Do not prematurely abstract strings — the cost of retrofitting is lower than the cost of maintaining an i18n layer before it's needed."

### Q6: No CSRF Protection Rule

The public `/api/check-in/[token]` endpoint accepts POST without authentication. Next.js API routes have some built-in protections but nothing is explicitly documented.

**Recommended rule** (add to Section 5 → Security): "All state-changing API routes must be protected against CSRF. For authenticated routes, the Supabase session cookie with `SameSite=Lax` provides implicit CSRF protection. For public POST endpoints (e.g., `/api/check-in/[token]`), validate the request origin header or use a CSRF token."

### Q7: No Content Security Policy (CSP) Rule

CSP headers are a FedRAMP requirement and defend against XSS. No CSP is configured.

**Recommended rule** (add to Section 5 → Security): "A Content-Security-Policy header must be configured before production launch. Start with a strict policy (`default-src 'self'`) and add exceptions as needed for Mapbox, Supabase, Sentry, and Stripe. CSP violations must be reported to Sentry."

---

## Output Format

After we've resolved all gaps (7 full + 7 quick), produce:
1. The complete updated `claude-rules.md` with all changes applied — full file content, not diffs, so I can review the whole document
2. A summary of all decisions made, formatted as a "Decisions" section suitable for appending to `build-log.md`

Do NOT write any code. This is documentation only.
