# Prompt: Resolve Compliance Gaps

You are helping me identify and resolve compliance gaps in my SAR SaaS platform. The platform targets SOC 2 → HIPAA → FedRAMP certification. This is a **documentation and decision session** — no code, no migrations. The output is updated documentation and a compliance decision log.

## Setup — Read These Files First:

1. `claude-rules.md` — sections 1, 5, 8 (Identity, Security, Compliance-Readiness)
2. `database-schema.md` — focus on `audit_log`, `incident_subjects`, and any table with PII
3. `feature-list.md` — focus on Feature 8 (Billing tiers mention SOC 2 / HIPAA / FedRAMP)
4. `build-log.md` — last entry only (Session 7)

Do NOT execute the "What To Do Next Session" instruction. This is a design session, not a build session.

---

## Context

The pricing tiers make specific compliance promises:
- **Professional** ($149/mo): "SOC 2 Type II backed, HIPAA-ready data handling"
- **Enterprise** (contract): "FedRAMP authorization"

A design review found 7 compliance gaps — places where the current architecture or documentation doesn't support these claims. Some are documentation gaps, some are architectural decisions, and some are potential blockers that need to be acknowledged and planned for.

For each gap, present the situation, options, and trade-offs. Wait for my decision before moving to the next.

---

## Gap 1: Supabase Cloud Does Not Offer a HIPAA BAA on Standard Plans

`claude-rules.md` Section 1 says: "This system will pursue SOC 2, HIPAA, and FedRAMP compliance."

Feature 8 (Professional tier) promises: "HIPAA-ready data handling."

**The problem:** Standard Supabase Cloud plans do not include a HIPAA Business Associate Agreement (BAA). Without a BAA, storing Protected Health Information (PHI) — which `incident_subjects.medical_notes`, `medications`, and `known_conditions` are — violates HIPAA.

Supabase does offer a HIPAA add-on for their Pro/Enterprise plans, or you can self-host Supabase on a HIPAA-compliant infrastructure (AWS GovCloud, Azure Government).

Decisions needed:
- Is the current architecture HIPAA-compliant, or is this a known gap to be closed before selling Professional tier?
- What's the path — Supabase HIPAA add-on, self-hosting, or acknowledging that HIPAA readiness is aspirational until a specific milestone?
- Should `claude-rules.md` be updated to reflect the actual current state vs the target state?
- Should `feature-list.md` be updated to note that Professional tier's HIPAA claim requires infrastructure changes?

---

## Gap 2: PHI May Need Application-Level Encryption

HIPAA "encryption at rest" is satisfied by Supabase's disk-level encryption (AES-256 on the underlying PostgreSQL storage). But HIPAA best practice — and the standard for FedRAMP Moderate — recommends **field-level encryption** for PHI columns.

This means:
- `incident_subjects.medical_notes`, `medications`, `known_conditions` would be encrypted before INSERT and decrypted after SELECT at the application layer
- A compromised database backup or admin account would not expose PHI in plaintext
- Queries on encrypted fields (e.g., search by medical condition) would not work — but this is unlikely to be a use case

Current state: PHI is stored in plaintext in the database, protected only by RLS and disk encryption.

Decisions needed:
- Is application-level encryption a requirement now, a requirement before Professional tier launches, or a requirement only for FedRAMP?
- If deferred, should `claude-rules.md` acknowledge this as a known gap?
- Should the schema doc note which columns are PHI and will eventually need field-level encryption?

---

## Gap 3: No PHI Access Logging (HIPAA Requirement)

HIPAA requires logging who **accessed** (read) PHI, not just who modified it. The current `audit_log` only tracks mutations (INSERT, UPDATE, DELETE). There is no mechanism to log when someone views:
- `incident_subjects.medical_notes`
- `incident_subjects.medications`
- `incident_subjects.known_conditions`
- `incident_subjects.emergency_contact_name` / `emergency_contact_phone`
- `incident_personnel.volunteer_medical_notes`

In a HIPAA audit, the question is: "Who viewed Patient X's medical records and when?" Today, the answer is: "We don't know."

Decisions needed:
- Should PHI read-access be logged? If yes — at what layer? (API route? Supabase RPC? PostgreSQL audit extension like `pgaudit`?)
- Is this an MVP requirement (blocks Professional tier) or a post-MVP requirement?
- Should `claude-rules.md` Section 8 add a rule about read-access logging for PHI?

