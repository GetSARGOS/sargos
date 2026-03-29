// Service role Supabase client — server-side ONLY.
// Bypasses RLS entirely. Use exclusively for:
//   1. Creating the first org_admin during onboarding (bootstrapping problem)
//   2. Writing to audit_log (insert-only, no client policy)
//   3. Other trusted server operations that cannot run as a specific user
//
// NEVER import this module in client components or expose SUPABASE_SERVICE_ROLE_KEY
// to the browser. This file must never be included in a client bundle.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase service role environment variables')
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      // Service role should never persist sessions or auto-refresh tokens.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
