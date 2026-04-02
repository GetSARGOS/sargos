import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deployResource, DeployResourceError } from '@/features/incidents/logic/deploy-resource'
import { buildMockSupabase, ok, err, noRows, withCount } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
const mockedCreate = vi.mocked(createServiceClient)

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid'
const INC_ID = 'inc-uuid'
const RESOURCE_ID = 'resource-uuid'
const INCIDENT_RESOURCE_ID = 'inc-resource-uuid'
const ACTOR_ID = 'actor-uuid'

const ACTIVE_INCIDENT = ok({ id: INC_ID, status: 'active' })
const AVAILABLE_RESOURCE = ok({ id: RESOURCE_ID, name: 'Radio #4', status: 'available' })
const NEW_INCIDENT_RESOURCE = ok({ id: INCIDENT_RESOURCE_ID })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('deployResource', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
  })

  const validInput = { resourceId: RESOURCE_ID }

  it('returns incidentResourceId on successful deployment', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        resources: AVAILABLE_RESOURCE,
        incident_resources: [
          withCount(0),              // Check: not already deployed
          NEW_INCIDENT_RESOURCE,     // INSERT: create deployment record
          { error: null },           // UPDATE: set status to 'deployed'
        ],
        incident_log: { error: null },
      }),
    )

    const result = await deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput)
    expect(result).toEqual({ incidentResourceId: INCIDENT_RESOURCE_ID })
  })

  it('throws INCIDENT_NOT_FOUND when incident does not exist', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: noRows() }),
    )

    await expect(
      deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND' })
  })

  it('throws INCIDENT_NOT_FOUND when incident query returns a db error', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: err('42P01') }),
    )

    await expect(
      deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND' })
  })

  it('throws INCIDENT_NOT_ACTIVE when incident is closed', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: ok({ id: INC_ID, status: 'closed' }) }),
    )

    await expect(
      deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'INCIDENT_NOT_ACTIVE' })
  })

  it('throws RESOURCE_NOT_FOUND when resource does not belong to this org', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        resources: noRows(),
      }),
    )

    await expect(
      deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('throws ALREADY_DEPLOYED when resource is already deployed to this incident', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        resources: AVAILABLE_RESOURCE,
        incident_resources: withCount(1),  // 1 existing deployment
      }),
    )

    await expect(
      deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'ALREADY_DEPLOYED' })
  })

  it('throws DB_ERROR when incident_resources insert fails', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        resources: AVAILABLE_RESOURCE,
        incident_resources: [
          withCount(0),
          err('23503'),  // INSERT fails
        ],
      }),
    )

    await expect(
      deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput),
    ).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws DeployResourceError (not a plain Error) for typed propagation', async () => {
    mockedCreate.mockReturnValue(buildMockSupabase({ incidents: noRows() }))

    let thrown: unknown
    try {
      await deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(DeployResourceError)
  })

  it('writes a resource_deployed incident log entry on success', async () => {
    const mockClient = buildMockSupabase({
      incidents: ACTIVE_INCIDENT,
      resources: AVAILABLE_RESOURCE,
      incident_resources: [
        withCount(0),
        NEW_INCIDENT_RESOURCE,
        { error: null },
      ],
      incident_log: { error: null },
    })
    mockedCreate.mockReturnValue(mockClient)

    await deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput)

    expect(mockClient.from).toHaveBeenCalledWith('incident_log')
  })

  it('updates the resource status to deployed on success', async () => {
    const mockClient = buildMockSupabase({
      incidents: ACTIVE_INCIDENT,
      resources: AVAILABLE_RESOURCE,
      incident_resources: [
        withCount(0),
        NEW_INCIDENT_RESOURCE,
        { error: null },
      ],
      incident_log: { error: null },
    })
    mockedCreate.mockReturnValue(mockClient)

    await deployResource(ORG_ID, INC_ID, ACTOR_ID, 'IC', validInput)

    // The function calls from('resources') twice: once for SELECT, once for UPDATE
    const resourceCalls = (mockClient.from as ReturnType<typeof vi.fn>).mock.calls
      .filter((args: unknown[]) => args[0] === 'resources')
    expect(resourceCalls).toHaveLength(2)
  })
})
