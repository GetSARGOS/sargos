'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginSchema } from '@/features/auth/schemas'

type SignInResult = { error: string }

// On success this function calls redirect() and never returns.
// On failure it returns { error }.
export async function signIn(input: unknown): Promise<SignInResult> {
  const result = LoginSchema.safeParse(input)
  if (!result.success) {
    return { error: 'Invalid email or password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    // Log status only — never the raw error message
    console.error('[auth/signin] signInWithPassword failed:', error.status)
    return { error: 'Invalid email or password.' }
  }

  // redirect() throws a NEXT_REDIRECT error — it never returns.
  // Must NOT be inside a try/catch block.
  redirect('/dashboard')
}
