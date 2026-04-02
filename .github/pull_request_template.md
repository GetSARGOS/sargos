## Summary

<!-- 1-3 bullet points describing what this PR does and why -->

-

## Test plan

<!-- How was this tested? What should a reviewer verify? -->

- [ ] Unit tests pass (`npm test`)
- [ ] TypeScript strict mode passes (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] Manual verification (describe steps)

## Checklist

- [ ] No `any` types introduced
- [ ] No secrets or PII in code or logs
- [ ] RLS policies cover new tables (if applicable)
- [ ] `database-schema.md` updated (if migrations added)
- [ ] Error, loading, and empty states handled (if UI changes)
- [ ] Accessibility: labels, keyboard nav, semantic HTML (if UI changes)
