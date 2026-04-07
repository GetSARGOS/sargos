import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows, withCount, type MockSupabaseClient } from './test-helpers'
import { createSubject, CreateSubjectError } from '../logic/create-subject'
import type { CreateSubjectInput } from '../schemas'

vi.mock('@/lib/retry', () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}))

const INC_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const MEMBER_ID = 'member-uuid'
const USER_ID = 'user-uuid'
const ACTOR_NAME = 'Jane IC'
const SUBJECT_ID = 'subj-uuid'

const validInput: CreateSubjectInput = {
  firstName: 'John',
  lastName: 'Doe',
  age: 45,
  gender: 'male',
  subjectType: 'hiker',
}

describe('createSubject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a subject and returns subjectId', async () => {
    const mock = buildMockSupabase({
      // 1) incident fetch
      incidents: ok({ id: INC_ID, status: 'active' }),
      // 2) count existing subjects, 3) clear primaries, 4) insert subject
      incident_subjects: [
        withCount(0),
        ok(null),               // clear primaries (auto-primary triggers)
        ok({ id: SUBJECT_ID }), // insert
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await createSubject(
      mock as unknown as Parameters<typeof createSubject>[0],
      INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    expect(result.subjectId).toBe(SUBJECT_ID)
  })

  it('auto-sets is_primary when first subject', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_subjects: [
        withCount(0),      // count returns 0 → auto-primary
        ok(null),          // clear other primaries (no-op since first)
        ok({ id: SUBJECT_ID }), // insert
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await createSubject(
      mock as unknown as Parameters<typeof createSubject>[0],
      INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID,
      { ...validInput, isPrimary: undefined },
    )

    expect(result.subjectId).toBe(SUBJECT_ID)
  })

  it('clears other primaries when isPrimary is true', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_subjects: [
        ok(null),          // clear other primaries
        ok({ id: SUBJECT_ID }), // insert
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await createSubject(
      mock as unknown as Parameters<typeof createSubject>[0],
      INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID,
      { ...validInput, isPrimary: true },
    )

    expect(result.subjectId).toBe(SUBJECT_ID)
  })

  it('throws INCIDENT_NOT_FOUND when incident missing', async () => {
    const mock = buildMockSupabase({
      incidents: noRows(),
    })

    await expect(
      createSubject(
        mock as unknown as Parameters<typeof createSubject>[0],
        INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      ),
    ).rejects.toThrow(CreateSubjectError)

    try {
      await createSubject(
        mock as unknown as Parameters<typeof createSubject>[0],
        INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
    } catch (e) {
      expect((e as CreateSubjectError).code).toBe('INCIDENT_NOT_FOUND')
    }
  })

  it('throws CREATE_FAILED when insert fails', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_subjects: [
        withCount(1),           // count existing
        err('23505', 'duplicate'),  // insert fails
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    try {
      await createSubject(
        mock as unknown as Parameters<typeof createSubject>[0],
        INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(CreateSubjectError)
      expect((e as CreateSubjectError).code).toBe('CREATE_FAILED')
    }
  })

  it('writes to incident_log and audit_log', async () => {
    const mock = buildMockSupabase({
      incidents: ok({ id: INC_ID, status: 'active' }),
      incident_subjects: [withCount(0), ok(null), ok({ id: SUBJECT_ID })],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    await createSubject(
      mock as unknown as Parameters<typeof createSubject>[0],
      INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    // Verify from() was called with incident_log and audit_log
    const calls = mock.from.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('incident_log')
    expect(calls).toContain('audit_log')
  })
})
