import { createServiceClient } from '@/lib/supabase/service'
import type { UpdatePersonnelInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type UpdatePersonnelStatusErrorCode =
  | 'PERSONNEL_NOT_FOUND'
  | 'UPDATE_FAILED'

export class UpdatePersonnelStatusError extends Error {
  constructor(
    public readonly code: UpdatePersonnelStatusErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'UpdatePersonnelStatusError'
  }
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function updatePersonnelStatus(
  organizationId: string,
  actorMemberId: string,
  actorDisplayName: string,
  personnelId: string,
  input: UpdatePersonnelInput,
): Promise<{ updated: boolean }> {
  const supabase = createServiceClient()

  // Verify this personnel record belongs to the caller's org
  const { data: personnel, error: fetchError } = await supabase
    .from('incident_personnel')
    .select('id, incident_id, status, incident_role, member_id')
    .eq('id', personnelId)
    .eq('organization_id', organizationId)
    .single()

  if (fetchError || !personnel) {
    throw new UpdatePersonnelStatusError('PERSONNEL_NOT_FOUND', 'Personnel record not found')
  }

  // Build the update payload from whichever fields were provided
  const updatePayload: Record<string, unknown> = {}
  if (input.status !== undefined) {
    updatePayload['status'] = input.status
  }
  if (input.incidentRole !== undefined) {
    updatePayload['incident_role'] = input.incidentRole
  }
  if (input.checkout === true) {
    updatePayload['checked_out_at'] = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('incident_personnel')
    .update(updatePayload)
    .eq('id', personnelId)

  if (updateError) {
    console.error('[updatePersonnelStatus] update failed:', updateError.code)
    throw new UpdatePersonnelStatusError('UPDATE_FAILED', 'Failed to update personnel record')
  }

  // If checking out, adjust any active PAR event so the denominator and confirmed_count
  // stay correct. The Realtime UPDATE on incident_par_events propagates to all clients.
  if (input.checkout === true) {
    const { data: activePar } = await supabase
      .from('incident_par_events')
      .select('id, total_personnel')
      .eq('incident_id', personnel.incident_id)
      .eq('organization_id', organizationId)
      .is('completed_at', null)
      .maybeSingle()

    if (activePar) {
      // Remove the person's PAR response (if any) so confirmed_count stays accurate
      await supabase
        .from('incident_par_responses')
        .delete()
        .eq('par_event_id', activePar.id)
        .eq('personnel_id', personnelId)

      // Recalculate confirmed_count from the remaining responses
      const { count: remainingCount } = await supabase
        .from('incident_par_responses')
        .select('id', { count: 'exact', head: true })
        .eq('par_event_id', activePar.id)

      const newTotal = activePar.total_personnel - 1
      const newConfirmedCount = remainingCount ?? 0
      const isComplete = newTotal > 0 && newConfirmedCount >= newTotal

      const parUpdatePayload: Record<string, unknown> = {
        total_personnel: newTotal,
        confirmed_count: newConfirmedCount,
      }
      if (isComplete) {
        parUpdatePayload['completed_at'] = new Date().toISOString()
      }

      await supabase
        .from('incident_par_events')
        .update(parUpdatePayload)
        .eq('id', activePar.id)
    }
  }

  // Write the appropriate incident log entry
  if (input.checkout === true) {
    await supabase.from('incident_log').insert({
      incident_id: personnel.incident_id,
      organization_id: organizationId,
      entry_type: 'personnel_checkout',
      message: `Personnel checked out`,
      actor_id: actorMemberId,
      actor_name: actorDisplayName,
      metadata: { personnel_id: personnelId },
    })
  } else if (input.incidentRole !== undefined) {
    await supabase.from('incident_log').insert({
      incident_id: personnel.incident_id,
      organization_id: organizationId,
      entry_type: 'role_assigned',
      message: `Incident role updated to ${input.incidentRole ?? 'none'}`,
      actor_id: actorMemberId,
      actor_name: actorDisplayName,
      metadata: {
        personnel_id: personnelId,
        previous_role: personnel.incident_role,
        new_role: input.incidentRole,
      },
    })
  } else if (input.status !== undefined) {
    await supabase.from('incident_log').insert({
      incident_id: personnel.incident_id,
      organization_id: organizationId,
      entry_type: 'personnel_status_change',
      message: `Personnel status changed from ${personnel.status} to ${input.status}`,
      actor_id: actorMemberId,
      actor_name: actorDisplayName,
      metadata: {
        personnel_id: personnelId,
        previous_status: personnel.status,
        new_status: input.status,
      },
    })
  }

  return { updated: true }
}
