<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-types -->
# Supabase JS v2 Type Requirements
- Tables MUST include `Relationships` field — supabase-js v2.100+ requires it via `GenericTable`
- Join syntax `.select('*, related(*)')` requires populated `Relationships` — use two queries + merge if `Relationships: []`
- `database.types.ts` is generated via `npm run db:types` — never hand-author
- CHECK-constrained enums resolve as `string` — Zod schemas enforce at boundary
- PostGIS columns resolve as `unknown`; nullable array columns are `string[] | null`
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

<!-- BEGIN:sentry-v10 -->
# @sentry/nextjs v10
- `hideSourceMaps` REMOVED — use `widenClientFileUpload: true`
- `disableClientWebpackPlugin` REMOVED — default behavior covers it
- Valid options: `sourcemaps.disable`, `sourcemaps.filesToDeleteAfterUpload`
<!-- END:sentry-v10 -->