---

## Gap 4: Right to Deletion (GDPR / CCPA) Has No Design

`claude-rules.md` Section 8 says: "Design data deletion flows from the start — every entity must have a soft-delete."

But there is no design for "delete my account" or "delete my data." If a user requests deletion:
- `organization_members` — soft-delete, fine
- `incident_personnel` — has `member_id` FK. SET NULL on delete. But the person's name is still in `volunteer_name` if they were a volunteer.
- `incident_log` — denormalized `actor_name`. Immutable — cannot be updated or deleted by design.
- `audit_log` — denormalized `actor_email`. Immutable — cannot be updated or deleted by design.
- `incident_command_structure` — `member_id` FK, SET NULL on delete. But historical records need to show who was IC.

The tension: Compliance requires the ability to delete user data. Compliance also requires immutable audit logs that record who did what. These directly conflict.

Decisions needed:
- What's the deletion strategy? Full erasure? Pseudonymization (replace name/email with "Deleted User #12345")?
- Does the immutable audit log get an exception? (Most HIPAA/SOC 2 frameworks allow audit log retention even after user deletion.)
- Should the `incident_log.actor_name` be anonymized on deletion, or is the denormalized name considered part of the incident record (not the user's personal data)?
- Is this an MVP requirement, or can it wait until the privacy policy is drafted?

---

## Gap 5: No Backup and Disaster Recovery Documentation

SOC 2 Type II requires:
- Documented backup strategy
- Defined Recovery Point Objective (RPO) — how much data can be lost
- Defined Recovery Time Objective (RTO) — how long until service is restored
- Tested disaster recovery procedures

Current state: Supabase provides daily backups on paid plans (Pro: 7-day retention, Enterprise: custom). But none of this is documented in the project, and there's no DR plan.

Decisions needed:
- What are acceptable RPO/RTO targets for a SAR platform? (Consider: an incident is active, data loss could mean losing accountability records during a live search.)
- Should backup/DR rules be added to `claude-rules.md`?
- Is this documentation-only (describe what Supabase provides), or does the platform need its own backup mechanism (e.g., periodic exports to a separate storage provider)?

---

## Gap 6: No Dependency Provenance Document

`claude-rules.md` Section 8 says: "Document every third-party dependency and its purpose. This is required for SOC 2 vendor management."

This document does not exist. The project has ~30+ dependencies (Next.js, Supabase, Sentry, Stripe, Radix UI, Zod, React Hook Form, react-qr-code, etc.) and none are formally documented with purpose, license, and risk assessment.

Decisions needed:
- Should a dependency provenance document be created now, or deferred to a pre-SOC-2 checklist?
- What format? (Markdown table? CSV? A specific SOC 2 template?)
- Should `claude-rules.md` require updating this document whenever a dependency is added?
- Should the document include transitive dependencies or just direct ones?

---

## Gap 7: Data Residency Is Not Documented

FedRAMP requires data residency in the United States. The Supabase project's region is not documented anywhere in the project files. If the project was created on a non-US region, all data is stored outside the US, which blocks FedRAMP.

Additionally, `claude-rules.md` Section 2 says: "Architecture must support a migration to AWS GovCloud" — but there's no concrete plan for what that migration looks like or when it would happen.

Decisions needed:
- What region is the Supabase project on? (This is a factual check, not a design decision.)
- Should the data residency region be documented in `claude-rules.md` or `.env.example`?
- Should the GovCloud migration path be expanded from one bullet point to a concrete section? Or is it too early?
- Should Vercel's deployment region be documented? (Vercel deploys globally by default — is that acceptable, or should it be pinned to US regions?)

---

## Output Format

After we've resolved all 7 gaps, produce:
1. Updates to `claude-rules.md` — exact text for new or modified rules
2. Updates to `feature-list.md` — any tier descriptions or feature notes that need compliance caveats
3. Updates to `database-schema.md` — any columns that need PHI annotations or encryption notes
4. A list of new documents to create (e.g., dependency provenance, DR plan) with their format and scope — but do NOT write them in this session
5. A summary of all decisions made for the build log

Do NOT write any code. This is documentation and decisions only.
