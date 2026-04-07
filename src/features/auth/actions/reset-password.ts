'use server'

import { createClient } from '@/lib/supabase/server'
import { ResetPasswordSchema } from '@/features/auth/schemas'

type ResetPasswordResult = { success: true } | { error: string }

export async function resetPassword(
  input: unknown,
): Promise<ResetPasswordResult> {
  const parsed = ResetPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid input. Please check your password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    console.error('[auth/reset-password] updateUser failed:', error.status)
    return { error: 'Failed to reset password. The link may have expired.' }
  }

  // Sign out so the user must re-authenticate with their new password
  await supabase.auth.signOut()

  return { success: true }
}
