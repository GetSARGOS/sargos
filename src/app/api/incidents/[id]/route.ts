import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  updateIncidentStatus,
  UpdateIncidentStatusError,
} from '@/features/incidents/logic/update-incident-status'
import { UpdateIncidentStatusSchema } from '@/features/incidents/schemas'
import { checkExpensiveRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import { getRequestMeta } from '@/lib/request-meta'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  INCIDENT_NOT_FOUND,
  INCIDENT_ALREADY_CLOSED,
  INCIDENT_INVALID_TRANSITION,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

// ─── PATCH /api/incidents/[id] ───────────────────────────────────────────────
// Update incident status (suspend, resume, close).

export async function PATCH(
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
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return errorResponse(AUTH_NO_ORGANIZATION, 'No active organization membership')
  }

  // Rate limit: 20 req/min per org (status changes are expensive)
  const rateLimit = await checkExpensiveRateLimit(member.organization_id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = UpdateIncidentStatusSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const result = await updateIncidentStatus(
      serviceClient,
      incidentId,
      member.organization_id,
      user.id,
      parsed.data,
      getRequestMeta(req),
    )

    return Response.json({
      data: result,
      error: null,
      meta: null,
    })
  } catch (err) {
    if (err instanceof UpdateIncidentStatusError) {
      switch (err.code) {
        case 'INCIDENT_NOT_FOUND':
          return errorResponse(INCIDENT_NOT_FOUND, err.message)
        case 'ALREADY_IN_STATUS':
          return errorResponse(INCIDENT_ALREADY_CLOSED, err.message)
        case 'INVALID_TRANSITION':
          return errorResponse(INCIDENT_INVALID_TRANSITION, err.message)
        case 'UPDATE_FAILED':
          return errorResponse(INTERNAL_ERROR, err.message)
      }
    }
    console.error('[PATCH /api/incidents/[id]] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
