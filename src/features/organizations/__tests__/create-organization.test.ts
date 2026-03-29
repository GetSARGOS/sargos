import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createOrganization,
  CreateOrganizationError,
} from '@/features/organizations/logic/create-organization'
import type { CreateOrganizationInput } from '@/features/organizations/schemas'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// --- Helpers -----------------------------------------------------------------

const VALID_INPUT: CreateOrganizationInput = {
  name: 'King County SAR',
  slug: 'king-county-sar',
  unit_type: 'sar',
  country: 'US',
  admin_display_name: 'Jane Smith',
}

const USER_ID = 'user-uuid-1234'
const USER_EMAIL = 'jane@example.com'
const ORG_ID = 'org-uuid-5678'
const MEMBER_ID = 'member-uuid-9012'

// Build a minimal mock that chains .from().insert().select().single()
// and .from().delete().eq() for cleanup.
function buildMockClient(overrides?: {
  orgInsertResult?: { data: { id: string } | null; error: { code?: string; message?: string } | null }
  memberInsertResult?: { data: { id: string } | null; error: { code?: string; message?: string } | null }
}): SupabaseClient<Database> {
  const orgInsert = overrides?.orgInsertResult ?? {
    data: { id: ORG_ID },
    error: null,
  }
  const memberInsert = overrides?.memberInsertResult ?? {
    data: { id: MEMBER_ID },
    error: null,
  }

  // Each call to .from() returns a builder; we use a counter to differentiate
  // organizations / organization_members / audit_log calls.
  let callCount = 0

  const mockFrom = vi.fn().mockImplementation(() => {
    callCount++
    const current = callCount

    return {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            current === 1 ? orgInsert : memberInsert
          ),
        }),
        // For audit_log insert (no .select().single() chain)
        then: undefined,
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
  })

  // audit_log insert doesn't chain .select().single() — it's a bare .insert()
  // We handle this by making the 3rd from() call return a resolved promise directly.
  let auditCallCount = 0
  const originalMockFrom = mockFrom.getMockImplementation()!
  mockFrom.mockImplementation(() => {
    callCount++
    const current = callCount

    if (current === 3) {
      // audit_log — bare insert, awaited directly
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }

    return {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            current === 1 ? orgInsert : memberInsert
          ),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: mockFrom } as unknown as SupabaseClient<Database>
}

// --- Tests -------------------------------------------------------------------

describe('createOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns organizationId and memberId on success', async () => {
    const client = buildMockClient()
    const result = await createOrganization(client, VALID_INPUT, USER_ID, USER_EMAIL)

    expect(result).toEqual({
      organizationId: ORG_ID,
      memberId: MEMBER_ID,
    })
  })

  it('throws SLUG_TAKEN when organizations insert returns 23505', async () => {
    const client = buildMockClient({
      orgInsertResult: {
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      },
    })

    await expect(
      createOrganization(client, VALID_INPUT, USER_ID, USER_EMAIL)
    ).rejects.toThrow(CreateOrganizationError)

    await expect(
      createOrganization(buildMockClient({
        orgInsertResult: { data: null, error: { code: '23505', message: '' } },
      }), VALID_INPUT, USER_ID, USER_EMAIL)
    ).rejects.toMatchObject({ code: 'SLUG_TAKEN' })
  })

  it('throws ORG_CREATE_FAILED for non-unique org errors', async () => {
    const client = buildMockClient({
      orgInsertResult: {
        data: null,
        error: { code: '42P01', message: 'undefined table' },
      },
    })

    await expect(
      createOrganization(client, VALID_INPUT, USER_ID, USER_EMAIL)
    ).rejects.toMatchObject({ code: 'ORG_CREATE_FAILED' })
  })

  it('throws MEMBER_CREATE_FAILED and cleans up org when member insert fails', async () => {
    const client = buildMockClient({
      memberInsertResult: {
        data: null,
        error: { code: '23503', message: 'foreign key violation' },
      },
    })

    await expect(
      createOrganization(client, VALID_INPUT, USER_ID, USER_EMAIL)
    ).rejects.toMatchObject({ code: 'MEMBER_CREATE_FAILED' })

    // Verify the org cleanup delete was called
    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls
    const deleteCalled = fromCalls.some((args: unknown[]) => args[0] === 'organizations')
    expect(deleteCalled).toBe(true)
  })

  it('throws CreateOrganizationError (not a plain Error) for typed error propagation', async () => {
    const client = buildMockClient({
      orgInsertResult: { data: null, error: { code: '23505', message: '' } },
    })

    let thrown: unknown
    try {
      await createOrganization(client, VALID_INPUT, USER_ID, USER_EMAIL)
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeInstanceOf(CreateOrganizationError)
  })
})
