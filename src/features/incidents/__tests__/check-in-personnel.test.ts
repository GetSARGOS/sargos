import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import {
  checkInPersonnel,
  CheckInPersonnelError,
} from '../logic/check-in-personnel'

const ORG_ID = 'org-uuid'
const ACTOR_MEMBER_ID = 'actor-member-uuid'
const ACTOR_NAME = 'Jane IC'
const INCIDENT_ID = 'inc-uuid'
const MEMBER_ID = 'member-uuid'
const PERSONNEL_ID = 'pers-uuid'

function setup(mock: ReturnType<typeof buildMockSupabase>) {
  vi.mocked(createServiceClient).mockReturnValue(mock)
}

describe('checkInPersonnel', () => {
  beforeEach(() => vi.clearAllMocks())

  const input = { memberId: MEMBER_ID }

  it('successfully checks in a member', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INCIDENT_ID, name: 'Test', status: 'active' }),
      organization_members: ok({ id: MEMBER_ID, display_name: 'Bob' }),
      incident_personnel: [
        noRows(), // duplicate check — no existing record
        ok({ id: PERSONNEL_ID }), // insert
      ],
      incident_par_events: noRows(), // no active PAR
      incident_log: ok(null), // log insert
    })
    setup(mock)

    const result = await checkInPersonnel(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input,
    )

    expect(result.personnelId).toBe(PERSONNEL_ID)
  })

  it('throws INCIDENT_NOT_FOUND when incident does not exist', async () => {
    const mock = buildMockSupabase({
      incidents: err('PGRST116'),
    })
    setup(mock)

    await expect(
      checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input),
    ).rejects.toThrow(CheckInPersonnelError)

    try {
      await checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input)
    } catch (e) {
      expect((e as CheckInPersonnelError).code).toBe('INCIDENT_NOT_FOUND')
    }
  })

  it('throws MEMBER_NOT_FOUND when member does not exist', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INCIDENT_ID, name: 'Test', status: 'active' }),
      organization_members: err('PGRST116'),
    })
    setup(mock)

    await expect(
      checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input),
    ).rejects.toThrow(CheckInPersonnelError)

    try {
      await checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input)
    } catch (e) {
      expect((e as CheckInPersonnelError).code).toBe('MEMBER_NOT_FOUND')
    }
  })

  it('throws ALREADY_CHECKED_IN when duplicate found', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INCIDENT_ID, name: 'Test', status: 'active' }),
      organization_members: ok({ id: MEMBER_ID, display_name: 'Bob' }),
      incident_personnel: ok({ id: 'existing-pers' }), // duplicate check returns a row
    })
    setup(mock)

    await expect(
      checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input),
    ).rejects.toThrow(CheckInPersonnelError)

    try {
      await checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input)
    } catch (e) {
      expect((e as CheckInPersonnelError).code).toBe('ALREADY_CHECKED_IN')
    }
  })

  it('throws CHECK_IN_FAILED when insert fails', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INCIDENT_ID, name: 'Test', status: 'active' }),
      organization_members: ok({ id: MEMBER_ID, display_name: 'Bob' }),
      incident_personnel: [
        noRows(), // duplicate check — clear
        err('23505'), // insert fails
      ],
    })
    setup(mock)

    await expect(
      checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input),
    ).rejects.toThrow(CheckInPersonnelError)

    try {
      await checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input)
    } catch (e) {
      expect((e as CheckInPersonnelError).code).toBe('CHECK_IN_FAILED')
    }
  })

  it('adjusts active PAR total_personnel when PAR is active', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INCIDENT_ID, name: 'Test', status: 'active' }),
      organization_members: ok({ id: MEMBER_ID, display_name: 'Bob' }),
      incident_personnel: [
        noRows(), // duplicate check
        ok({ id: PERSONNEL_ID }), // insert
      ],
      incident_par_events: [
        ok({ id: 'par-uuid', total_personnel: 5 }), // active PAR found
        ok(null), // update call
      ],
      incident_log: ok(null),
    })
    setup(mock)

    const result = await checkInPersonnel(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input,
    )

    expect(result.personnelId).toBe(PERSONNEL_ID)
    // Verify from was called for incident_par_events (read + update)
    const parCalls = mock.from.mock.calls.filter(
      (c: string[]) => c[0] === 'incident_par_events',
    )
    expect(parCalls.length).toBe(2)
  })

  it('writes incident_log entry on success', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INCIDENT_ID, name: 'Test', status: 'active' }),
      organization_members: ok({ id: MEMBER_ID, display_name: 'Bob' }),
      incident_personnel: [noRows(), ok({ id: PERSONNEL_ID })],
      incident_par_events: noRows(),
      incident_log: ok(null),
    })
    setup(mock)

    await checkInPersonnel(
      ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input,
    )

    const logCalls = mock.from.mock.calls.filter(
      (c: string[]) => c[0] === 'incident_log',
    )
    expect(logCalls.length).toBe(1)
  })

  it('throws a typed CheckInPersonnelError (not a plain Error)', async () => {
    const mock = buildMockSupabase({
      incidents: err('PGRST116'),
    })
    setup(mock)

    try {
      await checkInPersonnel(ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, INCIDENT_ID, input)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(CheckInPersonnelError)
      expect((e as CheckInPersonnelError).name).toBe('CheckInPersonnelError')
    }
  })
})
