'use server'

import { createClient } from '@/lib/supabase/server'
import { ForgotPasswordSchema } from '@/features/auth/schemas'
import { checkForgotPasswordRateLimit } from '@/lib/rate-limit'

type RequestPasswordResetResult = { success: true } | { error: string }

/**
 * Server action: validates, rate-limits, then sends a password reset email.
 *
 * The actual email link goes through /auth/confirm (token-hash-based
 * verification via verifyOtp), which bypasses PKCE entirely. This avoids
 * the code_verifier cookie persistence issue with @supabase/ssr's server
 * client. The Supabase recovery email template must be configured to link
 * to {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery.
 *
 * Always returns success to avoid revealing whether the email exists.
 */
export async function requestPasswordReset(
  input: unknown,
): Promise<RequestPasswordResetResult> {
  const parsed = ForgotPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }

  const rateLimit = await checkForgotPasswordRateLimit(parsed.data.email)
  if (!rateLimit.success) {
    return { error: 'Too many requests. Please try again later.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)

  if (error) {
    // Log status only — never log PII.
    console.error('[auth/request-password-reset] resetPasswordForEmail failed:', error.status)
  }

  // Always return success — never reveal whether the email exists.
  return { success: true }
}
