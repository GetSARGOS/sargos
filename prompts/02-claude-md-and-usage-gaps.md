# Prompt: Resolve CLAUDE.md and Claude Code Usage Gaps

You are helping me fix gaps in `CLAUDE.md` (the session protocol) and identify ways to use Claude Code features (hooks, memory) more effectively. This is a **documentation-only session** — no code, no migrations.

## Setup — Read These Files First:

1. `CLAUDE.md` — the file we're fixing
2. `claude-rules.md` — to understand what CLAUDE.md references
3. `definition-of-done.md` — referenced by CLAUDE.md as end-of-session checklist
4. `Debug.md` — referenced by CLAUDE.md (note: capital D)
5. `build-log.md` — last entry only (Session 7)
6. The memory file at the path specified in the system prompt (if accessible)

Do NOT execute the "What To Do Next Session" instruction. This is a design session, not a build session.

---

## Context

A design review found gaps in the session protocol (`CLAUDE.md`) and identified underutilized Claude Code features that could automate repetitive work. These need to be resolved so future sessions are more efficient and less error-prone.

For each gap, present options and ask for my decision before moving to the next.

---

## Gap 1: CLAUDE.md File References Are Fragile

CLAUDE.md says:
- "Read `build-log.md`" — but the actual file is `build-log.md` (capital B)
- "Append a new testing section to `debug.md`" — but the actual file is `Debug.md` (capital D)

On case-sensitive filesystems (Linux, CI environments), these mismatches would cause failures. Even on Windows (case-insensitive), it's inconsistent.

Decision needed: Standardize the filenames. Should we rename the files to lowercase (match the references), or update CLAUDE.md to match the actual filenames? What's the canonical casing convention for project documentation files?

---

## Gap 2: CLAUDE.md Has No Rules About Design-Only Sessions

Every session instruction in CLAUDE.md assumes a build session: "Execute the 'What To Do Next Session' instruction," "Verify the Definition of Done checklist," "Append a new entry to build-log.md."

But we're now running design sessions (like the gap-resolution prompts). In a design session:
- There's nothing to build
- The DoD doesn't apply (or all build items are N/A)
- The build log entry format doesn't fit (no "Files Created or Modified," no "Database Changes")
- The "What To Do Next Session" instruction from the previous build session is irrelevant

This also affects `definition-of-done.md` — the DoD checklist assumes every session produces code. If design sessions become a regular pattern, the DoD needs a clause like "If this is a design session, mark all build-related items N/A."

Decision needed: Should CLAUDE.md acknowledge design sessions as a valid session type? If yes, what's the protocol — skip the build log? Use a different template? Log design decisions somewhere specific? And should `definition-of-done.md` be updated to reference design sessions?

---

## Gap 3: Pre-Commit Hooks for Automated Safety Checks

Several Definition of Done items are checked manually every session:
- No `any` type in TypeScript (could be caught by a grep hook)
- No `service_role` in client-side code (could be caught by a grep hook)
- No files exceeding 400 lines (could be caught by a line-count hook)
- `database-schema.md` updated when a migration file is added (could be caught by a file-change hook)
- No secrets in code (could be caught by a pattern-matching hook)

Claude Code supports hooks (shell commands that run on specific events). These could automate the most error-prone manual checks.

Decision needed: Should we define hooks? If yes, which checks should be automated vs remain manual? Should hooks block commits or just warn? Should the hook definitions live in CLAUDE.md or a separate config?

---

## Gap 4: Migration-Schema Doc Sync Is Entirely Manual

`CLAUDE.md` says: "Never create a table that is not in `database-schema.md` — update the schema doc first." But there's no mechanism to enforce this. A session could write a migration that adds a column not in the schema doc, and the only check is Claude remembering the rule.

Decision needed: Should there be a process improvement here? Options range from a simple checklist item in the build log template to a hook that checks if `database-schema.md` was modified when `supabase/migrations/` was modified.

---

## Gap 5: MEMORY.md Organization Could Be Improved

The auto-memory file (`MEMORY.md`) is getting dense and approaching the 200-line truncation limit noted in the system prompt. It mixes:
- Critical patterns (Supabase Realtime, Next.js 16 breaking changes)
- Project state (session tracking, deployment status)
- Key file locations (a long list)
- Known issues
- Architecture notes

If the file gets truncated, critical patterns (like the Realtime subscription fix) could be lost.

Decision needed: Should MEMORY.md be restructured? Options:
- Split into topic files (`supabase-patterns.md`, `project-state.md`, etc.) with MEMORY.md as a concise index that stays under 200 lines
- Prune stale entries (e.g., "Ready for Feature 3" is outdated) and consolidate
- Keep as-is and hope the 200-line limit isn't hit

---

## Gap 6: Build Log Template Could Better Capture Documentation Changes

The build log template has "Files Created or Modified" and "Database Changes" but when sessions primarily update documentation files (`feature-list.md`, `database-schema.md`, `claude-rules.md`), these changes get mixed in with code file changes and are easy to miss.

This is a minor issue — doc files can go under "Files Created or Modified." But given that design sessions are becoming a pattern, having clarity here would help.

Decision needed: Should the build log template add a "Documentation Changes" subsection? Or is the current "Files Created or Modified" section sufficient if used consistently?

---

## Output Format

After we've resolved all 6 gaps, produce:
1. The complete updated `CLAUDE.md` — full file content
2. An updated `definition-of-done.md` if changes were decided
3. An updated `build-log.md` entry template if changes were decided
4. Any new files that were decided (e.g., hook configs, memory file restructuring plan)
5. A summary of all decisions made for the build log

Do NOT write any code. This is documentation only.
