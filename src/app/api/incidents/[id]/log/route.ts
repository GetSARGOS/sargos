import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { addLogEntry, AddLogEntryError } from '@/features/incidents/logic/add-log-entry'
import { AddLogEntrySchema, LOG_ENTRY_TYPES, type LogEntryType } from '@/features/incidents/schemas'
import { checkAuthenticatedRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'
import {
  parseCursorParams,
  decodeCursor,
  buildCursorMeta,
  encodeCursor,
} from '@/lib/pagination'
import {
  errorResponse,
  AUTH_UNAUTHORIZED,
  AUTH_NO_ORGANIZATION,
  INCIDENT_NOT_FOUND,
  LOG_ENTRY_FAILED,
  VALIDATION_FAILED,
  VALIDATION_INVALID_JSON,
  INTERNAL_ERROR,
} from '@/constants/error-codes'

// ─── GET /api/incidents/[id]/log ─────────────────────────────────────────────
// Cursor-based pagination. Default limit: 50.

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

  // Verify the incident belongs to this org
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

  // Parse pagination + optional type filter
  const searchParams = req.nextUrl.searchParams
  const { cursor, limit } = parseCursorParams(searchParams, { limit: 50 })
  const typeFilter = searchParams.get('type')

  // Build query
  let query = supabase
    .from('incident_log')
    .select('id, incident_id, entry_type, message, actor_id, actor_name, created_at, metadata')
    .eq('incident_id', incidentId)
    .eq('organization_id', member.organization_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1) // fetch one extra to detect hasMore

  // Apply type filter
  if (typeFilter && (LOG_ENTRY_TYPES as readonly string[]).includes(typeFilter)) {
    query = query.eq('entry_type', typeFilter)
  }

  // Apply cursor
  if (cursor) {
    const decoded = decodeCursor(cursor)
    if (decoded) {
      // For descending order: get items older than cursor
      query = query.or(`created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`)
    }
  }

  const { data: rows, error: fetchError } = await query

  if (fetchError) {
    console.error('[GET /api/incidents/[id]/log] fetch failed:', fetchError.code)
    return errorResponse(INTERNAL_ERROR, 'Failed to fetch log entries')
  }

  const entries = rows ?? []
  const hasMore = entries.length > limit
  const pageEntries = hasMore ? entries.slice(0, limit) : entries

  // Build cursor from last returned entry
  const lastEntry = pageEntries[pageEntries.length - 1]
  const nextCursor = lastEntry ? encodeCursor(lastEntry.created_at, lastEntry.id) : null

  return Response.json({
    data: { entries: pageEntries },
    error: null,
    meta: { cursor: nextCursor, hasMore },
  })
}

// ─── POST /api/incidents/[id]/log ────────────────────────────────────────────
// Add a narrative log entry.

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

  // Rate limit: 60 req/min per user
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

  // Verify incident exists and belongs to org
  const { data: incident } = await supabase
    .from('incidents')
    .select('id, status')
    .eq('id', incidentId)
    .eq('organization_id', member.organization_id)
    .is('deleted_at', null)
    .single()

  if (!incident) {
    return errorResponse(INCIDENT_NOT_FOUND, 'Incident not found')
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(VALIDATION_INVALID_JSON, 'Request body must be valid JSON')
  }

  const parsed = AddLogEntrySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues: parsed.error.issues })
  }

  try {
    const serviceClient = createServiceClient()
    const entry = await addLogEntry(
      serviceClient,
      incidentId,
      member.organization_id,
      member.id,
      member.display_name,
      parsed.data,
    )

    return Response.json(
      { data: { entry }, error: null, meta: null },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof AddLogEntryError) {
      return errorResponse(LOG_ENTRY_FAILED, err.message)
    }
    console.error('[POST /api/incidents/[id]/log] unexpected error:', err)
    return errorResponse(INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
