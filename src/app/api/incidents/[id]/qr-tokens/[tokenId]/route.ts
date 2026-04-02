import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string; tokenId: string }> }

const PatchQrTokenSchema = z.object({
  isActive: z.boolean(),
})

// PATCH /api/incidents/:id/qr-tokens/:tokenId
// Activates or deactivates a specific QR token.
// Auth required — org membership verified via RLS on the update.
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id: incidentId, tokenId } = await ctx.params
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: {} },
      { status: 400 },
    )
  }

  const parsed = PatchQrTokenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', issues: parsed.error.issues },
        meta: {},
      },
      { status: 400 },
    )
  }

  // RLS ensures org members can only update tokens for their own org's incidents.
  // The .eq('incident_id') prevents cross-incident manipulation even within the same org.
  const { data: updated, error } = await supabase
    .from('incident_qr_tokens')
    .update({ is_active: parsed.data.isActive })
    .eq('id', tokenId)
    .eq('incident_id', incidentId)
    .select('id, is_active')
    .single()

  if (error || !updated) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'QR token not found' }, meta: {} },
        { status: 404 },
      )
    }
    console.error('[PATCH /qr-tokens/:tokenId] update error:', error?.message)
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: 'Failed to update QR token' }, meta: {} },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: updated, error: null, meta: {} }, { status: 200 })
}
