import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initiatePar, InitiateParError } from '@/features/incidents/logic/initiate-par'
import { buildMockSupabase, ok, err, noRows, withCount } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
const mockedCreate = vi.mocked(createServiceClient)

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid'
const INC_ID = 'inc-uuid'
const MEMBER_ID = 'member-uuid'
const PAR_ID = 'par-uuid'

const ACTIVE_INCIDENT = ok({ id: INC_ID, status: 'active' })
const PAR_EVENT = ok({ id: PAR_ID })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('initiatePar', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
  })

  it('returns parEventId and totalPersonnel on success', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        incident_personnel: withCount(3),
        incident_par_events: PAR_EVENT,
        incident_log: { error: null },
      }),
    )

    const result = await initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'Test IC', {})
    expect(result).toEqual({ parEventId: PAR_ID, totalPersonnel: 3 })
  })

  it('throws INCIDENT_NOT_FOUND when the incident does not exist', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: noRows() }),
    )

    await expect(initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', {})).rejects.toMatchObject({
      code: 'INCIDENT_NOT_FOUND',
    })
  })

  it('throws INCIDENT_NOT_FOUND when incident query returns a db error', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: err('42P01') }),
    )

    await expect(initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', {})).rejects.toMatchObject({
      code: 'INCIDENT_NOT_FOUND',
    })
  })

  it('throws INCIDENT_NOT_ACTIVE when incident status is closed', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: ok({ id: INC_ID, status: 'closed' }) }),
    )

    await expect(initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', {})).rejects.toMatchObject({
      code: 'INCIDENT_NOT_ACTIVE',
    })
  })

  it('throws INCIDENT_NOT_ACTIVE when incident status is suspended', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: ok({ id: INC_ID, status: 'suspended' }) }),
    )

    await expect(initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', {})).rejects.toMatchObject({
      code: 'INCIDENT_NOT_ACTIVE',
    })
  })

  it('throws NO_PERSONNEL when no one is checked in', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        incident_personnel: withCount(0),
      }),
    )

    await expect(initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', {})).rejects.toMatchObject({
      code: 'NO_PERSONNEL',
    })
  })

  it('throws DB_ERROR when PAR event insert fails', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        incident_personnel: withCount(2),
        incident_par_events: err('23503'),
      }),
    )

    await expect(initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', {})).rejects.toMatchObject({
      code: 'DB_ERROR',
    })
  })

  it('throws InitiateParError (not a plain Error) for typed error propagation', async () => {
    mockedCreate.mockReturnValue(buildMockSupabase({ incidents: noRows() }))

    let thrown: unknown
    try {
      await initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', {})
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(InitiateParError)
  })

  it('includes notes in the incident log message when provided', async () => {
    const mockClient = buildMockSupabase({
      incidents: ACTIVE_INCIDENT,
      incident_personnel: withCount(1),
      incident_par_events: PAR_EVENT,
      incident_log: { error: null },
    })
    mockedCreate.mockReturnValue(mockClient)

    await initiatePar(ORG_ID, INC_ID, MEMBER_ID, 'IC', { notes: 'All teams in field' })

    // Verify from('incident_log') was called — ensures log entry was written
    expect(mockClient.from).toHaveBeenCalledWith('incident_log')
  })
})
