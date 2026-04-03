import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createIncident, CreateIncidentError } from '@/features/incidents/logic/create-incident'
import { CreateIncidentSchema } from '@/features/incidents/schemas'
import { checkExpensiveRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import { getRequestMeta } from '@/lib/request-meta'

// ─── GET /api/incidents ───────────────────────────────────────────────────────
// List the authenticated user's org incidents, active/planning first.

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }, meta: {} },
      { status: 401 },
    )
  }

  // Fetch the user's org membership to get organization_id
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

  const { data: incidents, error: fetchError } = await supabase
    .from('incidents')
    .select('id, name, incident_type, status, location_address, started_at, created_at')
    .eq('organization_id', member.organization_id)
    .is('deleted_at', null)
    .order('status', { ascending: true }) // active < closed < planning < suspended alphabetically — reorder below
    .order('created_at', { ascending: false })
    .limit(50)

  if (fetchError) {
    console.error('[GET /api/incidents] fetch failed:', fetchError.code)
    return NextResponse.json(
      { data: null, error: { code: 'FETCH_FAILED', message: 'Failed to fetch incidents' }, meta: {} },
      { status: 500 },
    )
  }

  // Sort: active/planning first, suspended next, closed last
  const statusOrder: Record<string, number> = { active: 0, planning: 1, suspended: 2, closed: 3 }
  const sorted = (incidents ?? []).sort(
    (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99),
  )

  return NextResponse.json({
    data: { incidents: sorted },
    error: null,
    meta: { count: sorted.length },
  })
}

// ─── POST /api/incidents ──────────────────────────────────────────────────────
// Create a new incident. The caller becomes the Incident Commander.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }, meta: {} },
      { status: 401 },
    )
  }

  // Fetch caller's active org membership
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

  // Rate limit: 20 requests per minute per organization (expensive operation)
  const rateLimit = await checkExpensiveRateLimit(member.organization_id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: {} },
      { status: 400 },
    )
  }

  const parsed = CreateIncidentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          issues: parsed.error.issues,
        },
        meta: {},
      },
      { status: 400 },
    )
  }

  try {
    const result = await createIncident(member.organization_id, user.id, parsed.data, getRequestMeta(req))
    return NextResponse.json(
      { data: { incidentId: result.incidentId }, error: null, meta: {} },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof CreateIncidentError) {
      const status = err.code === 'MEMBER_NOT_FOUND' ? 403 : 500
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status },
      )
    }
    console.error('[POST /api/incidents] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
