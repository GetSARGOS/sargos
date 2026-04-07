import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateSubject, UpdateSubjectError } from '@/features/incidents/logic/update-subject'
import { deleteSubject, DeleteSubjectError } from '@/features/incidents/logic/delete-subject'
import { UpdateSubjectSchema } from '@/features/incidents/schemas'
import { checkAuthenticatedRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import { getRequestMeta } from '@/lib/request-meta'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  AUTH_FORBIDDEN,
  SUBJECT_NOT_FOUND,
  SUBJECT_UPDATE_FAILED,
  SUBJECT_DELETE_FAILED,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

type RouteContext = { params: Promise<{ id: string; subjectId: string }> }

const ALLOWED_ROLES = ['incident_commander', 'planning_section_chief']

// ─── PATCH /api/incidents/[id]/subjects/[subjectId] ────────────────────────

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<Response> {
  const { id: incidentId, subjectId } = await ctx.params
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
    .select('id, organization_id, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return errorResponse(AUTH_NO_ORGANIZATION, 'No active organization membership')
  }

  // Role check
  const { data: personnel } = await supabase
    .from('incident_personnel')
    .select('incident_role')
    .eq('incident_id', incidentId)
    .eq('member_id', member.id)
    .is('checked_out_at', null)
    .single()

  if (!personnel || !ALLOWED_ROLES.includes(personnel.incident_role ?? '')) {
    return errorResponse(AUTH_FORBIDDEN, 'Only the IC or Planning Section Chief can edit subjects')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = UpdateSubjectSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const result = await updateSubject(
      serviceClient,
      subjectId,
      incidentId,
      member.organization_id,
      member.id,
      member.display_name,
      user.id,
      parsed.data,
      getRequestMeta(req),
    )

    return Response.json(
      { data: { subjectId: result.subjectId }, error: null, meta: null },
    )
  } catch (err) {
    if (err instanceof UpdateSubjectError) {
      const errorMap: Record<string, { code: typeof SUBJECT_NOT_FOUND | typeof SUBJECT_UPDATE_FAILED }> = {
        SUBJECT_NOT_FOUND: { code: SUBJECT_NOT_FOUND },
        UPDATE_FAILED: { code: SUBJECT_UPDATE_FAILED },
      }
      const mapped = errorMap[err.code]
      if (mapped) {
        return errorResponse(mapped.code, err.message)
      }
    }
    console.error('[PATCH /api/incidents/[id]/subjects/[subjectId]] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}

// ─── DELETE /api/incidents/[id]/subjects/[subjectId] ───────────────────────

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<Response> {
  const { id: incidentId, subjectId } = await ctx.params
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
    .select('id, organization_id, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return errorResponse(AUTH_NO_ORGANIZATION, 'No active organization membership')
  }

  // Role check
  const { data: personnel } = await supabase
    .from('incident_personnel')
    .select('incident_role')
    .eq('incident_id', incidentId)
    .eq('member_id', member.id)
    .is('checked_out_at', null)
    .single()

  if (!personnel || !ALLOWED_ROLES.includes(personnel.incident_role ?? '')) {
    return errorResponse(AUTH_FORBIDDEN, 'Only the IC or Planning Section Chief can remove subjects')
  }

  try {
    const serviceClient = createServiceClient()
    await deleteSubject(
      serviceClient,
      subjectId,
      incidentId,
      member.organization_id,
      member.id,
      member.display_name,
      user.id,
      getRequestMeta(_req),
    )

    return Response.json(
      { data: { deleted: true }, error: null, meta: null },
    )
  } catch (err) {
    if (err instanceof DeleteSubjectError) {
      const errorMap: Record<string, { code: typeof SUBJECT_NOT_FOUND | typeof SUBJECT_DELETE_FAILED }> = {
        SUBJECT_NOT_FOUND: { code: SUBJECT_NOT_FOUND },
        DELETE_FAILED: { code: SUBJECT_DELETE_FAILED },
      }
      const mapped = errorMap[err.code]
      if (mapped) {
        return errorResponse(mapped.code, err.message)
      }
    }
    console.error('[DELETE /api/incidents/[id]/subjects/[subjectId]] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
