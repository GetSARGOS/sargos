import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows, type MockSupabaseClient } from './test-helpers'
import { handOffIc, HandOffIcError } from '../logic/hand-off-ic'
import type { HandOffIcInput } from '../schemas'

vi.mock('@/lib/retry', () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}))

const INC_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const OLD_IC_MEMBER_ID = 'old-ic-member'
const OLD_IC_NAME = 'Jane IC'
const USER_ID = 'user-uuid'
const NEW_IC_MEMBER_ID = 'new-ic-member'
const NEW_CMD_ID = 'new-cmd-uuid'

const validInput: HandOffIcInput = {
  newIcMemberId: NEW_IC_MEMBER_ID,
  outgoingIcNewRole: 'field_member',
}

describe('handOffIc', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hands off IC and returns new command structure ID', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_command_structure: [
        ok({ id: 'old-cmd', member_id: OLD_IC_MEMBER_ID }), // current IC
        ok(null),                 // relieve old IC
        ok([]),                   // new IC holds no other active roles
        ok({ id: NEW_CMD_ID }),   // insert new IC
      ],
      incident_personnel: [
        ok({ id: 'p-new', member_id: NEW_IC_MEMBER_ID }), // new IC personnel check
        ok(null), // update new IC personnel role
        ok(null), // update old IC personnel role
      ],
      organization_members: ok({ display_name: 'Bob NewIC' }),
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await handOffIc(
      mock as unknown as Parameters<typeof handOffIc>[0],
      INC_ID, ORG_ID, OLD_IC_MEMBER_ID, OLD_IC_NAME, USER_ID, validInput,
    )

    expect(result.newIcCommandStructureId).toBe(NEW_CMD_ID)
  })

  it('relieves the new IC\'s previous command role when promoting them', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_command_structure: [
        ok({ id: 'old-cmd', member_id: OLD_IC_MEMBER_ID }),    // current IC
        ok(null),                                              // relieve old IC
        ok([{ id: 'prev-ops-cmd' }]),                          // new IC currently holds Ops
        ok(null),                                              // relieve previous Ops row
        ok({ id: NEW_CMD_ID }),                                // insert new IC
      ],
      incident_personnel: [
        ok({ id: 'p-new', member_id: NEW_IC_MEMBER_ID }),
        ok(null),
        ok(null),
      ],
      organization_members: ok({ display_name: 'Bob NewIC' }),
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await handOffIc(
      mock as unknown as Parameters<typeof handOffIc>[0],
      INC_ID, ORG_ID, OLD_IC_MEMBER_ID, OLD_IC_NAME, USER_ID, validInput,
    )

    expect(result.newIcCommandStructureId).toBe(NEW_CMD_ID)

    // Verify the "relieve other roles" path ran: 5 command_structure calls total
    const cmdCalls = mock.from.mock.calls.filter((c: unknown[]) => c[0] === 'incident_command_structure')
    expect(cmdCalls.length).toBe(5)
  })

  it('throws NOT_CURRENT_IC when actor is not the IC', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_command_structure: noRows(), // actor is not the IC
    })

    try {
      await handOffIc(
        mock as unknown as Parameters<typeof handOffIc>[0],
        INC_ID, ORG_ID, OLD_IC_MEMBER_ID, OLD_IC_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(HandOffIcError)
      expect((e as HandOffIcError).code).toBe('NOT_CURRENT_IC')
    }
  })

  it('throws NEW_IC_NOT_CHECKED_IN when new IC not on incident', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_command_structure: ok({ id: 'old-cmd', member_id: OLD_IC_MEMBER_ID }),
      incident_personnel: noRows(), // new IC not checked in
    })

    try {
      await handOffIc(
        mock as unknown as Parameters<typeof handOffIc>[0],
        INC_ID, ORG_ID, OLD_IC_MEMBER_ID, OLD_IC_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(HandOffIcError)
      expect((e as HandOffIcError).code).toBe('NEW_IC_NOT_CHECKED_IN')
    }
  })

  it('handles stood_down by setting both role and status', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_command_structure: [
        ok({ id: 'old-cmd', member_id: OLD_IC_MEMBER_ID }),
        ok(null),
        ok([]),                  // new IC holds no other active roles
        ok({ id: NEW_CMD_ID }),
      ],
      incident_personnel: [
        ok({ id: 'p-new', member_id: NEW_IC_MEMBER_ID }),
        ok(null), // new IC update
        ok(null), // old IC update
      ],
      organization_members: ok({ display_name: 'Bob NewIC' }),
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await handOffIc(
      mock as unknown as Parameters<typeof handOffIc>[0],
      INC_ID, ORG_ID, OLD_IC_MEMBER_ID, OLD_IC_NAME, USER_ID,
      { newIcMemberId: NEW_IC_MEMBER_ID, outgoingIcNewRole: 'stood_down' },
    )

    expect(result.newIcCommandStructureId).toBe(NEW_CMD_ID)
  })

  it('writes to incident_log and audit_log', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_command_structure: [
        ok({ id: 'old-cmd', member_id: OLD_IC_MEMBER_ID }),
        ok(null),
        ok([]),                  // new IC holds no other active roles
        ok({ id: NEW_CMD_ID }),
      ],
      incident_personnel: [
        ok({ id: 'p-new', member_id: NEW_IC_MEMBER_ID }),
        ok(null),
        ok(null),
      ],
      organization_members: ok({ display_name: 'Bob NewIC' }),
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    await handOffIc(
      mock as unknown as Parameters<typeof handOffIc>[0],
      INC_ID, ORG_ID, OLD_IC_MEMBER_ID, OLD_IC_NAME, USER_ID, validInput,
    )

    const calls = mock.from.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('incident_log')
    expect(calls).toContain('audit_log')
  })
})
