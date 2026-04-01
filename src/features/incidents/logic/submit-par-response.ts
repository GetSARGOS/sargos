import { createServiceClient } from '@/lib/supabase/service'
import type { SubmitParResponseInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type SubmitParResponseErrorCode =
  | 'PAR_EVENT_NOT_FOUND'
  | 'PAR_ALREADY_COMPLETED'
  | 'PERSONNEL_NOT_FOUND'
  | 'DB_ERROR'

export class SubmitParResponseError extends Error {
  constructor(
    public readonly code: SubmitParResponseErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SubmitParResponseError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface SubmitParResponseResult {
  responded: boolean
  parCompleted: boolean
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function submitParResponse(
  organizationId: string,
  incidentId: string,
  parEventId: string,
  actorMemberId: string,
  actorName: string,
  input: SubmitParResponseInput,
): Promise<SubmitParResponseResult> {
  const supabase = createServiceClient()

  // Verify the PAR event belongs to this incident / org and is not completed
  const { data: parEvent, error: parError } = await supabase
    .from('incident_par_events')
    .select('id, total_personnel, confirmed_count, completed_at')
    .eq('id', parEventId)
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (parError || !parEvent) {
    console.error('[submitParResponse] PAR_EVENT_NOT_FOUND', { parEventId, incidentId, organizationId, dbError: parError?.code ?? null })
    throw new SubmitParResponseError('PAR_EVENT_NOT_FOUND', 'PAR event not found')
  }

  if (parEvent.completed_at !== null) {
    throw new SubmitParResponseError('PAR_ALREADY_COMPLETED', 'This PAR has already been completed')
  }

  // Verify the personnel record exists and belongs to this incident / org
  const { data: personnel, error: personnelError } = await supabase
    .from('incident_personnel')
    .select('id')
    .eq('id', input.personnelId)
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .is('checked_out_at', null)
    .maybeSingle()

  if (personnelError || !personnel) {
    console.error('[submitParResponse] PERSONNEL_NOT_FOUND', { personnelId: input.personnelId, incidentId, organizationId, dbError: personnelError?.code ?? null })
    throw new SubmitParResponseError('PERSONNEL_NOT_FOUND', 'Personnel record not found or already checked out')
  }

  // Upsert the response — if the person already responded, update it
  const { error: upsertError } = await supabase
    .from('incident_par_responses')
    .upsert(
      {
        par_event_id: parEventId,
        incident_id: incidentId,
        organization_id: organizationId,
        personnel_id: input.personnelId,
        confirmed_safe: input.confirmedSafe,
        notes: input.notes ?? null,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'par_event_id,personnel_id' },
    )

  if (upsertError) {
    console.error('[submitParResponse] upsert failed:', upsertError.code)
    throw new SubmitParResponseError('DB_ERROR', 'Failed to record response')
  }

  // Update last_checked_in_at on the personnel record (PAR confirmation counts as a check-in ping)
  await supabase
    .from('incident_personnel')
    .update({ last_checked_in_at: new Date().toISOString() })
    .eq('id', input.personnelId)

  // Recalculate confirmed_count from the response table (safer than increment — handles re-submissions)
  const { count: responseCount } = await supabase
    .from('incident_par_responses')
    .select('id', { count: 'exact', head: true })
    .eq('par_event_id', parEventId)

  const newConfirmedCount = responseCount ?? 0

  // Re-count active personnel so personnel who check in AFTER the PAR was initiated are
  // included in the denominator. parEvent.total_personnel is set at initiation time and is
  // never updated in the DB when new check-ins arrive — only client state tracks that.
  // Using the live count prevents a premature PAR completion (1 >= 1 = true) when the
  // real denominator is 2 because a second person joined after initiation.
  const { count: liveCount } = await supabase
    .from('incident_personnel')
    .select('id', { count: 'exact', head: true })
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .is('checked_out_at', null)

  const effectiveTotal = liveCount ?? parEvent.total_personnel

  // Check if all personnel have responded
  const isComplete = newConfirmedCount >= effectiveTotal

  // Always write effectiveTotal back so the DB and all clients stay in sync.
  const updatePayload: Record<string, unknown> = { confirmed_count: newConfirmedCount, total_personnel: effectiveTotal }
  if (isComplete) {
    updatePayload['completed_at'] = new Date().toISOString()
    // No unaccounted_ids needed — everyone responded
    updatePayload['unaccounted_ids'] = []
  }

  const { error: updateError } = await supabase
    .from('incident_par_events')
    .update(updatePayload)
    .eq('id', parEventId)

  if (updateError) {
    console.error('[submitParResponse] par_event update failed:', updateError.code)
    // Non-fatal — response was recorded, count update failed
  }

  // Write par_completed log entry when the PAR closes
  if (isComplete) {
    await supabase.from('incident_log').insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'par_completed',
      message: `PAR completed — ${newConfirmedCount}/${effectiveTotal} personnel accounted for`,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: {
        par_event_id: parEventId,
        confirmed_count: newConfirmedCount,
        total_personnel: effectiveTotal,
      },
    })
  }

  return { responded: true, parCompleted: isComplete }
}
