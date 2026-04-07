import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  checkForgotPasswordRateLimit: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { checkForgotPasswordRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { requestPasswordReset } from '../actions/request-password-reset'

function mockRateLimit(success = true) {
  vi.mocked(checkForgotPasswordRateLimit).mockResolvedValue({
    success,
    limit: 3,
    remaining: success ? 2 : 0,
    reset: Date.now() + 3600000,
  })
}

function mockSupabase(resetError: { status: number; message: string } | null = null) {
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: resetError })
  vi.mocked(createClient).mockResolvedValue({
    auth: { resetPasswordForEmail },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { resetPasswordForEmail }
}

describe('requestPasswordReset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success for a valid email within rate limit', async () => {
    mockRateLimit(true)
    const { resetPasswordForEmail } = mockSupabase()

    const result = await requestPasswordReset({ email: 'user@example.com' })

    expect(result).toEqual({ success: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com')
  })

  it('returns error for invalid email format', async () => {
    const result = await requestPasswordReset({ email: 'not-an-email' })
    expect(result).toEqual({ error: 'Please enter a valid email address.' })
  })

  it('returns error when rate limited', async () => {
    mockRateLimit(false)

    const result = await requestPasswordReset({ email: 'user@example.com' })
    expect(result).toEqual({ error: 'Too many requests. Please try again later.' })
  })

  it('validates input before checking rate limit', async () => {
    const result = await requestPasswordReset({ email: '' })
    expect(result).toEqual({ error: 'Please enter a valid email address.' })
    expect(checkForgotPasswordRateLimit).not.toHaveBeenCalled()
  })

  it('returns success even when Supabase errors (never reveal email existence)', async () => {
    mockRateLimit(true)
    mockSupabase({ status: 422, message: 'User not found' })

    const result = await requestPasswordReset({ email: 'nonexistent@example.com' })
    expect(result).toEqual({ success: true })
  })
})
