import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assignRole, AssignRoleError } from '@/features/incidents/logic/assign-role'
import { AssignRoleSchema } from '@/features/incidents/schemas'
import { checkExpensiveRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import { getRequestMeta } from '@/lib/request-meta'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  AUTH_FORBIDDEN,
  INCIDENT_NOT_FOUND,
  ROLE_ASSIGNMENT_FAILED,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

// ─── POST /api/incidents/[id]/command-structure ────────────────────────────

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

  // Rate limit: expensive operation (20/min per org)
  const rateLimit = await checkExpensiveRateLimit(member.organization_id)
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit.reset)
  }

  // Role check: IC only
  const { data: personnel } = await supabase
    .from('incident_personnel')
    .select('incident_role')
    .eq('incident_id', incidentId)
    .eq('member_id', member.id)
    .is('checked_out_at', null)
    .single()

  if (!personnel || personnel.incident_role !== 'incident_commander') {
    return errorResponse(AUTH_FORBIDDEN, 'Only the Incident Commander can assign roles')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = AssignRoleSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const result = await assignRole(
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
      { data: { commandStructureId: result.commandStructureId }, error: null, meta: null },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof AssignRoleError) {
      const statusMap: Record<string, number> = {
        INCIDENT_NOT_FOUND: 404,
        MEMBER_NOT_CHECKED_IN: 422,
        ASSIGNMENT_FAILED: 500,
      }
      return Response.json(
        { data: null, error: { code: err.code, message: err.message }, meta: null },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[POST /api/incidents/[id]/command-structure] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
