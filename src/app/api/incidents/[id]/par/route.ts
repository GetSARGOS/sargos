import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { initiatePar, InitiateParError } from '@/features/incidents/logic/initiate-par'
import { InitiateParSchema } from '@/features/incidents/schemas'

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET /api/incidents/[id]/par ──────────────────────────────────────────────
// Returns the latest PAR event for the incident with all responses.

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

  // Fetch the most recent PAR event
  const { data: parEvent, error: parError } = await supabase
    .from('incident_par_events')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('organization_id', member.organization_id)
    .order('initiated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (parError) {
    console.error('[GET /api/incidents/[id]/par] fetch failed:', parError.code)
    return NextResponse.json(
      { data: null, error: { code: 'FETCH_FAILED', message: 'Failed to fetch PAR event' }, meta: {} },
      { status: 500 },
    )
  }

  if (!parEvent) {
    return NextResponse.json({ data: { parEvent: null, responses: [] }, error: null, meta: {} })
  }

  // Fetch responses for this PAR event
  const { data: responses, error: responsesError } = await supabase
    .from('incident_par_responses')
    .select('*')
    .eq('par_event_id', parEvent.id)

  if (responsesError) {
    console.error('[GET /api/incidents/[id]/par] responses fetch failed:', responsesError.code)
    return NextResponse.json(
      { data: null, error: { code: 'FETCH_FAILED', message: 'Failed to fetch PAR responses' }, meta: {} },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: { parEvent, responses: responses ?? [] },
    error: null,
    meta: {},
  })
}

// ─── POST /api/incidents/[id]/par ─────────────────────────────────────────────
// Initiates a new PAR roll call for the incident.

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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = InitiateParSchema.safeParse(body)
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
    const result = await initiatePar(
      member.organization_id,
      incidentId,
      member.id,
      member.display_name,
      parsed.data,
    )
    return NextResponse.json(
      { data: { parEventId: result.parEventId, totalPersonnel: result.totalPersonnel }, error: null, meta: {} },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof InitiateParError) {
      const statusMap: Record<string, number> = {
        INCIDENT_NOT_FOUND: 404,
        INCIDENT_NOT_ACTIVE: 422,
        NO_PERSONNEL: 422,
        DB_ERROR: 500,
      }
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[POST /api/incidents/[id]/par] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
