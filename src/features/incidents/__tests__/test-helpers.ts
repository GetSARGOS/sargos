/**
 * Shared mock helpers for incident logic unit tests.
 *
 * All logic functions under /features/incidents/logic call createServiceClient()
 * internally. Tests mock @/lib/supabase/service and use these helpers to build
 * a Supabase client mock that satisfies the fluent query builder interface.
 */
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// ─── Chain proxy ─────────────────────────────────────────────────────────────
// Returns a proxy that acts as both a fluent builder and a thenable.
// Any method call returns the same proxy (chainable). Awaiting it resolves
// to `resolveValue`. This covers all Supabase builder patterns:
//   - .select().eq().is().maybeSingle()   → resolves at maybeSingle
//   - .select().eq().is()                 → resolves on await (count queries)
//   - .insert({...})                      → resolves on await (bare insert)
//   - .insert({...}).select().single()    → resolves at single
//   - .update({...}).eq()                 → resolves on await

function makeChain(resolveValue: unknown): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      // Make it awaitable — `await chain` resolves to resolveValue
      if (prop === 'then') {
        return (
          resolve: (v: unknown) => unknown,
          reject: (e: unknown) => unknown,
        ) => Promise.resolve(resolveValue).then(resolve, reject)
      }
      // All builder methods return the same proxy so chains can be arbitrary length
      return (..._args: unknown[]) => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler) as Record<string, unknown>
}

// ─── Mock client factory ──────────────────────────────────────────────────────
// Accepts a per-table response array. When the same table is queried multiple
// times (e.g., incident_personnel read then update), the nth call returns the
// nth entry in the array. Falls back to { data: null, error: null } if the
// array is exhausted or the table is not configured.

type TableResponses = Partial<Record<string, unknown[] | unknown>>
type RpcResponses = Partial<Record<string, unknown>>

export function buildMockSupabase(
  tables: TableResponses = {},
  rpcs: RpcResponses = {},
): SupabaseClient<Database> {
  const callCounts: Record<string, number> = {}

  const from = vi.fn().mockImplementation((table: string) => {
    const idx = callCounts[table] ?? 0
    callCounts[table] = idx + 1

    const config = tables[table]
    let result: unknown
    if (Array.isArray(config)) {
      result = config[idx] ?? { data: null, error: null }
    } else {
      result = config ?? { data: null, error: null }
    }

    return makeChain(result)
  })

  const rpc = vi.fn().mockImplementation((name: string) => {
    const result = rpcs[name] ?? { data: [], error: null }
    return makeChain(result)
  })

  return { from, rpc } as unknown as SupabaseClient<Database>
}

// ─── Convenience factories ────────────────────────────────────────────────────

export function ok<T>(data: T) {
  return { data, error: null }
}

export function err(code: string, message = 'db error') {
  return { data: null, error: { code, message } }
}

export function noRows() {
  return { data: null, error: null }
}

export function withCount(count: number) {
  return { count, data: null, error: null }
}
