import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkInPersonnel, CheckInPersonnelError } from '@/features/incidents/logic/check-in-personnel'
import { CheckInPersonnelSchema } from '@/features/incidents/schemas'
import { checkAuthenticatedRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET /api/incidents/[id]/personnel ────────────────────────────────────────
// List all personnel on the incident with their display names.

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id: incidentId } = await ctx.params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }, meta: {} },
      { status: 401 },
    )
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return NextResponse.json(
      { data: null, error: { code: 'NO_ORGANIZATION', message: 'No active organization membership' }, meta: {} },
      { status: 403 },
    )
  }

  const { data: personnel, error: fetchError } = await supabase
    .from('incident_personnel')
    .select(`
      id,
      member_id,
      volunteer_name,
      personnel_type,
      checkin_method,
      checked_in_at,
      checked_out_at,
      status,
      incident_role,
      assigned_sector_id,
      assigned_team_id,
      last_checked_in_at,
      notes,
      updated_at,
      organization_members (
        display_name,
        phone,
        certifications
      )
    `)
    .eq('incident_id', incidentId)
    .eq('organization_id', member.organization_id)
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: true })

  if (fetchError) {
    console.error('[GET /api/incidents/[id]/personnel] fetch failed:', fetchError.code)
    return NextResponse.json(
      { data: null, error: { code: 'FETCH_FAILED', message: 'Failed to fetch personnel' }, meta: {} },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: { personnel: personnel ?? [] },
    error: null,
    meta: { count: personnel?.length ?? 0 },
  })
}

// ─── POST /api/incidents/[id]/personnel ───────────────────────────────────────
// Check a member into the incident.

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id: incidentId } = await ctx.params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }, meta: {} },
      { status: 401 },
    )
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id, organization_id, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return NextResponse.json(
      { data: null, error: { code: 'NO_ORGANIZATION', message: 'No active organization membership' }, meta: {} },
      { status: 403 },
    )
  }

  // Rate limit: 60 requests per minute per user
  const rateLimit = await checkAuthenticatedRateLimit(user.id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: {} },
      { status: 400 },
    )
  }

  const parsed = CheckInPersonnelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', issues: parsed.error.issues },
        meta: {},
      },
      { status: 400 },
    )
  }

  try {
    const result = await checkInPersonnel(
      member.organization_id,
      member.id,
      member.display_name,
      incidentId,
      parsed.data,
    )
    return NextResponse.json(
      { data: { personnelId: result.personnelId }, error: null, meta: {} },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof CheckInPersonnelError) {
      const statusMap: Record<string, number> = {
        INCIDENT_NOT_FOUND: 404,
        MEMBER_NOT_FOUND: 404,
        ALREADY_CHECKED_IN: 409,
        CHECK_IN_FAILED: 500,
      }
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[POST /api/incidents/[id]/personnel] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
