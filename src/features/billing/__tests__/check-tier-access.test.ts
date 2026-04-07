import { describe, it, expect } from 'vitest'
import { buildMockSupabase, ok, withCount } from '@/features/incidents/__tests__/test-helpers'
import { checkTierAccess } from '@/lib/billing/check-tier-access'

describe('checkTierAccess', () => {
  // ─── create_incident ─────────────────────────────────────────────────────

  it('free tier: allows creating first active incident', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'free', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
      incidents: withCount(0),
    })

    const result = await checkTierAccess(mock, 'org-1', 'create_incident')

    expect(result.allowed).toBe(true)
    expect(result.tier).toBe('free')
    expect(result.limit).toBe(1)
    expect(result.current).toBe(0)
  })

  it('free tier: blocks creating 2nd active incident', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'free', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
      incidents: withCount(1),
    })

    const result = await checkTierAccess(mock, 'org-1', 'create_incident')

    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('free')
    expect(result.reason).toContain('1 active incident')
    expect(result.limit).toBe(1)
    expect(result.current).toBe(1)
  })

  it('team tier: allows unlimited incidents', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'team', status: 'active' }),
      organizations: ok({ seat_cap: 20 }),
    })

    const result = await checkTierAccess(mock, 'org-1', 'create_incident')

    expect(result.allowed).toBe(true)
    expect(result.tier).toBe('team')
  })

  // ─── add_member ──────────────────────────────────────────────────────────

  it('free tier: allows adding member when under limit', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'free', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
      organization_members: withCount(3),
    })

    const result = await checkTierAccess(mock, 'org-1', 'add_member')

    expect(result.allowed).toBe(true)
    expect(result.tier).toBe('free')
  })

  it('free tier: blocks 6th member', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'free', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
      organization_members: withCount(5),
    })

    const result = await checkTierAccess(mock, 'org-1', 'add_member')

    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('free')
    expect(result.limit).toBe(5)
    expect(result.current).toBe(5)
  })

  it('team tier: respects seat_cap', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'team', status: 'active' }),
      organizations: ok({ seat_cap: 10 }),
      organization_members: withCount(10),
    })

    const result = await checkTierAccess(mock, 'org-1', 'add_member')

    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('team')
    expect(result.limit).toBe(10)
    expect(result.current).toBe(10)
  })

  it('enterprise tier: allows unlimited members', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'enterprise', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
    })

    const result = await checkTierAccess(mock, 'org-1', 'add_member')

    expect(result.allowed).toBe(true)
    expect(result.tier).toBe('enterprise')
  })

  // ─── Feature gates ───────────────────────────────────────────────────────

  it('free tier: blocks feature-gated actions', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'free', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
    })

    const icsResult = await checkTierAccess(mock, 'org-1', 'export_ics_form')
    expect(icsResult.allowed).toBe(false)

    const auditResult = await checkTierAccess(mock, 'org-1', 'view_audit_log')
    expect(auditResult.allowed).toBe(false)

    const notifResult = await checkTierAccess(mock, 'org-1', 'use_notifications')
    expect(notifResult.allowed).toBe(false)
  })

  // ─── Edge cases ──────────────────────────────────────────────────────────

  it('missing subscription: treats as free', async () => {
    const mock = buildMockSupabase({
      subscriptions: { data: null, error: null },
      organizations: ok({ seat_cap: 5 }),
      incidents: withCount(1),
    })

    const result = await checkTierAccess(mock, 'org-1', 'create_incident')

    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('free')
  })

  it('lapsed subscription: blocks all actions', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'team', status: 'past_due' }),
      organizations: ok({ seat_cap: 20 }),
    })

    const result = await checkTierAccess(mock, 'org-1', 'create_incident')

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('past_due')
  })
})
