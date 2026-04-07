import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createSubject, CreateSubjectError } from '@/features/incidents/logic/create-subject'
import { CreateSubjectSchema } from '@/features/incidents/schemas'
import { checkAuthenticatedRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import { parseOffsetParams, buildOffsetMeta } from '@/lib/pagination'
import { getRequestMeta } from '@/lib/request-meta'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  AUTH_FORBIDDEN,
  INCIDENT_NOT_FOUND,
  SUBJECT_CREATE_FAILED,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

// Non-PHI columns to select
const SUBJECT_COLUMNS = [
  'id', 'incident_id', 'first_name', 'last_name', 'age', 'gender',
  'height_cm', 'weight_kg', 'physical_description', 'clothing_description',
  'subject_type', 'last_seen_at', 'is_primary', 'found_condition', 'found_at',
  'created_at', 'updated_at',
].join(', ')

// ─── GET /api/incidents/[id]/subjects ──────────────────────────────────────

export async function GET(
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

  // Verify incident belongs to org
  const { data: incident } = await supabase
    .from('incidents')
    .select('id')
    .eq('id', incidentId)
    .eq('organization_id', member.organization_id)
    .is('deleted_at', null)
    .single()

  if (!incident) {
    return errorResponse(INCIDENT_NOT_FOUND, 'Incident not found')
  }

  // Parse offset pagination
  const { page, pageSize } = parseOffsetParams(req.nextUrl.searchParams)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Count total
  const { count } = await supabase
    .from('incident_subjects')
    .select('id', { count: 'exact', head: true })
    .eq('incident_id', incidentId)
    .eq('organization_id', member.organization_id)
    .is('deleted_at', null)

  const totalCount = count ?? 0

  // Fetch page
  const { data: subjects, error: fetchError } = await supabase
    .from('incident_subjects')
    .select(SUBJECT_COLUMNS)
    .eq('incident_id', incidentId)
    .eq('organization_id', member.organization_id)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .range(from, to)

  if (fetchError) {
    console.error('[GET /api/incidents/[id]/subjects] fetch failed:', fetchError.code)
    return errorResponse(INTERNAL_ERROR, 'Failed to fetch subjects')
  }

  return Response.json({
    data: { subjects: subjects ?? [] },
    error: null,
    meta: buildOffsetMeta(page, pageSize, totalCount),
  })
}

// ─── POST /api/incidents/[id]/subjects ─────────────────────────────────────

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

  // Role check: IC or planning_section_chief only
  const { data: personnel } = await supabase
    .from('incident_personnel')
    .select('incident_role')
    .eq('incident_id', incidentId)
    .eq('member_id', member.id)
    .is('checked_out_at', null)
    .single()

  const allowedRoles = ['incident_commander', 'planning_section_chief']
  if (!personnel || !allowedRoles.includes(personnel.incident_role ?? '')) {
    return errorResponse(AUTH_FORBIDDEN, 'Only the IC or Planning Section Chief can add subjects')
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = CreateSubjectSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const result = await createSubject(
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
      { data: { subjectId: result.subjectId }, error: null, meta: null },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof CreateSubjectError) {
      const statusMap: Record<string, number> = {
        INCIDENT_NOT_FOUND: 404,
        CREATE_FAILED: 500,
      }
      return Response.json(
        { data: null, error: { code: err.code, message: err.message }, meta: null },
        { status: statusMap[err.code] ?? 500 },
      )
    }
    console.error('[POST /api/incidents/[id]/subjects] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
