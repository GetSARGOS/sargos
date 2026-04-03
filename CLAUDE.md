@AGENTS.md
@claude-rules.md

# Claude Code Instructions — SAR SaaS Platform

## Read These Files At The Start Of Every Session (in this order):
1. `build-log.md` — read the LAST ENTRY ONLY to understand current state
2. Execute the "What To Do Next Session" instruction from the last build log entry

## At The End Of Every Session:
1. Verify the Definition of Done checklist in `definition-of-done.md`
2. Append a new entry to `build-log.md` using the entry template
3. Append a new testing section to `debug.md` using the debug entry template

> If no code was written this session, skip the DoD checklist and the debug.md entry. Still append a build log entry documenting decisions made.

## Non-Negotiable Reminders:
- Never deviate from the tech stack in `claude-rules.md`
- Never create a table that is not in `database-schema.md` — update the schema doc first
- Never disable or bypass RLS for any reason
- Never use `any` in TypeScript
- Never expose the `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- When in doubt, ask before building