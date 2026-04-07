import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { handOffIc, HandOffIcError } from '@/features/incidents/logic/hand-off-ic'
import { HandOffIcSchema } from '@/features/incidents/schemas'
import { checkExpensiveRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import { getRequestMeta } from '@/lib/request-meta'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  HANDOFF_NOT_IC,
  HANDOFF_FAILED,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

// ─── POST /api/incidents/[id]/hand-off ─────────────────────────────────────

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: incidentId } = await ctx.params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return errorResponse(AUTH_UNAUTHORIZED, 'Authentication required')
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id, organization_id, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return errorResponse(AUTH_NO_ORGANIZATION, 'No active organization membership')
  }

  // Rate limit: expensive operation
  const rateLimit = await checkExpensiveRateLimit(member.organization_id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
  }

  // No role check here — handOffIc verifies the actor is the current IC internally

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = HandOffIcSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const result = await handOffIc(
      serviceClient,
      incidentId,
      member.organization_id,
      member.id,
      member.display_name,
      user.id,
      parsed.data,
      getRequestMeta(req),
    )

    return Response.json(
      { data: { newIcCommandStructureId: result.newIcCommandStructureId }, error: null, meta: null },
    )
  } catch (err) {
    if (err instanceof HandOffIcError) {
      const errorCodeMap: Record<string, { code: typeof HANDOFF_NOT_IC | typeof HANDOFF_FAILED; fallbackStatus: number }> = {
        NOT_CURRENT_IC: { code: HANDOFF_NOT_IC, fallbackStatus: 403 },
        NEW_IC_NOT_CHECKED_IN: { code: HANDOFF_FAILED, fallbackStatus: 422 },
        HANDOFF_FAILED: { code: HANDOFF_FAILED, fallbackStatus: 500 },
        INCIDENT_NOT_FOUND: { code: HANDOFF_FAILED, fallbackStatus: 404 },
      }
      const mapped = errorCodeMap[err.code]
      if (mapped) {
        return Response.json(
          { data: null, error: { code: mapped.code.code, message: err.message }, meta: null },
          { status: mapped.code.status },
        )
      }
    }
    console.error('[POST /api/incidents/[id]/hand-off] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
