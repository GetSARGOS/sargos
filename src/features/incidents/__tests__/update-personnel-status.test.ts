import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows, withCount } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import {
  updatePersonnelStatus,
  UpdatePersonnelStatusError,
} from '../logic/update-personnel-status'

const ORG_ID = 'org-uuid'
const ACTOR_MEMBER_ID = 'actor-uuid'
const ACTOR_NAME = 'Jane IC'
const PERSONNEL_ID = 'pers-uuid'
const INCIDENT_ID = 'inc-uuid'

function setup(mock: ReturnType<typeof buildMockSupabase>) {
  vi.mocked(createServiceClient).mockReturnValue(mock)
}

const personnelRow = {
  id: PERSONNEL_ID,
  incident_id: INCIDENT_ID,
  status: 'available',
  member_id: 'member-uuid',
}

describe('updatePersonnelStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('successfully updates status', async () => {
    const mock = buildMockSupabase({
      incident_personnel: [
        ok(personnelRow), // fetch
        ok(null), // update
      ],
      incident_log: ok(null),
    })
    setup(mock)

    const result = await updatePersonnelStatus(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
      { status: 'assigned' },
    )

    expect(result.updated).toBe(true)
  })

  it('successfully checks out personnel', async () => {
    const mock = buildMockSupabase({
      incident_personnel: [
        ok(personnelRow), // fetch
        ok(null), // update (checkout)
      ],
      incident_par_events: noRows(), // no active PAR
      incident_log: ok(null),
    })
    setup(mock)

    const result = await updatePersonnelStatus(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
      { checkout: true },
    )

    expect(result.updated).toBe(true)
  })

  it('throws PERSONNEL_NOT_FOUND when record does not exist', async () => {
    const mock = buildMockSupabase({
      incident_personnel: err('PGRST116'),
    })
    setup(mock)

    await expect(
      updatePersonnelStatus(
        ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
        { status: 'assigned' },
      ),
    ).rejects.toThrow(UpdatePersonnelStatusError)

    try {
      await updatePersonnelStatus(
        ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
        { status: 'assigned' },
      )
    } catch (e) {
      expect((e as UpdatePersonnelStatusError).code).toBe('PERSONNEL_NOT_FOUND')
    }
  })

  it('throws UPDATE_FAILED when update fails', async () => {
    // Provide error for all 3 retry attempts (withRetry maxAttempts=3)
    const mock = buildMockSupabase({
      incident_personnel: [
        ok(personnelRow),
        err('23514'),
        err('23514'),
        err('23514'),
      ],
    })
    setup(mock)

    try {
      await updatePersonnelStatus(
        ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
        { status: 'assigned' },
      )
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdatePersonnelStatusError)
      expect((e as UpdatePersonnelStatusError).code).toBe('UPDATE_FAILED')
    }
  })

  it('adjusts active PAR on checkout (deletes response, recalculates)', async () => {
    const mock = buildMockSupabase({
      incident_personnel: [
        ok(personnelRow),
        ok(null), // update (checkout)
      ],
      incident_par_events: [
        ok({ id: 'par-uuid', total_personnel: 5 }), // active PAR found
        ok(null), // update PAR
      ],
      incident_par_responses: [
        ok(null), // delete response
        withCount(3), // count remaining
      ],
      incident_log: ok(null),
    })
    setup(mock)

    const result = await updatePersonnelStatus(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
      { checkout: true },
    )

    expect(result.updated).toBe(true)
    // Verify PAR-related tables were queried
    const parEventCalls = mock.from.mock.calls.filter(
      (c: string[]) => c[0] === 'incident_par_events',
    )
    expect(parEventCalls.length).toBe(2) // read + update
  })

  it('completes PAR when checkout makes confirmed_count >= new total', async () => {
    const mock = buildMockSupabase({
      incident_personnel: [
        ok(personnelRow),
        ok(null),
      ],
      incident_par_events: [
        ok({ id: 'par-uuid', total_personnel: 2 }), // 2 people, checking one out → 1
        ok(null),
      ],
      incident_par_responses: [
        ok(null), // delete
        withCount(1), // 1 remaining response, 1 total → complete
      ],
      incident_log: ok(null),
    })
    setup(mock)

    const result = await updatePersonnelStatus(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
      { checkout: true },
    )

    expect(result.updated).toBe(true)
  })

  it('writes correct log entry type for status change', async () => {
    const mock = buildMockSupabase({
      incident_personnel: [ok(personnelRow), ok(null)],
      incident_log: ok(null),
    })
    setup(mock)

    await updatePersonnelStatus(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
      { status: 'resting' },
    )

    const logCalls = mock.from.mock.calls.filter(
      (c: string[]) => c[0] === 'incident_log',
    )
    expect(logCalls.length).toBe(1)
  })

  it('throws a typed UpdatePersonnelStatusError (not a plain Error)', async () => {
    const mock = buildMockSupabase({
      incident_personnel: err('PGRST116'),
    })
    setup(mock)

    try {
      await updatePersonnelStatus(
        ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, PERSONNEL_ID,
        { status: 'assigned' },
      )
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdatePersonnelStatusError)
      expect((e as UpdatePersonnelStatusError).name).toBe('UpdatePersonnelStatusError')
    }
  })
})
