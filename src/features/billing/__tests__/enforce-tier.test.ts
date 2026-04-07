import { describe, it, expect } from 'vitest'
import { buildMockSupabase, ok, withCount } from '@/features/incidents/__tests__/test-helpers'
import { enforceTierLimit } from '@/lib/billing/enforce-tier'

describe('enforceTierLimit', () => {
  it('returns null when action is allowed', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'free', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
      incidents: withCount(0),
    })

    const result = await enforceTierLimit(mock, 'org-1', 'create_incident')

    expect(result).toBeNull()
  })

  it('returns 403 Response with TIER_INCIDENT_LIMIT when denied', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'free', status: 'active' }),
      organizations: ok({ seat_cap: 5 }),
      incidents: withCount(1),
    })

    const result = await enforceTierLimit(mock, 'org-1', 'create_incident')

    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)

    const body = await result!.json()
    expect(body.error.code).toBe('TIER_INCIDENT_LIMIT')
    expect(body.meta.tier).toBe('free')
    expect(body.meta.limit).toBe(1)
    expect(body.meta.current).toBe(1)
  })

  it('returns 403 with SUBSCRIPTION_LAPSED for lapsed subscription', async () => {
    const mock = buildMockSupabase({
      subscriptions: ok({ tier: 'team', status: 'canceled' }),
      organizations: ok({ seat_cap: 20 }),
    })

    const result = await enforceTierLimit(mock, 'org-1', 'create_incident')

    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)

    const body = await result!.json()
    expect(body.error.code).toBe('SUBSCRIPTION_LAPSED')
  })
})
