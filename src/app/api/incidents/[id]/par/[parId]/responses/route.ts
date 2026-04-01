import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitParResponse, SubmitParResponseError } from '@/features/incidents/logic/submit-par-response'
import { SubmitParResponseSchema } from '@/features/incidents/schemas'

type RouteContext = { params: Promise<{ id: string; parId: string }> }

// ─── POST /api/incidents/[id]/par/[parId]/responses ───────────────────────────
// Submit a PAR response (mark a personnel member as safe or unaccounted).

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id: incidentId, parId } = await ctx.params
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

  const parsed = SubmitParResponseSchema.safeParse(body)
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
    const result = await submitParResponse(
      member.organization_id,
      incidentId,
      parId,
      member.id,
      member.display_name,
      parsed.data,
    )
    return NextResponse.json(
      { data: { responded: result.responded, parCompleted: result.parCompleted }, error: null, meta: {} },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof SubmitParResponseError) {
      const statusMap: Record<string, number> = {
        PAR_EVENT_NOT_FOUND: 404,
        PAR_ALREADY_COMPLETED: 409,
        PERSONNEL_NOT_FOUND: 404,
        DB_ERROR: 500,
      }
      console.error(`[POST /par/${parId}/responses] ${err.code}: incidentId=${incidentId} orgId=${member.organization_id}`)
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[POST /api/incidents/[id]/par/[parId]/responses] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
