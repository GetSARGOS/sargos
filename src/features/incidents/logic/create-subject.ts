import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { CreateSubjectInput } from '@/features/incidents/schemas'
import type { RequestMeta } from '@/lib/request-meta'
import { withRetry } from '@/lib/retry'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type CreateSubjectErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'CREATE_FAILED'

export class CreateSubjectError extends Error {
  constructor(
    public readonly code: CreateSubjectErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CreateSubjectError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface CreateSubjectResult {
  subjectId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function createSubject(
  supabase: SupabaseClient<Database>,
  incidentId: string,
  organizationId: string,
  actorMemberId: string,
  actorName: string,
  actorUserId: string,
  input: CreateSubjectInput,
  requestMeta?: RequestMeta,
): Promise<CreateSubjectResult> {
  // Verify incident exists in org and is not closed
  const { data: incident, error: fetchError } = await supabase
    .from('incidents')
    .select('id, status')
    .eq('id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !incident) {
    throw new CreateSubjectError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  // Determine is_primary: explicit flag or auto-set if first subject
  let isPrimary = input.isPrimary ?? false
  if (!isPrimary) {
    const { count } = await supabase
      .from('incident_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('incident_id', incidentId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)

    if (count === 0) {
      isPrimary = true
    }
  }

  // If setting as primary, clear other primaries
  if (isPrimary) {
    await supabase
      .from('incident_subjects')
      .update({ is_primary: false })
      .eq('incident_id', incidentId)
      .eq('organization_id', organizationId)
      .eq('is_primary', true)
      .is('deleted_at', null)
  }

  // Insert subject
  const subject = await withRetry(async () => {
    const { data, error } = await supabase
      .from('incident_subjects')
      .insert({
        incident_id: incidentId,
        organization_id: organizationId,
        first_name: input.firstName,
        last_name: input.lastName,
        age: input.age ?? null,
        gender: input.gender ?? null,
        height_cm: input.heightCm ?? null,
        weight_kg: input.weightKg ?? null,
        physical_description: input.physicalDescription ?? null,
        clothing_description: input.clothingDescription ?? null,
        subject_type: input.subjectType ?? null,
        last_seen_at: input.lastSeenAt ?? null,
        is_primary: isPrimary,
      })
      .select('id')
      .single()

    if (error || !data) throw error ?? new Error('No data returned')
    return data
  }).catch(() => {
    throw new CreateSubjectError('CREATE_FAILED', 'Failed to create subject')
  })

  // Write incident_log (best-effort)
  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'subject_update',
      message: `Subject "${input.firstName} ${input.lastName}" added`,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: { subject_id: subject.id, subject_type: input.subjectType ?? null },
    })

  if (logError) {
    console.error('[createSubject] incident_log insert failed:', logError.code)
  }

  // Write audit_log (best-effort)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: actorUserId,
    action: 'incident.subject_created',
    resource_type: 'incident_subject',
    resource_id: subject.id,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { incident_id: incidentId, subject_name: `${input.firstName} ${input.lastName}` },
  })

  return { subjectId: subject.id }
}
