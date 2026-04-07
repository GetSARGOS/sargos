// Supabase client for use in Next.js proxy.ts only.
// This version reads/writes cookies directly on the request/response objects
// so the auth session is refreshed on every proxied request.
// Do NOT use this outside of proxy.ts — use server.ts for all other server code.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'

// Public paths that never require authentication.
// All other paths are protected by default (security-first).
const PUBLIC_PATHS = [
  '/auth/callback',
  '/auth/confirm',
  '/auth/auth-code-error',
  '/login',
  '/signup',
  '/forgot-password',
  '/check-in',  // volunteer QR check-in — no account needed
]

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname

  // IMPORTANT: Do not add logic between createServerClient and getUser().
  // The session refresh relies on both being called in sequence without
  // intermediate awaits that could interfere with cookie propagation.

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to the request first so downstream middleware sees the updated cookies.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild the response with the updated request so cookies propagate.
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session. This is the only place where session tokens are renewed.
  // getUser() is called (not getSession()) so the token is validated server-side
  // against Supabase Auth — a tampered cookie cannot spoof a valid session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  // API routes handle their own auth and return JSON 401 — never redirect them
  // to /login, which would return an HTML page to an API client.
  const isApiRoute = pathname.startsWith('/api/')

  if (!user && !isPublicPath && !isApiRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If user is authenticated and lands on /login or /signup, send them home.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/dashboard'
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}
