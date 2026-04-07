import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updatePeriod, UpdatePeriodError } from '@/features/incidents/logic/update-period'
import { UpdatePeriodSchema } from '@/features/incidents/schemas'
import { checkAuthenticatedRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  AUTH_FORBIDDEN,
  PERIOD_NOT_FOUND,
  PERIOD_UPDATE_FAILED,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

type RouteContext = { params: Promise<{ id: string; periodId: string }> }

// ─── PATCH /api/incidents/[id]/operational-periods/[periodId] ──────────────

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<Response> {
  const { id: incidentId, periodId } = await ctx.params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return errorResponse(AUTH_UNAUTHORIZED, 'Authentication required')
  }

  const rateLimit = await checkAuthenticatedRateLimit(user.id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return errorResponse(AUTH_NO_ORGANIZATION, 'No active organization membership')
  }

  // Role check: IC or planning_section_chief
  const { data: personnel } = await supabase
    .from('incident_personnel')
    .select('incident_role')
    .eq('incident_id', incidentId)
    .eq('member_id', member.id)
    .is('checked_out_at', null)
    .single()

  const allowedRoles = ['incident_commander', 'planning_section_chief']
  if (!personnel || !allowedRoles.includes(personnel.incident_role ?? '')) {
    return errorResponse(AUTH_FORBIDDEN, 'Only the IC or Planning Section Chief can update operational periods')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = UpdatePeriodSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const result = await updatePeriod(
      serviceClient,
      periodId,
      incidentId,
      member.organization_id,
      parsed.data,
    )

    return Response.json(
      { data: { periodId: result.periodId }, error: null, meta: null },
    )
  } catch (err) {
    if (err instanceof UpdatePeriodError) {
      const errorMap: Record<string, { code: typeof PERIOD_NOT_FOUND | typeof PERIOD_UPDATE_FAILED }> = {
        PERIOD_NOT_FOUND: { code: PERIOD_NOT_FOUND },
        UPDATE_FAILED: { code: PERIOD_UPDATE_FAILED },
      }
      const mapped = errorMap[err.code]
      if (mapped) {
        return errorResponse(mapped.code, err.message)
      }
    }
    console.error('[PATCH /api/incidents/[id]/operational-periods/[periodId]] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
