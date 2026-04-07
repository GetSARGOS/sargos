import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { RequestMeta } from '@/lib/request-meta'
import { withRetry } from '@/lib/retry'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type DeleteSubjectErrorCode =
  | 'SUBJECT_NOT_FOUND'
  | 'DELETE_FAILED'

export class DeleteSubjectError extends Error {
  constructor(
    public readonly code: DeleteSubjectErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DeleteSubjectError'
  }
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function deleteSubject(
  supabase: SupabaseClient<Database>,
  subjectId: string,
  incidentId: string,
  organizationId: string,
  actorMemberId: string,
  actorName: string,
  actorUserId: string,
  requestMeta?: RequestMeta,
): Promise<{ deleted: boolean }> {
  // Fetch subject — verify exists, not already deleted
  const { data: existing, error: fetchError } = await supabase
    .from('incident_subjects')
    .select('id, first_name, last_name, is_primary')
    .eq('id', subjectId)
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    throw new DeleteSubjectError('SUBJECT_NOT_FOUND', 'Subject not found')
  }

  // Soft-delete
  await withRetry(async () => {
    const { error } = await supabase
      .from('incident_subjects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', subjectId)

    if (error) throw error
  }).catch(() => {
    throw new DeleteSubjectError('DELETE_FAILED', 'Failed to delete subject')
  })

  // If deleted subject was primary, promote the next subject
  if (existing.is_primary) {
    const { data: next } = await supabase
      .from('incident_subjects')
      .select('id')
      .eq('incident_id', incidentId)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (next) {
      await supabase
        .from('incident_subjects')
        .update({ is_primary: true })
        .eq('id', next.id)
    }
  }

  // Write incident_log (best-effort)
  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'subject_update',
      message: `Subject "${existing.first_name} ${existing.last_name}" removed`,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: { subject_id: subjectId },
    })

  if (logError) {
    console.error('[deleteSubject] incident_log insert failed:', logError.code)
  }

  // Write audit_log (best-effort)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: actorUserId,
    action: 'incident.subject_deleted',
    resource_type: 'incident_subject',
    resource_id: subjectId,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { incident_id: incidentId, subject_name: `${existing.first_name} ${existing.last_name}` },
  })

  return { deleted: true }
}
