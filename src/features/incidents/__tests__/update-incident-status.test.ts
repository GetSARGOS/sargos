import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows } from './test-helpers'
import {
  updateIncidentStatus,
  UpdateIncidentStatusError,
} from '../logic/update-incident-status'
import type { UpdateIncidentStatusInput } from '../schemas'

const INCIDENT_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const USER_ID = 'user-uuid'
const MEMBER_ID = 'member-uuid'

describe('updateIncidentStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeMock(
    currentStatus: string,
    overrides: Record<string, unknown> = {},
  ) {
    return buildMockSupabase({
      incidents: [
        // First call: fetch incident
        ok({ id: INCIDENT_ID, status: currentStatus, name: 'Test Incident', organization_id: ORG_ID }),
        // Second call: update
        ok(null),
      ],
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incident_log: ok(null),
      audit_log: ok(null),
      ...overrides,
    })
  }

  it('suspends an active incident', async () => {
    const mock = makeMock('active')
    const input: UpdateIncidentStatusInput = { status: 'suspended' }

    const result = await updateIncidentStatus(
      mock as unknown as Parameters<typeof updateIncidentStatus>[0],
      INCIDENT_ID,
      ORG_ID,
      USER_ID,
      input,
    )

    expect(result.previousStatus).toBe('active')
    expect(result.newStatus).toBe('suspended')
    expect(result.incidentId).toBe(INCIDENT_ID)
  })

  it('resumes a suspended incident', async () => {
    const mock = makeMock('suspended')
    const input: UpdateIncidentStatusInput = { status: 'active' }

    const result = await updateIncidentStatus(
      mock as unknown as Parameters<typeof updateIncidentStatus>[0],
      INCIDENT_ID,
      ORG_ID,
      USER_ID,
      input,
    )

    expect(result.previousStatus).toBe('suspended')
    expect(result.newStatus).toBe('active')
  })

  it('closes an active incident with after-action notes', async () => {
    const mock = makeMock('active')
    const input: UpdateIncidentStatusInput = {
      status: 'closed',
      afterActionNotes: 'Subject found safe near trailhead.',
    }

    const result = await updateIncidentStatus(
      mock as unknown as Parameters<typeof updateIncidentStatus>[0],
      INCIDENT_ID,
      ORG_ID,
      USER_ID,
      input,
    )

    expect(result.previousStatus).toBe('active')
    expect(result.newStatus).toBe('closed')
  })

  it('closes a suspended incident', async () => {
    const mock = makeMock('suspended')
    const input: UpdateIncidentStatusInput = { status: 'closed' }

    const result = await updateIncidentStatus(
      mock as unknown as Parameters<typeof updateIncidentStatus>[0],
      INCIDENT_ID,
      ORG_ID,
      USER_ID,
      input,
    )

    expect(result.previousStatus).toBe('suspended')
    expect(result.newStatus).toBe('closed')
  })

  it('throws INCIDENT_NOT_FOUND when incident does not exist', async () => {
    const mock = buildMockSupabase({
      incidents: err('PGRST116', 'not found'),
    })

    try {
      await updateIncidentStatus(
        mock as unknown as Parameters<typeof updateIncidentStatus>[0],
        INCIDENT_ID,
        ORG_ID,
        USER_ID,
        { status: 'suspended' },
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdateIncidentStatusError)
      expect((e as UpdateIncidentStatusError).code).toBe('INCIDENT_NOT_FOUND')
    }
  })

  it('throws ALREADY_IN_STATUS when already in target status', async () => {
    const mock = makeMock('suspended')

    try {
      await updateIncidentStatus(
        mock as unknown as Parameters<typeof updateIncidentStatus>[0],
        INCIDENT_ID,
        ORG_ID,
        USER_ID,
        { status: 'suspended' },
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdateIncidentStatusError)
      expect((e as UpdateIncidentStatusError).code).toBe('ALREADY_IN_STATUS')
    }
  })

  it('throws INVALID_TRANSITION for closed → active', async () => {
    const mock = makeMock('closed')

    try {
      await updateIncidentStatus(
        mock as unknown as Parameters<typeof updateIncidentStatus>[0],
        INCIDENT_ID,
        ORG_ID,
        USER_ID,
        { status: 'active' },
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdateIncidentStatusError)
      expect((e as UpdateIncidentStatusError).code).toBe('INVALID_TRANSITION')
    }
  })

  it('throws INVALID_TRANSITION for planning → suspended', async () => {
    const mock = makeMock('planning')

    try {
      await updateIncidentStatus(
        mock as unknown as Parameters<typeof updateIncidentStatus>[0],
        INCIDENT_ID,
        ORG_ID,
        USER_ID,
        { status: 'suspended' },
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdateIncidentStatusError)
      expect((e as UpdateIncidentStatusError).code).toBe('INVALID_TRANSITION')
    }
  })

  // ─── Closure Checklist Tests ──────────────────────────────────────────────

  it('deactivates QR tokens, auto-checkouts personnel, and closes period on close', async () => {
    const mock = buildMockSupabase({
      incidents: [
        ok({ id: INCIDENT_ID, status: 'active', name: 'Test', organization_id: ORG_ID }),
        ok(null), // update status
      ],
      organization_members: ok({ id: MEMBER_ID, display_name: 'Jane IC' }),
      incident_qr_tokens: ok(null),
      incident_personnel: ok(null),
      operational_periods: ok(null),
      incident_log: ok(null),
      audit_log: ok(null),
    })

    await updateIncidentStatus(
      mock as unknown as Parameters<typeof updateIncidentStatus>[0],
      INCIDENT_ID, ORG_ID, USER_ID, { status: 'closed' },
    )

    const allCalls = mock.from.mock.calls.map((c: unknown[]) => c[0])
    expect(allCalls).toContain('incident_qr_tokens')
    expect(allCalls).toContain('incident_personnel')
    expect(allCalls).toContain('operational_periods')
  })

  it('does NOT run closure checklist on suspend', async () => {
    const mock = makeMock('active')

    await updateIncidentStatus(
      mock as unknown as Parameters<typeof updateIncidentStatus>[0],
      INCIDENT_ID, ORG_ID, USER_ID, { status: 'suspended' },
    )

    const allCalls = mock.from.mock.calls.map((c: unknown[]) => c[0])
    expect(allCalls).not.toContain('incident_qr_tokens')
    expect(allCalls).not.toContain('operational_periods')
  })

  it('writes to incident_log and audit_log', async () => {
    const mock = makeMock('active')

    await updateIncidentStatus(
      mock as unknown as Parameters<typeof updateIncidentStatus>[0],
      INCIDENT_ID,
      ORG_ID,
      USER_ID,
      { status: 'suspended' },
    )

    // incident_log should have been called
    const logCalls = mock.from.mock.calls.filter((c: string[]) => c[0] === 'incident_log')
    expect(logCalls.length).toBeGreaterThan(0)

    // audit_log should have been called
    const auditCalls = mock.from.mock.calls.filter((c: string[]) => c[0] === 'audit_log')
    expect(auditCalls.length).toBeGreaterThan(0)
  })
})
