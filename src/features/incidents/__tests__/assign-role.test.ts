import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows, type MockSupabaseClient } from './test-helpers'
import { assignRole, AssignRoleError } from '../logic/assign-role'
import type { AssignRoleInput } from '../schemas'

vi.mock('@/lib/retry', () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}))

const INC_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const ACTOR_MEMBER_ID = 'actor-member-uuid'
const ACTOR_NAME = 'Jane IC'
const USER_ID = 'user-uuid'
const TARGET_MEMBER_ID = 'target-member-uuid'
const CMD_ID = 'cmd-uuid'

const validInput: AssignRoleInput = {
  memberId: TARGET_MEMBER_ID,
  icsRole: 'operations_section_chief',
}

describe('assignRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assigns a role and returns commandStructureId', async () => {
    const mock = buildMockSupabase({
      // 1) incident, 2) target personnel, 3) target member name
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_personnel: [
        ok({ id: 'p1', member_id: TARGET_MEMBER_ID, incident_role: 'field_member' }),
        ok(null), // update personnel role
      ],
      organization_members: ok({ display_name: 'Bob Ops' }),
      incident_command_structure: [
        noRows(),           // check current holder of role (none)
        ok([]),             // check other roles member holds (none)
        ok({ id: CMD_ID }), // insert
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await assignRole(
      mock as unknown as Parameters<typeof assignRole>[0],
      INC_ID, ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    expect(result.commandStructureId).toBe(CMD_ID)
  })

  it('relieves current holder when reassigning role to different member', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_personnel: [
        ok({ id: 'p1', member_id: TARGET_MEMBER_ID, incident_role: 'field_member' }),
        ok(null), // demote previous holder
        ok(null), // update new holder role
      ],
      organization_members: ok({ display_name: 'Bob Ops' }),
      incident_command_structure: [
        ok({ id: 'old-cmd', member_id: 'other-member' }), // current holder exists
        ok(null),           // relieve old holder
        ok([]),             // target member holds no other roles
        ok({ id: CMD_ID }), // insert new
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await assignRole(
      mock as unknown as Parameters<typeof assignRole>[0],
      INC_ID, ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    expect(result.commandStructureId).toBe(CMD_ID)
  })

  it('relieves previous role when reassigning the same member to a different role', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_personnel: [
        ok({ id: 'p1', member_id: TARGET_MEMBER_ID, incident_role: 'planning_section_chief' }),
        ok(null), // update personnel role to new ics role
      ],
      organization_members: ok({ display_name: 'Bob Ops' }),
      incident_command_structure: [
        noRows(),                                  // no current holder of new role
        ok([{ id: 'prev-cmd' }]),                  // member already holds another role
        ok(null),                                  // relieve other active role(s)
        ok({ id: CMD_ID }),                        // insert new
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await assignRole(
      mock as unknown as Parameters<typeof assignRole>[0],
      INC_ID, ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    expect(result.commandStructureId).toBe(CMD_ID)

    // Verify the "other roles" relieve path ran: 4 command_structure calls total
    const cmdCalls = mock.from.mock.calls.filter((c: unknown[]) => c[0] === 'incident_command_structure')
    expect(cmdCalls.length).toBe(4)
  })

  it('throws INCIDENT_NOT_FOUND when incident missing', async () => {
    const mock = buildMockSupabase({
      incidents: noRows(),
    })

    try {
      await assignRole(
        mock as unknown as Parameters<typeof assignRole>[0],
        INC_ID, ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AssignRoleError)
      expect((e as AssignRoleError).code).toBe('INCIDENT_NOT_FOUND')
    }
  })

  it('throws MEMBER_NOT_CHECKED_IN when target not on incident', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_personnel: noRows(),
    })

    try {
      await assignRole(
        mock as unknown as Parameters<typeof assignRole>[0],
        INC_ID, ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AssignRoleError)
      expect((e as AssignRoleError).code).toBe('MEMBER_NOT_CHECKED_IN')
    }
  })

  it('writes to incident_log and audit_log', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_personnel: [
        ok({ id: 'p1', member_id: TARGET_MEMBER_ID, incident_role: 'field_member' }),
        ok(null),
      ],
      organization_members: ok({ display_name: 'Bob Ops' }),
      incident_command_structure: [
        noRows(),           // no current holder
        ok([]),             // no other roles for member
        ok({ id: CMD_ID }), // insert
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    await assignRole(
      mock as unknown as Parameters<typeof assignRole>[0],
      INC_ID, ORG_ID, ACTOR_MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    const calls = mock.from.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('incident_log')
    expect(calls).toContain('audit_log')
  })
})
