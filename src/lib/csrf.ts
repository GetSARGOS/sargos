// ─── CSRF Origin Validation ─────────────────────────────────────────────────
// Validates the Origin header on public POST endpoints to prevent cross-site
// request forgery. See claude-rules.md Section 5.
//
// Authenticated routes rely on SameSite=Lax cookies and do not need this check.

import { NextResponse } from 'next/server'

/**
 * Validate the Origin header against allowed origins.
 *
 * Rules:
 * - No Origin/Referer header (non-browser client like curl) → allow
 * - Origin matches allowed list → allow
 * - Origin present but doesn't match → reject
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Non-browser clients (curl, API tools) don't send Origin — allow them.
  // CSRF is a browser-only attack vector.
  if (!origin && !referer) {
    return true
  }

  const allowedOrigins = buildAllowedOrigins()
  const requestOrigin = origin ?? extractOriginFromReferer(referer)

  if (!requestOrigin) {
    return true
  }

  return allowedOrigins.has(requestOrigin)
}

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    origins.add(normalizeOrigin(appUrl))
  }

  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:3000')
  }

  return origins
}

function normalizeOrigin(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.origin
  } catch {
    return url
  }
}

function extractOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null
  try {
    const parsed = new URL(referer)
    return parsed.origin
  } catch {
    return null
  }
}

/**
 * Build a 403 Forbidden response for CSRF origin mismatch.
 */
export function csrfRejectedResponse(): NextResponse {
  return NextResponse.json(
    {
      data: null,
      error: { code: 'CSRF_ORIGIN_MISMATCH', message: 'Forbidden' },
      meta: null,
    },
    { status: 403 },
  )
}
