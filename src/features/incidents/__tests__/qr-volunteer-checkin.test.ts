import { describe, it, expect, vi, beforeEach } from 'vitest'
import { qrVolunteerCheckIn, QrVolunteerCheckInError } from '@/features/incidents/logic/qr-volunteer-checkin'
import type { QrVolunteerCheckInInput } from '@/features/incidents/schemas'
import { buildMockSupabase, ok, err } from './test-helpers'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
const mockedCreate = vi.mocked(createServiceClient)

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_STRING = 'tok_abc123'
const PERSONNEL_ID = 'personnel-uuid'

const VALID_INPUT: QrVolunteerCheckInInput = {
  name: 'Jane Doe',
  phone: '+15559876543',
  certifications: ['Wilderness First Aid'],
  vehicle: 'Blue Toyota Tacoma',
  safetyAck: true,
}

const ACTIVE_TOKEN_ROW = {
  is_active: true,
  incident_id: 'inc-uuid',
  incident_name: 'SAR Op Alpha',
}

function buildHappyPathMock() {
  return buildMockSupabase(
    {
      incident_qr_tokens: ok({ id: 'qr-uuid', organization_id: 'org-uuid' }),
      incident_personnel: ok({ id: PERSONNEL_ID }),
      incident_log: { error: null },
    },
    {
      lookup_qr_token: ok([ACTIVE_TOKEN_ROW]),
      increment_qr_scans: { data: null, error: null },
    },
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('qrVolunteerCheckIn', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
  })

  it('returns { personnelId, incidentName } on success', async () => {
    mockedCreate.mockReturnValue(buildHappyPathMock())

    const result = await qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT)
    expect(result).toEqual({ personnelId: PERSONNEL_ID, incidentName: 'SAR Op Alpha' })
  })

  it('throws TOKEN_NOT_FOUND when lookup_qr_token returns a db error', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({}, { lookup_qr_token: err('42P01') }),
    )

    await expect(
      qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT),
    ).rejects.toMatchObject({ code: 'TOKEN_NOT_FOUND' })
  })

  it('throws TOKEN_NOT_FOUND when lookup_qr_token returns an empty array', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({}, { lookup_qr_token: { data: [], error: null } }),
    )

    await expect(
      qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT),
    ).rejects.toMatchObject({ code: 'TOKEN_NOT_FOUND' })
  })

  it('throws TOKEN_INACTIVE when the token is not active', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase(
        {},
        { lookup_qr_token: ok([{ ...ACTIVE_TOKEN_ROW, is_active: false }]) },
      ),
    )

    await expect(
      qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT),
    ).rejects.toMatchObject({ code: 'TOKEN_INACTIVE' })
  })

  it('throws DB_ERROR when the qr token row fetch fails', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase(
        { incident_qr_tokens: err('42P01') },
        { lookup_qr_token: ok([ACTIVE_TOKEN_ROW]) },
      ),
    )

    await expect(
      qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT),
    ).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws DB_ERROR when the personnel insert fails', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase(
        {
          incident_qr_tokens: ok({ id: 'qr-uuid', organization_id: 'org-uuid' }),
          incident_personnel: err('23514'),
        },
        { lookup_qr_token: ok([ACTIVE_TOKEN_ROW]) },
      ),
    )

    await expect(
      qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT),
    ).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('throws QrVolunteerCheckInError (not a plain Error) for typed propagation', async () => {
    mockedCreate.mockReturnValue(
      buildMockSupabase({}, { lookup_qr_token: err('42P01') }),
    )

    let thrown: unknown
    try {
      await qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(QrVolunteerCheckInError)
  })

  it('writes an incident log entry on success', async () => {
    const mockClient = buildHappyPathMock()
    mockedCreate.mockReturnValue(mockClient)

    await qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT)

    expect(mockClient.from).toHaveBeenCalledWith('incident_log')
  })

  it('calls increment_qr_scans rpc on success', async () => {
    const mockClient = buildHappyPathMock()
    mockedCreate.mockReturnValue(mockClient)

    await qrVolunteerCheckIn(TOKEN_STRING, VALID_INPUT)

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'increment_qr_scans',
      expect.objectContaining({ p_token: TOKEN_STRING }),
    )
  })
})
