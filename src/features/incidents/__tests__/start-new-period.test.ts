import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows, type MockSupabaseClient } from './test-helpers'
import { startNewPeriod, StartNewPeriodError } from '../logic/start-new-period'
import type { StartNewPeriodInput } from '../schemas'

vi.mock('@/lib/retry', () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}))

const INC_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const MEMBER_ID = 'member-uuid'
const USER_ID = 'user-uuid'
const ACTOR_NAME = 'Jane IC'
const PERIOD_ID = 'period-uuid'

const validInput: StartNewPeriodInput = {
  objectives: 'Expand search to sector 4',
  weatherSummary: 'Clear skies, 65F',
}

describe('startNewPeriod', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts a new period and returns periodId + periodNumber', async () => {
    const mock = buildMockSupabase({
      // 1) fetch incident, 2) update incident current_operational_period
      incidents: [
        ok({ id: INC_ID, status: 'active' }),
        ok(null),
      ],
      // 1) fetch latest period, 2) close current, 3) insert new
      operational_periods: [
        ok({ period_number: 1 }), // latest existing period
        ok(null),                  // close current
        ok({ id: PERIOD_ID }),     // insert new
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await startNewPeriod(
      mock as unknown as Parameters<typeof startNewPeriod>[0],
      INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    expect(result.periodId).toBe(PERIOD_ID)
    expect(result.periodNumber).toBe(2)
  })

  it('starts at period 1 when no prior period exists', async () => {
    const mock = buildMockSupabase({
      incidents: [
        ok({ id: INC_ID, status: 'active' }),
        ok(null),
      ],
      operational_periods: [
        noRows(),              // latest period lookup — none exist
        ok({ id: PERIOD_ID }), // insert new (no close step)
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await startNewPeriod(
      mock as unknown as Parameters<typeof startNewPeriod>[0],
      INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    expect(result.periodId).toBe(PERIOD_ID)
    expect(result.periodNumber).toBe(1)
  })

  it('throws INCIDENT_NOT_FOUND when incident missing', async () => {
    const mock = buildMockSupabase({
      incidents: noRows(),
    })

    try {
      await startNewPeriod(
        mock as unknown as Parameters<typeof startNewPeriod>[0],
        INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(StartNewPeriodError)
      expect((e as StartNewPeriodError).code).toBe('INCIDENT_NOT_FOUND')
    }
  })

  it('throws START_FAILED when insert fails', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      operational_periods: [
        ok({ period_number: 2 }),         // latest existing period
        ok(null),                          // close current
        err('23505', 'unique violation'),  // insert fails
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    try {
      await startNewPeriod(
        mock as unknown as Parameters<typeof startNewPeriod>[0],
        INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(StartNewPeriodError)
      expect((e as StartNewPeriodError).code).toBe('START_FAILED')
    }
  })

  it('increments period number from current value', async () => {
    const mock = buildMockSupabase({
      incidents: [
        ok({ id: INC_ID, status: 'active' }),
        ok(null),
      ],
      operational_periods: [
        ok({ period_number: 5 }), // latest existing period
        ok(null),                  // close current
        ok({ id: PERIOD_ID }),     // insert new
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await startNewPeriod(
      mock as unknown as Parameters<typeof startNewPeriod>[0],
      INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, {},
    )

    expect(result.periodNumber).toBe(6)
  })
})
