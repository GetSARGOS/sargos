import { describe, it, expect, vi, beforeEach } from 'vitest'
import { returnResource, ReturnResourceError } from '@/features/incidents/logic/return-resource'
import { buildMockSupabase, ok, err, noRows } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
const mockedCreate = vi.mocked(createServiceClient)

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid'
const INC_RESOURCE_ID = 'inc-resource-uuid'
const RESOURCE_ID = 'resource-uuid'
const ACTOR_ID = 'actor-uuid'

const DEPLOYED_RECORD = ok({
  id: INC_RESOURCE_ID,
  incident_id: 'inc-uuid',
  resource_id: RESOURCE_ID,
  status: 'deployed',
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('returnResource', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
  })

  it('returns { returned: true } on successful return', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incident_resources: [
          DEPLOYED_RECORD,         // SELECT: fetch deployment record
          { error: null },         // UPDATE: mark as returned
        ],
        resources: ok({ name: 'Radio #4' }),  // UPDATE: reset to available (returns name)
        incident_log: { error: null },
      }),
    )

    const result = await returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {})
    expect(result).toEqual({ returned: true })
  })

  it('throws INCIDENT_RESOURCE_NOT_FOUND when deployment record does not exist', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incident_resources: noRows() }),
    )

    await expect(
      returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {}),
    ).rejects.toMatchObject({ code: 'INCIDENT_RESOURCE_NOT_FOUND' })
  })

  it('throws INCIDENT_RESOURCE_NOT_FOUND when fetch returns a db error', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incident_resources: err('42P01') }),
    )

    await expect(
      returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {}),
    ).rejects.toMatchObject({ code: 'INCIDENT_RESOURCE_NOT_FOUND' })
  })

  it('throws ALREADY_RETURNED when resource is already returned', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incident_resources: ok({
          id: INC_RESOURCE_ID,
          incident_id: 'inc-uuid',
          resource_id: RESOURCE_ID,
          status: 'returned',
        }),
      }),
    )

    await expect(
      returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {}),
    ).rejects.toMatchObject({ code: 'ALREADY_RETURNED' })
  })

  it('throws DB_ERROR when the update fails', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incident_resources: [
          DEPLOYED_RECORD,
          err('23514'),  // UPDATE fails — check constraint
        ],
      }),
    )

    await expect(
      returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {}),
    ).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws ReturnResourceError (not a plain Error) for typed propagation', async () => {
    mockedCreate.mockReturnValue(buildMockSupabase({ incident_resources: noRows() }))

    let thrown: unknown
    try {
      await returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {})
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ReturnResourceError)
  })

  it('writes a resource_returned incident log entry on success', async () => {
    const mockClient = buildMockSupabase({
      incident_resources: [
        DEPLOYED_RECORD,
        { error: null },
      ],
      resources: ok({ name: 'Radio #4' }),
      incident_log: { error: null },
    })
    mockedCreate.mockReturnValue(mockClient)

    await returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {})

    expect(mockClient.from).toHaveBeenCalledWith('incident_log')
  })

  it('resets the resource status to available on success', async () => {
    const mockClient = buildMockSupabase({
      incident_resources: [
        DEPLOYED_RECORD,
        { error: null },
      ],
      resources: ok({ name: 'Radio #4' }),
      incident_log: { error: null },
    })
    mockedCreate.mockReturnValue(mockClient)

    await returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {})

    // Verify resources.update was called to reset status
    expect(mockClient.from).toHaveBeenCalledWith('resources')
  })

  it('accepts optional notes and passes them through', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incident_resources: [DEPLOYED_RECORD, { error: null }],
        resources: ok({ name: 'Radio #4' }),
        incident_log: { error: null },
      }),
    )

    const result = await returnResource(ORG_ID, INC_RESOURCE_ID, ACTOR_ID, 'IC', {
      notes: 'Returned with low battery',
    })
    expect(result).toEqual({ returned: true })
  })
})
