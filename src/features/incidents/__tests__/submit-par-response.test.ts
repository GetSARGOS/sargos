import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitParResponse, SubmitParResponseError } from '@/features/incidents/logic/submit-par-response'
import { buildMockSupabase, ok, err, noRows, withCount } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
const mockedCreate = vi.mocked(createServiceClient)

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid'
const INC_ID = 'inc-uuid'
const PAR_ID = 'par-uuid'
const PERSONNEL_ID = 'personnel-uuid'
const ACTOR_ID = 'actor-uuid'

const OPEN_PAR_EVENT = ok({
  id: PAR_ID,
  total_personnel: 2,
  confirmed_count: 0,
  completed_at: null,
})
const ACTIVE_PERSONNEL = ok({ id: PERSONNEL_ID })

// Build a mock that returns valid responses for all calls in submit-par-response.ts.
// Call sequence: parEvent, personnel, upsert, personnel update, response count, live count, par_event update.
function buildHappyPathMock(overrides: {
  responseCount?: number
  liveCount?: number
} = {}) {
  const responseCount = overrides.responseCount ?? 1
  const liveCount = overrides.liveCount ?? 2

  return buildMockSupabase({
    incident_par_events: [
      OPEN_PAR_EVENT,               // SELECT — verify event exists
      { error: null },              // UPDATE — write confirmed_count
    ],
    incident_personnel: [
      ACTIVE_PERSONNEL,             // SELECT — verify personnel exists
      { error: null },              // UPDATE — set last_checked_in_at
      withCount(liveCount),         // SELECT count — live personnel count
    ],
    incident_par_responses: [
      { error: null },              // UPSERT — record response
      withCount(responseCount),     // SELECT count — confirmed responses
    ],
    incident_log: { error: null },
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitParResponse', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
  })

  const validInput = { personnelId: PERSONNEL_ID, confirmedSafe: true }

  it('returns responded: true, parCompleted: false when others still outstanding', async () => {
    // 1 response, 2 total → not complete
    mockedCreate.mockReturnValue(buildHappyPathMock({ responseCount: 1, liveCount: 2 }))

    const result = await submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput)
    expect(result).toEqual({ responded: true, parCompleted: false })
  })

  it('returns responded: true, parCompleted: true when all personnel have responded', async () => {
    // 2 responses, 2 total → complete
    mockedCreate.mockReturnValue(buildHappyPathMock({ responseCount: 2, liveCount: 2 }))

    const result = await submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput)
    expect(result).toEqual({ responded: true, parCompleted: true })
  })

  it('throws PAR_EVENT_NOT_FOUND when event does not exist', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incident_par_events: noRows() }),
    )

    await expect(
      submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'PAR_EVENT_NOT_FOUND' })
  })

  it('throws PAR_EVENT_NOT_FOUND when event query returns a db error', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incident_par_events: err('42P01') }),
    )

    await expect(
      submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'PAR_EVENT_NOT_FOUND' })
  })

  it('throws PAR_ALREADY_COMPLETED when completed_at is set', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incident_par_events: ok({
          id: PAR_ID,
          total_personnel: 2,
          confirmed_count: 2,
          completed_at: new Date().toISOString(),
        }),
      }),
    )

    await expect(
      submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'PAR_ALREADY_COMPLETED' })
  })

  it('throws PERSONNEL_NOT_FOUND when personnel record does not exist', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incident_par_events: OPEN_PAR_EVENT,
        incident_personnel: noRows(),
      }),
    )

    await expect(
      submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'PERSONNEL_NOT_FOUND' })
  })

  it('throws DB_ERROR when upsert fails', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incident_par_events: OPEN_PAR_EVENT,
        incident_personnel: ACTIVE_PERSONNEL,
        incident_par_responses: err('23503'),
      }),
    )

    await expect(
      submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws SubmitParResponseError (not a plain Error) for typed propagation', async () => {
    mockedCreate.mockReturnValue(buildMockSupabase({ incident_par_events: noRows() }))

    let thrown: unknown
    try {
      await submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(SubmitParResponseError)
  })

  it('writes a par_completed incident log entry when PAR completes', async () => {
    const mockClient = buildHappyPathMock({ responseCount: 2, liveCount: 2 })
    mockedCreate.mockReturnValue(mockClient)

    await submitParResponse(ORG_ID, INC_ID, PAR_ID, ACTOR_ID, 'IC', validInput)

    expect(mockClient.from).toHaveBeenCalledWith('incident_log')
  })
})
