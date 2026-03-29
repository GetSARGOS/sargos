import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies before importing the route handler
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/features/organizations/logic/create-organization', () => ({
  createOrganization: vi.fn(),
  CreateOrganizationError: class CreateOrganizationError extends Error {
    code: string
    constructor(code: string) {
      super(code)
      this.name = 'CreateOrganizationError'
      this.code = code
    }
  },
}))

import { POST } from '@/app/api/organizations/route'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  createOrganization,
  CreateOrganizationError,
} from '@/features/organizations/logic/create-organization'

// --- Helpers -----------------------------------------------------------------

const VALID_BODY = {
  name: 'King County SAR',
  slug: 'king-county-sar',
  unit_type: 'sar',
  admin_display_name: 'Jane Smith',
}

function makeRequest(body: unknown = VALID_BODY): NextRequest {
  return new NextRequest('http://localhost/api/organizations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockAuthenticatedUser(email = 'jane@example.com') {
  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'user-uuid-1234', email } },
    error: null,
  })
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
}

function mockUnauthenticated() {
  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
}

// --- Tests -------------------------------------------------------------------

describe('POST /api/organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({})
  })

  it('returns 401 when not authenticated', async () => {
    mockUnauthenticated()
    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
    expect(body.data).toBeNull()
  })

  it('returns 400 when request body is not valid JSON', async () => {
    mockAuthenticatedUser()
    const request = new NextRequest('http://localhost/api/organizations', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request body')
  })

  it('returns 400 with validation issues for invalid input', async () => {
    mockAuthenticatedUser()
    const response = await POST(
      makeRequest({ name: '', slug: 'INVALID SLUG', unit_type: 'sar', admin_display_name: 'J' })
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Validation failed')
    expect(body.meta.issues).toBeDefined()
    expect(Array.isArray(body.meta.issues)).toBe(true)
  })

  it('returns 201 with result on success', async () => {
    mockAuthenticatedUser()
    ;(createOrganization as ReturnType<typeof vi.fn>).mockResolvedValue({
      organizationId: 'org-uuid',
      memberId: 'member-uuid',
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.data).toEqual({ organizationId: 'org-uuid', memberId: 'member-uuid' })
    expect(body.error).toBeNull()
  })

  it('returns 409 when slug is already taken', async () => {
    mockAuthenticatedUser()
    ;(createOrganization as ReturnType<typeof vi.fn>).mockRejectedValue(
      new CreateOrganizationError('SLUG_TAKEN')
    )

    const response = await POST(makeRequest())
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('This slug is already taken')
  })

  it('returns 500 for unexpected errors', async () => {
    mockAuthenticatedUser()
    ;(createOrganization as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Unexpected database error')
    )

    const response = await POST(makeRequest())
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to create organization')
  })

  it('response always follows { data, error, meta } shape', async () => {
    mockUnauthenticated()
    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('error')
    expect(body).toHaveProperty('meta')
  })
})
