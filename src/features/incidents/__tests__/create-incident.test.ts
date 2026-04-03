import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import {
  createIncident,
  CreateIncidentError,
} from '../logic/create-incident'
import type { CreateIncidentInput } from '../schemas'

const ORG_ID = 'org-uuid'
const USER_ID = 'user-uuid'
const MEMBER_ID = 'member-uuid'
const INCIDENT_ID = 'inc-uuid'

function setup(mock: ReturnType<typeof buildMockSupabase>) {
  vi.mocked(createServiceClient).mockReturnValue(mock)
}

const validInput: CreateIncidentInput = {
  name: 'Lost hiker — Mt. Hood',
  incidentType: 'lost_person',
}

describe('createIncident', () => {
  beforeEach(() => vi.clearAllMocks())

  it('successfully creates an incident', async () => {
    const mock = buildMockSupabase({
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incidents: ok({ id: INCIDENT_ID }),
      incident_command_structure: ok(null),
      incident_personnel: ok(null),
      incident_log: ok(null),
      audit_log: ok(null),
    })
    setup(mock)

    const result = await createIncident(ORG_ID, USER_ID, validInput)

    expect(result.incidentId).toBe(INCIDENT_ID)
  })

  it('throws MEMBER_NOT_FOUND when creator is not an active member', async () => {
    const mock = buildMockSupabase({
      organization_members: err('PGRST116'),
    })
    setup(mock)

    await expect(
      createIncident(ORG_ID, USER_ID, validInput),
    ).rejects.toThrow(CreateIncidentError)

    try {
      await createIncident(ORG_ID, USER_ID, validInput)
    } catch (e) {
      expect((e as CreateIncidentError).code).toBe('MEMBER_NOT_FOUND')
    }
  })

  it('throws CREATE_FAILED when incident insert fails', async () => {
    const mock = buildMockSupabase({
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incidents: err('23505'),
    })
    setup(mock)

    await expect(
      createIncident(ORG_ID, USER_ID, validInput),
    ).rejects.toThrow(CreateIncidentError)

    try {
      await createIncident(ORG_ID, USER_ID, validInput)
    } catch (e) {
      expect((e as CreateIncidentError).code).toBe('CREATE_FAILED')
    }
  })

  it('continues when command structure insert fails (best-effort)', async () => {
    const mock = buildMockSupabase({
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incidents: ok({ id: INCIDENT_ID }),
      incident_command_structure: err('23503'),
      incident_personnel: ok(null),
      incident_log: ok(null),
      audit_log: ok(null),
    })
    setup(mock)

    const result = await createIncident(ORG_ID, USER_ID, validInput)
    expect(result.incidentId).toBe(INCIDENT_ID)
  })

  it('continues when personnel insert fails (best-effort)', async () => {
    const mock = buildMockSupabase({
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incidents: ok({ id: INCIDENT_ID }),
      incident_command_structure: ok(null),
      incident_personnel: err('23503'),
      incident_log: ok(null),
      audit_log: ok(null),
    })
    setup(mock)

    const result = await createIncident(ORG_ID, USER_ID, validInput)
    expect(result.incidentId).toBe(INCIDENT_ID)
  })

  it('writes to incident_log and audit_log on success', async () => {
    const mock = buildMockSupabase({
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incidents: ok({ id: INCIDENT_ID }),
      incident_command_structure: ok(null),
      incident_personnel: ok(null),
      incident_log: ok(null),
      audit_log: ok(null),
    })
    setup(mock)

    await createIncident(ORG_ID, USER_ID, validInput)

    const logCalls = mock.from.mock.calls.filter(
      (c: string[]) => c[0] === 'incident_log',
    )
    const auditCalls = mock.from.mock.calls.filter(
      (c: string[]) => c[0] === 'audit_log',
    )
    expect(logCalls.length).toBe(1)
    // 2 audit entries: incident.created + incident.role_assigned (IC assignment)
    expect(auditCalls.length).toBe(2)
  })

  it('passes optional locationAddress and startedAt', async () => {
    const mock = buildMockSupabase({
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incidents: ok({ id: INCIDENT_ID }),
      incident_command_structure: ok(null),
      incident_personnel: ok(null),
      incident_log: ok(null),
      audit_log: ok(null),
    })
    setup(mock)

    const inputWithOptionals: CreateIncidentInput = {
      ...validInput,
      locationAddress: 'Timberline Lodge',
      startedAt: '2026-04-01T10:00:00Z',
    }

    const result = await createIncident(ORG_ID, USER_ID, inputWithOptionals)
    expect(result.incidentId).toBe(INCIDENT_ID)
  })

  it('throws a typed CreateIncidentError (not a plain Error)', async () => {
    const mock = buildMockSupabase({
      organization_members: err('PGRST116'),
    })
    setup(mock)

    try {
      await createIncident(ORG_ID, USER_ID, validInput)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(CreateIncidentError)
      expect((e as CreateIncidentError).name).toBe('CreateIncidentError')
    }
  })
})
