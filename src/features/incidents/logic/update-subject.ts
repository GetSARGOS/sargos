import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { UpdateSubjectInput } from '@/features/incidents/schemas'
import type { RequestMeta } from '@/lib/request-meta'
import { withRetry } from '@/lib/retry'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type UpdateSubjectErrorCode =
  | 'SUBJECT_NOT_FOUND'
  | 'UPDATE_FAILED'

export class UpdateSubjectError extends Error {
  constructor(
    public readonly code: UpdateSubjectErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'UpdateSubjectError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface UpdateSubjectResult {
  subjectId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function updateSubject(
  supabase: SupabaseClient<Database>,
  subjectId: string,
  incidentId: string,
  organizationId: string,
  actorMemberId: string,
  actorName: string,
  actorUserId: string,
  input: UpdateSubjectInput,
  requestMeta?: RequestMeta,
): Promise<UpdateSubjectResult> {
  // Fetch subject — verify it exists, belongs to this incident/org, not deleted
  const { data: existing, error: fetchError } = await supabase
    .from('incident_subjects')
    .select('id, first_name, last_name, is_primary')
    .eq('id', subjectId)
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    throw new UpdateSubjectError('SUBJECT_NOT_FOUND', 'Subject not found')
  }

  // If promoting to primary, clear other primaries
  if (input.isPrimary === true && !existing.is_primary) {
    await supabase
      .from('incident_subjects')
      .update({ is_primary: false })
      .eq('incident_id', incidentId)
      .eq('organization_id', organizationId)
      .eq('is_primary', true)
      .is('deleted_at', null)
  }

  // Build update payload from non-undefined fields (camelCase → snake_case)
  const payload: Record<string, unknown> = {}
  if (input.firstName !== undefined) payload.first_name = input.firstName
  if (input.lastName !== undefined) payload.last_name = input.lastName
  if (input.age !== undefined) payload.age = input.age
  if (input.gender !== undefined) payload.gender = input.gender
  if (input.heightCm !== undefined) payload.height_cm = input.heightCm
  if (input.weightKg !== undefined) payload.weight_kg = input.weightKg
  if (input.physicalDescription !== undefined) payload.physical_description = input.physicalDescription
  if (input.clothingDescription !== undefined) payload.clothing_description = input.clothingDescription
  if (input.subjectType !== undefined) payload.subject_type = input.subjectType
  if (input.lastSeenAt !== undefined) payload.last_seen_at = input.lastSeenAt
  if (input.isPrimary !== undefined) payload.is_primary = input.isPrimary
  if (input.foundCondition !== undefined) payload.found_condition = input.foundCondition
  if (input.foundAt !== undefined) payload.found_at = input.foundAt

  if (Object.keys(payload).length === 0) {
    return { subjectId }
  }

  await withRetry(async () => {
    const { error } = await supabase
      .from('incident_subjects')
      .update(payload)
      .eq('id', subjectId)

    if (error) throw error
  }).catch(() => {
    throw new UpdateSubjectError('UPDATE_FAILED', 'Failed to update subject')
  })

  const displayName = input.firstName ?? existing.first_name
  const displayLast = input.lastName ?? existing.last_name

  // Write incident_log (best-effort)
  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'subject_update',
      message: `Subject "${displayName} ${displayLast}" updated`,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: { subject_id: subjectId },
    })

  if (logError) {
    console.error('[updateSubject] incident_log insert failed:', logError.code)
  }

  // Write audit_log (best-effort)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: actorUserId,
    action: 'incident.subject_updated',
    resource_type: 'incident_subject',
    resource_id: subjectId,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { incident_id: incidentId },
  })

  return { subjectId }
}
