// DEV ONLY — delete this file before any production deploy.
// Used to obtain a session cookie for manual API testing without a login UI.
// Accepts email + password, signs in via Supabase, and sets session cookies
// in the response so subsequent curl requests can use them.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { email, password } = (await request.json()) as {
    email: string
    password: string
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error !== null || data.session === null) {
    return NextResponse.json({ error: error?.message ?? 'Sign in failed' }, { status: 401 })
  }

  // Cookies are set automatically by @supabase/ssr via the createClient cookie handler.
  // Return the access_token too so it's visible in the curl response for reference.
  return NextResponse.json({ ok: true, access_token: data.session.access_token })
}
