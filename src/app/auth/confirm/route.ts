// Token-hash-based email verification handler.
// Supabase email templates link here with ?token_hash=...&type=...
// This bypasses the PKCE code exchange flow entirely — verifyOtp creates
// a session directly from the token hash, and cookies are set via the
// server Supabase client's setAll callback.
//
// Supported types: 'recovery' (password reset), 'signup' (email confirm),
// 'email_change', 'magiclink'.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

const VALID_OTP_TYPES: EmailOtpType[] = [
  'recovery',
  'signup',
  'email_change',
  'magiclink',
  'email',
  'invite',
]

// Map OTP types to their post-verification redirect destination.
const REDIRECT_MAP: Partial<Record<EmailOtpType, string>> = {
  recovery: '/reset-password',
}
const DEFAULT_REDIRECT = '/dashboard'

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  if (!tokenHash || !type || !VALID_OTP_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('[auth/confirm] verifyOtp failed:', error.status, error.message)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Determine redirect: explicit `next` param > type-based map > default.
  const destination = next ?? REDIRECT_MAP[type] ?? DEFAULT_REDIRECT

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${destination}`)
  }

  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${destination}`)
  }

  return NextResponse.redirect(`${origin}${destination}`)
}
