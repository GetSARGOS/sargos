import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createQrToken, CreateQrTokenError } from '@/features/incidents/logic/create-qr-token'
import { checkAuthenticatedRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/incidents/:id/qr-tokens
// Returns all QR tokens for the incident (active and inactive).
// Auth required — org membership verified via RLS.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: incidentId } = await ctx.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }, meta: {} },
      { status: 401 },
    )
  }

  const { data: tokens, error } = await supabase
    .from('incident_qr_tokens')
    .select('id, token, is_active, scans, created_by, expires_at, created_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /qr-tokens] query error:', error.message)
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: 'Failed to fetch QR tokens' }, meta: {} },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: tokens ?? [], error: null, meta: {} }, { status: 200 })
}

// POST /api/incidents/:id/qr-tokens
// Creates a new QR token for the incident (deactivating any existing active token).
// Auth required — org membership required.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id: incidentId } = await ctx.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }, meta: {} },
      { status: 401 },
    )
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No active organization membership' }, meta: {} },
      { status: 401 },
    )
  }

  // Rate limit: 60 requests per minute per user
  const rateLimit = await checkAuthenticatedRateLimit(user.id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
  }

  try {
    const result = await createQrToken(membership.organization_id, incidentId, membership.id)
    return NextResponse.json({ data: result, error: null, meta: {} }, { status: 201 })
  } catch (err) {
    if (err instanceof CreateQrTokenError) {
      const status =
        err.code === 'INCIDENT_NOT_FOUND'
          ? 404
          : err.code === 'INCIDENT_CLOSED'
            ? 409
            : 500
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status },
      )
    }
    console.error('[POST /qr-tokens] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
