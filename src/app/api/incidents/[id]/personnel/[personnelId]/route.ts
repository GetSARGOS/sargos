import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updatePersonnelStatus, UpdatePersonnelStatusError } from '@/features/incidents/logic/update-personnel-status'
import { UpdatePersonnelSchema } from '@/features/incidents/schemas'

type RouteContext = { params: Promise<{ id: string; personnelId: string }> }

// ─── PATCH /api/incidents/[id]/personnel/[personnelId] ────────────────────────
// Update a personnel record's status.

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { personnelId } = await ctx.params
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

  const parsed = UpdatePersonnelSchema.safeParse(body)
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
    await updatePersonnelStatus(
      member.organization_id,
      member.id,
      member.display_name,
      personnelId,
      parsed.data,
    )
    return NextResponse.json(
      { data: { updated: true }, error: null, meta: {} },
      { status: 200 },
    )
  } catch (err) {
    if (err instanceof UpdatePersonnelStatusError) {
      const status = err.code === 'PERSONNEL_NOT_FOUND' ? 404 : 500
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message }, meta: {} },
        { status },
      )
    }
    console.error('[PATCH /api/incidents/[id]/personnel/[personnelId]] unexpected error:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, meta: {} },
      { status: 500 },
    )
  }
}
