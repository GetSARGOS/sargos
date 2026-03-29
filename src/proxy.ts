// Next.js Proxy (renamed from middleware in Next.js 16).
// Runs on every matched request before rendering. Responsible for:
//   1. Refreshing the Supabase auth session token (keeps sessions alive)
//   2. Redirecting unauthenticated users to /login
//   3. Redirecting authenticated users away from /login and /signup
//
// NOTE: This is an optimistic auth check only. The Supabase auth token is
// validated server-side via getUser(). However, all API routes and Server
// Actions MUST perform their own authorization checks — never rely solely
// on this proxy for data security.

import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico, robots.txt, sitemap.xml (metadata)
     * - Static file extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
}
