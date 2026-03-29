'use server'

import { createClient } from '@/lib/supabase/server'
import { SignupSchema } from '@/features/auth/schemas'

type SignUpResult = { success: true } | { error: string }

export async function signUp(input: unknown): Promise<SignUpResult> {
  const result = SignupSchema.safeParse(input)
  if (!result.success) {
    return { error: 'Invalid input. Please check your details.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    // Log status only — never the full error message, which may contain PII
    console.error('[auth/signup] signUp failed:', error.status)
    if (error.status === 422) {
      return { error: 'An account with this email already exists.' }
    }
    return { error: 'Sign up failed. Please try again.' }
  }

  return { success: true }
}
