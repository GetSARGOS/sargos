import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows, type MockSupabaseClient } from './test-helpers'
import { deleteSubject, DeleteSubjectError } from '../logic/delete-subject'

vi.mock('@/lib/retry', () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}))

const SUBJECT_ID = 'subj-uuid'
const INC_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const MEMBER_ID = 'member-uuid'
const USER_ID = 'user-uuid'
const ACTOR_NAME = 'Jane IC'

describe('deleteSubject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes subject and returns deleted: true', async () => {
    const mock = buildMockSupabase({
      // 1) fetch existing, 2) soft-delete update, 3) incident_log, 4) audit_log
      incident_subjects: [
        ok({ id: SUBJECT_ID, first_name: 'John', last_name: 'Doe', is_primary: false }),
        ok(null), // soft-delete
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await deleteSubject(
      mock as unknown as Parameters<typeof deleteSubject>[0],
      SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID,
    )

    expect(result.deleted).toBe(true)
  })

  it('throws SUBJECT_NOT_FOUND when subject missing', async () => {
    const mock = buildMockSupabase({
      incident_subjects: noRows(),
    })

    try {
      await deleteSubject(
        mock as unknown as Parameters<typeof deleteSubject>[0],
        SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(DeleteSubjectError)
      expect((e as DeleteSubjectError).code).toBe('SUBJECT_NOT_FOUND')
    }
  })

  it('reassigns primary to next subject when deleting primary', async () => {
    const mock = buildMockSupabase({
      incident_subjects: [
        ok({ id: SUBJECT_ID, first_name: 'John', last_name: 'Doe', is_primary: true }),
        ok(null),                   // soft-delete
        ok({ id: 'next-subj-id' }), // find next subject
        ok(null),                   // promote next
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await deleteSubject(
      mock as unknown as Parameters<typeof deleteSubject>[0],
      SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID,
    )

    expect(result.deleted).toBe(true)
    // incident_subjects called 4 times: fetch, delete, find next, promote
    const calls = mock.from.mock.calls.filter((c: unknown[]) => c[0] === 'incident_subjects')
    expect(calls.length).toBe(4)
  })

  it('writes to incident_log and audit_log', async () => {
    const mock = buildMockSupabase({
      incident_subjects: [
        ok({ id: SUBJECT_ID, first_name: 'John', last_name: 'Doe', is_primary: false }),
        ok(null),
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    await deleteSubject(
      mock as unknown as Parameters<typeof deleteSubject>[0],
      SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID,
    )

    const calls = mock.from.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('incident_log')
    expect(calls).toContain('audit_log')
  })
})
