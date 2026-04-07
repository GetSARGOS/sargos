import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { resetPassword } from '../actions/reset-password'

function mockSupabaseAuth(
  updateError: { status: number; message: string } | null = null,
) {
  const updateUser = vi.fn().mockResolvedValue({ error: updateError })
  const signOut = vi.fn().mockResolvedValue({ error: null })
  const auth = { updateUser, signOut }
  vi.mocked(createClient).mockResolvedValue({ auth } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { updateUser, signOut }
}

describe('resetPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  const validInput = {
    password: 'NewStrong1',
    confirmPassword: 'NewStrong1',
  }

  it('returns success and signs out on valid reset', async () => {
    const { updateUser, signOut } = mockSupabaseAuth(null)

    const result = await resetPassword(validInput)

    expect(result).toEqual({ success: true })
    expect(updateUser).toHaveBeenCalledWith({ password: 'NewStrong1' })
    expect(signOut).toHaveBeenCalled()
  })

  it('returns error on invalid input', async () => {
    const result = await resetPassword({
      password: 'weak',
      confirmPassword: 'weak',
    })

    expect(result).toEqual({ error: 'Invalid input. Please check your password.' })
  })

  it('returns error when passwords do not match', async () => {
    const result = await resetPassword({
      password: 'StrongPass1',
      confirmPassword: 'DifferentPass2',
    })

    expect(result).toEqual({ error: 'Invalid input. Please check your password.' })
  })

  it('returns error when updateUser fails', async () => {
    const { signOut } = mockSupabaseAuth({ status: 403, message: 'Token expired' })

    const result = await resetPassword(validInput)

    expect(result).toEqual({ error: 'Failed to reset password. The link may have expired.' })
    expect(signOut).not.toHaveBeenCalled()
  })
})
