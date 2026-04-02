import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { returnResource, ReturnResourceError } from '@/features/incidents/logic/return-resource'
import { ReturnResourceSchema } from '@/features/incidents/schemas'

type RouteContext = { params: Promise<{ id: string; incidentResourceId: string }> }

// ─── PATCH /api/incidents/[id]/resources/[incidentResourceId] ─────────────────
// Return a deployed resource.

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { incidentResourceId } = await ctx.params
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

  const parsed = ReturnResourceSchema.safeParse(body)
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
    await returnResource(
      member.organization_id,
      incidentResourceId,
      member.id,
      member.display_name,
      parsed.data,
    )
    return NextResponse.json(
      { data: { returned: true }, error: null, meta: {} },
      { status: 200 },
    )
  } catch (err) {
    if (err instanceof ReturnResourceError) {
      const statusMap: Record<string, number> = {
        INCIDENT_RESOURCE_NOT_FOUND: 404,
        ALREADY_RETURNED: 409,
        DB_ERROR: 500,
      }
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[PATCH /api/incidents/[id]/resources/[incidentResourceId]] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
