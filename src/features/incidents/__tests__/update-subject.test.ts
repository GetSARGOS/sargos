import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, noRows, type MockSupabaseClient } from './test-helpers'
import { updateSubject, UpdateSubjectError } from '../logic/update-subject'
import type { UpdateSubjectInput } from '../schemas'

vi.mock('@/lib/retry', () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}))

const SUBJECT_ID = 'subj-uuid'
const INC_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const MEMBER_ID = 'member-uuid'
const USER_ID = 'user-uuid'
const ACTOR_NAME = 'Jane IC'

const validInput: UpdateSubjectInput = {
  firstName: 'John',
  age: 46,
}

describe('updateSubject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates subject fields and returns subjectId', async () => {
    const mock = buildMockSupabase({
      // 1) fetch existing, 2) update, 3) incident_log, 4) audit_log
      incident_subjects: [
        ok({ id: SUBJECT_ID, first_name: 'John', last_name: 'Doe', is_primary: false }),
        ok(null), // update
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await updateSubject(
      mock as unknown as Parameters<typeof updateSubject>[0],
      SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
    )

    expect(result.subjectId).toBe(SUBJECT_ID)
  })

  it('throws SUBJECT_NOT_FOUND when subject missing', async () => {
    const mock = buildMockSupabase({
      incident_subjects: noRows(),
    })

    try {
      await updateSubject(
        mock as unknown as Parameters<typeof updateSubject>[0],
        SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdateSubjectError)
      expect((e as UpdateSubjectError).code).toBe('SUBJECT_NOT_FOUND')
    }
  })

  it('throws UPDATE_FAILED when update fails', async () => {
    const mock = buildMockSupabase({
      incident_subjects: [
        ok({ id: SUBJECT_ID, first_name: 'John', last_name: 'Doe', is_primary: false }),
        err('42P01', 'table error'), // update fails
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    try {
      await updateSubject(
        mock as unknown as Parameters<typeof updateSubject>[0],
        SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID, validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(UpdateSubjectError)
      expect((e as UpdateSubjectError).code).toBe('UPDATE_FAILED')
    }
  })

  it('clears other primaries when promoting to primary', async () => {
    const mock = buildMockSupabase({
      incident_subjects: [
        ok({ id: SUBJECT_ID, first_name: 'John', last_name: 'Doe', is_primary: false }),
        ok(null), // clear other primaries
        ok(null), // update
      ],
      incident_log: ok({ id: 'log-1' }),
      audit_log: ok({ id: 'audit-1' }),
    })

    const result = await updateSubject(
      mock as unknown as Parameters<typeof updateSubject>[0],
      SUBJECT_ID, INC_ID, ORG_ID, MEMBER_ID, ACTOR_NAME, USER_ID,
      { isPrimary: true },
    )

    expect(result.subjectId).toBe(SUBJECT_ID)
    // incident_subjects called 3 times: fetch, clear primaries, update
    const calls = mock.from.mock.calls.filter((c: unknown[]) => c[0] === 'incident_subjects')
    expect(calls.length).toBe(3)
  })
})
