import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQrToken, CreateQrTokenError } from '@/features/incidents/logic/create-qr-token'
import { buildMockSupabase, ok, err, noRows } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
const mockedCreate = vi.mocked(createServiceClient)

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid'
const INC_ID = 'inc-uuid'
const MEMBER_ID = 'member-uuid'
const TOKEN_ID = 'token-uuid'
const TOKEN_VALUE = 'tok_abc123'

const ACTIVE_INCIDENT = ok({ id: INC_ID, status: 'active' })
const NEW_TOKEN = ok({ id: TOKEN_ID, token: TOKEN_VALUE })

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createQrToken', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
  })

  it('returns { id, token } on success', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        incident_qr_tokens: [
          { error: null }, // UPDATE: deactivate existing tokens
          NEW_TOKEN,       // INSERT: new token with select + single
        ],
      }),
    )

    const result = await createQrToken(ORG_ID, INC_ID, MEMBER_ID)
    expect(result).toEqual({ id: TOKEN_ID, token: TOKEN_VALUE })
  })

  it('throws INCIDENT_NOT_FOUND when incident does not exist', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: noRows() }),
    )

    await expect(
      createQrToken(ORG_ID, INC_ID, MEMBER_ID),
    ).rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND' })
  })

  it('throws INCIDENT_NOT_FOUND when incident fetch returns a db error', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({ incidents: err('42P01') }),
    )

    await expect(
      createQrToken(ORG_ID, INC_ID, MEMBER_ID),
    ).rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND' })
  })

  it('throws INCIDENT_CLOSED when incident status is closed', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ok({ id: INC_ID, status: 'closed' }),
      }),
    )

    await expect(
      createQrToken(ORG_ID, INC_ID, MEMBER_ID),
    ).rejects.toMatchObject({ code: 'INCIDENT_CLOSED' })
  })

  it('throws DB_ERROR when the token insert fails', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({
        incidents: ACTIVE_INCIDENT,
        incident_qr_tokens: [
          { error: null }, // UPDATE: deactivate succeeds
          err('23505'),   // INSERT: unique constraint violation
        ],
      }),
    )

    await expect(
      createQrToken(ORG_ID, INC_ID, MEMBER_ID),
    ).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws CreateQrTokenError (not a plain Error) for typed propagation', async () => {
    mockedCreate.mockReturnValue(buildMockSupabase({ incidents: noRows() }))

    let thrown: unknown
    try {
      await createQrToken(ORG_ID, INC_ID, MEMBER_ID)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(CreateQrTokenError)
  })

  it('deactivates existing tokens before inserting the new one', async () => {
    const mockClient = buildMockSupabase({
      incidents: ACTIVE_INCIDENT,
      incident_qr_tokens: [
        { error: null },
        NEW_TOKEN,
      ],
    })
    mockedCreate.mockReturnValue(mockClient)

    await createQrToken(ORG_ID, INC_ID, MEMBER_ID)

    // incident_qr_tokens is accessed twice: UPDATE to deactivate, then INSERT
    const qrCalls = (mockClient.from as ReturnType<typeof vi.fn>).mock.calls
      .filter((args) => args[0] === 'incident_qr_tokens')
    expect(qrCalls).toHaveLength(2)
  })
})
