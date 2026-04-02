import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { QrVolunteerCheckInSchema } from '@/features/incidents/schemas'
import {
  qrVolunteerCheckIn,
  QrVolunteerCheckInError,
} from '@/features/incidents/logic/qr-volunteer-checkin'

type RouteContext = { params: Promise<{ token: string }> }

// GET /api/check-in/:token
// Public — no auth required.
// Resolves a QR token and returns incident metadata for the check-in form.
// Uses lookup_qr_token SECURITY DEFINER RPC (anon-accessible).
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params

  // Use the server client with no auth session — the RPC is callable by anon role.
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .rpc('lookup_qr_token', { p_token: token })

  if (error) {
    console.error('[GET /check-in] RPC error:', error.message)
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: 'Failed to resolve QR code' }, meta: {} },
      { status: 500 },
    )
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'TOKEN_NOT_FOUND', message: 'QR code not found or incident is closed' },
        meta: {},
      },
      { status: 404 },
    )
  }

  const row = rows[0]
  return NextResponse.json(
    {
      data: {
        incidentId: row.incident_id,
        isActive: row.is_active,
        incidentName: row.incident_name,
        organizationName: row.organization_name,
      },
      error: null,
      meta: {},
    },
    { status: 200 },
  )
}

// POST /api/check-in/:token
// Public — no auth required.
// Submits the volunteer check-in form. Validated with Zod before processing.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: {} },
      { status: 400 },
    )
  }

  const parsed = QrVolunteerCheckInSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid form data', issues: parsed.error.issues },
        meta: {},
      },
      { status: 400 },
    )
  }

  try {
    const result = await qrVolunteerCheckIn(token, parsed.data)
    return NextResponse.json({ data: result, error: null, meta: {} }, { status: 201 })
  } catch (err) {
    if (err instanceof QrVolunteerCheckInError) {
      const status =
        err.code === 'TOKEN_NOT_FOUND' || err.code === 'TOKEN_INACTIVE'
          ? 404
          : err.code === 'INCIDENT_CLOSED'
            ? 409
            : 500
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status },
      )
    }
    console.error('[POST /check-in] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
