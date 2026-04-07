import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMockSupabase, ok, err, type MockSupabaseClient } from './test-helpers'
import { addLogEntry, AddLogEntryError } from '../logic/add-log-entry'
import type { AddLogEntryInput } from '../schemas'

const INCIDENT_ID = 'inc-uuid'
const ORG_ID = 'org-uuid'
const MEMBER_ID = 'member-uuid'
const ACTOR_NAME = 'Jane IC'
const ENTRY_ID = 'entry-uuid'

const validInput: AddLogEntryInput = {
  message: 'Search teams deployed to sectors 1-3',
}

describe('addLogEntry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a narrative log entry and returns it', async () => {
    const returnedEntry = {
      id: ENTRY_ID,
      incident_id: INCIDENT_ID,
      entry_type: 'narrative',
      message: validInput.message,
      actor_id: MEMBER_ID,
      actor_name: ACTOR_NAME,
      created_at: '2026-04-05T10:00:00Z',
      metadata: {},
    }

    const mock = buildMockSupabase({
      incident_log: ok(returnedEntry),
    })

    const result = await addLogEntry(
      mock as unknown as Parameters<typeof addLogEntry>[0],
      INCIDENT_ID,
      ORG_ID,
      MEMBER_ID,
      ACTOR_NAME,
      validInput,
    )

    expect(result.id).toBe(ENTRY_ID)
    expect(result.entry_type).toBe('narrative')
    expect(result.message).toBe(validInput.message)
    expect(result.actor_name).toBe(ACTOR_NAME)
  })

  it('calls supabase.from("incident_log").insert with correct fields', async () => {
    const mock = buildMockSupabase({
      incident_log: ok({
        id: ENTRY_ID,
        incident_id: INCIDENT_ID,
        entry_type: 'narrative',
        message: validInput.message,
        actor_id: MEMBER_ID,
        actor_name: ACTOR_NAME,
        created_at: '2026-04-05T10:00:00Z',
        metadata: {},
      }),
    })

    await addLogEntry(
      mock as unknown as Parameters<typeof addLogEntry>[0],
      INCIDENT_ID,
      ORG_ID,
      MEMBER_ID,
      ACTOR_NAME,
      validInput,
    )

    expect(mock.from).toHaveBeenCalledWith('incident_log')
  })

  it('throws INSERT_FAILED when insert returns an error', async () => {
    const mock = buildMockSupabase({
      incident_log: err('23505', 'duplicate key'),
    })

    try {
      await addLogEntry(
        mock as unknown as Parameters<typeof addLogEntry>[0],
        INCIDENT_ID,
        ORG_ID,
        MEMBER_ID,
        ACTOR_NAME,
        validInput,
      )
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AddLogEntryError)
      expect((e as AddLogEntryError).code).toBe('INSERT_FAILED')
    }
  })

  it('throws INSERT_FAILED when insert returns null data', async () => {
    const mock = buildMockSupabase({
      incident_log: { data: null, error: null },
    })

    await expect(
      addLogEntry(
        mock as unknown as Parameters<typeof addLogEntry>[0],
        INCIDENT_ID,
        ORG_ID,
        MEMBER_ID,
        ACTOR_NAME,
        validInput,
      ),
    ).rejects.toThrow(AddLogEntryError)
  })
})
