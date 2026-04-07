import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { startNewPeriod, StartNewPeriodError } from '@/features/incidents/logic/start-new-period'
import { StartNewPeriodSchema } from '@/features/incidents/schemas'
import { checkExpensiveRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import { getRequestMeta } from '@/lib/request-meta'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  AUTH_FORBIDDEN,
  INCIDENT_NOT_FOUND,
  PERIOD_START_FAILED,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

// ─── POST /api/incidents/[id]/operational-periods ──────────────────────────

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

  const rateLimit = await checkExpensiveRateLimit(member.organization_id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
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
    return errorResponse(AUTH_FORBIDDEN, 'Only the IC or Planning Section Chief can start a new period')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = StartNewPeriodSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const result = await startNewPeriod(
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
      { data: { periodId: result.periodId, periodNumber: result.periodNumber }, error: null, meta: null },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof StartNewPeriodError) {
      const statusMap: Record<string, number> = {
        INCIDENT_NOT_FOUND: 404,
        START_FAILED: 500,
      }
      return Response.json(
        { data: null, error: { code: err.code, message: err.message }, meta: null },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[POST /api/incidents/[id]/operational-periods] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
