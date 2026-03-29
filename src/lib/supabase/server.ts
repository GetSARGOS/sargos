// Server-side Supabase client — use in Server Components, Route Handlers,
// and Server Actions. Never import this in client components.
// Uses cookie-based auth via @supabase/ssr so sessions persist across requests.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/supabase/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from a Server Component during a read-only render.
            // Cookie writes are ignored here — the proxy.ts updateSession() call
            // is responsible for refreshing the session on each request.
          }
        },
      },
    }
  )
}
