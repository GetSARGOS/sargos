// Browser-side Supabase client — use in Client Components only.
// This uses the public anon key. All access is protected by RLS on the database.
// Never use or import SUPABASE_SERVICE_ROLE_KEY in client-side code.

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
