import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deployResource, DeployResourceError } from '@/features/incidents/logic/deploy-resource'
import { DeployResourceSchema } from '@/features/incidents/schemas'

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET /api/incidents/[id]/resources ───────────────────────────────────────
// List resources currently deployed to this incident.

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

  // Fetch incident_resources for this incident
  const { data: incidentResourceRows, error: irError } = await supabase
    .from('incident_resources')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('organization_id', member.organization_id)
    .in('status', ['requested', 'deployed'])
    .order('checked_out_at', { ascending: true })

  if (irError) {
    console.error('[GET /api/incidents/[id]/resources] fetch failed:', irError.code)
    return NextResponse.json(
      { data: null, error: { code: 'FETCH_FAILED', message: 'Failed to fetch resources' }, meta: {} },
      { status: 500 },
    )
  }

  // Merge in resource details via a second query
  const resourceIds = (incidentResourceRows ?? []).map((r) => r.resource_id)
  const resourceMap = new Map<string, { name: string; category: string; identifier: string | null }>()
  if (resourceIds.length > 0) {
    const { data: resourceRows } = await supabase
      .from('resources')
      .select('id, name, category, identifier')
      .in('id', resourceIds)
    for (const r of resourceRows ?? []) {
      resourceMap.set(r.id, { name: r.name, category: r.category, identifier: r.identifier })
    }
  }

  const deployed = (incidentResourceRows ?? []).map((ir) => ({
    ...ir,
    resourceName: resourceMap.get(ir.resource_id)?.name ?? '—',
    resourceCategory: resourceMap.get(ir.resource_id)?.category ?? '—',
    resourceIdentifier: resourceMap.get(ir.resource_id)?.identifier ?? null,
  }))

  return NextResponse.json({
    data: { deployed },
    error: null,
    meta: { count: deployed.length },
  })
}

// ─── POST /api/incidents/[id]/resources ──────────────────────────────────────
// Deploy a resource to the incident.

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
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: {} },
      { status: 400 },
    )
  }

  const parsed = DeployResourceSchema.safeParse(body)
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
    const result = await deployResource(
      member.organization_id,
      incidentId,
      member.id,
      member.display_name,
      parsed.data,
    )
    return NextResponse.json(
      { data: { incidentResourceId: result.incidentResourceId }, error: null, meta: {} },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof DeployResourceError) {
      const statusMap: Record<string, number> = {
        INCIDENT_NOT_FOUND: 404,
        INCIDENT_NOT_ACTIVE: 422,
        RESOURCE_NOT_FOUND: 404,
        ALREADY_DEPLOYED: 409,
        DB_ERROR: 500,
      }
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[POST /api/incidents/[id]/resources] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
