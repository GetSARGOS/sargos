// Supabase Auth callback handler.
// Supabase redirects here after:
//   - Email confirmation (magic link or email+password signup)
//   - OAuth provider login (if configured)
//
// This route exchanges the one-time `code` in the URL for a persistent session
// stored in HTTP-only cookies. The proxy.ts then reads those cookies on every
// subsequent request to keep the session alive.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` lets us redirect back to the page the user was trying to reach.
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    // No code present — something went wrong before we were called.
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Log the error ID only — never log the code or any PII.
    console.error('[auth/callback] exchangeCodeForSession failed:', error.status)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Successful exchange. Determine the correct base URL for redirect.
  // In production behind Vercel's edge network, the origin from the Request
  // object may be the internal host. Use x-forwarded-host when present.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
