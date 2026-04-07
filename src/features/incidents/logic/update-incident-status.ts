import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { UpdateIncidentStatusInput } from '@/features/incidents/schemas'
import type { RequestMeta } from '@/lib/request-meta'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type UpdateIncidentStatusErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'ALREADY_IN_STATUS'
  | 'INVALID_TRANSITION'
  | 'UPDATE_FAILED'

export class UpdateIncidentStatusError extends Error {
  constructor(
    public readonly code: UpdateIncidentStatusErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'UpdateIncidentStatusError'
  }
}

// ─── Valid Transitions ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  planning: ['active'],
  active: ['suspended', 'closed'],
  suspended: ['active', 'closed'],
  closed: [], // terminal state
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface UpdateIncidentStatusResult {
  incidentId: string
  previousStatus: string
  newStatus: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function updateIncidentStatus(
  supabase: SupabaseClient<Database>,
  incidentId: string,
  organizationId: string,
  actorUserId: string,
  input: UpdateIncidentStatusInput,
  requestMeta?: RequestMeta,
): Promise<UpdateIncidentStatusResult> {
  // Fetch the incident
  const { data: incident, error: fetchError } = await supabase
    .from('incidents')
    .select('id, status, name, organization_id')
    .eq('id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !incident) {
    throw new UpdateIncidentStatusError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  const previousStatus = incident.status
  const newStatus = input.status

  // Check: already in target status
  if (previousStatus === newStatus) {
    throw new UpdateIncidentStatusError('ALREADY_IN_STATUS', `Incident is already ${newStatus}`)
  }

  // Check: valid transition
  const allowed = VALID_TRANSITIONS[previousStatus] ?? []
  if (!allowed.includes(newStatus)) {
    throw new UpdateIncidentStatusError(
      'INVALID_TRANSITION',
      `Cannot transition from ${previousStatus} to ${newStatus}`,
    )
  }

  // Look up actor's member record for logging
  const { data: member } = await supabase
    .from('organization_members')
    .select('id, display_name')
    .eq('organization_id', organizationId)
    .eq('user_id', actorUserId)
    .eq('is_active', true)
    .single()

  const actorMemberId = member?.id ?? null
  const actorName = member?.display_name ?? 'Unknown'

  // Build the update payload
  const updatePayload: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'suspended') {
    updatePayload.suspended_at = new Date().toISOString()
  } else if (newStatus === 'active' && previousStatus === 'suspended') {
    // Resuming from suspended — clear suspended_at
    updatePayload.suspended_at = null
  } else if (newStatus === 'closed') {
    updatePayload.closed_at = new Date().toISOString()
    if (input.afterActionNotes) {
      updatePayload.after_action_notes = input.afterActionNotes
    }
  }

  // Perform the update
  const { error: updateError } = await supabase
    .from('incidents')
    .update(updatePayload)
    .eq('id', incidentId)

  if (updateError) {
    console.error('[updateIncidentStatus] update failed:', updateError.code)
    throw new UpdateIncidentStatusError('UPDATE_FAILED', 'Failed to update incident status')
  }

  // ─── Closure Checklist (best-effort, each operation independent) ─────────
  if (newStatus === 'closed') {
    // 1. Deactivate all QR tokens
    try {
      await supabase
        .from('incident_qr_tokens')
        .update({ is_active: false })
        .eq('incident_id', incidentId)
        .eq('is_active', true)
    } catch (err) {
      console.error('[updateIncidentStatus] QR token deactivation failed:', err)
    }

    // 2. Auto-checkout all remaining personnel
    try {
      await supabase
        .from('incident_personnel')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('incident_id', incidentId)
        .is('checked_out_at', null)
    } catch (err) {
      console.error('[updateIncidentStatus] personnel auto-checkout failed:', err)
    }

    // 3. Close current operational period
    try {
      await supabase
        .from('operational_periods')
        .update({ ends_at: new Date().toISOString() })
        .eq('incident_id', incidentId)
        .eq('organization_id', organizationId)
        .is('ends_at', null)
    } catch (err) {
      console.error('[updateIncidentStatus] period close failed:', err)
    }
  }

  // Write incident_log entry
  const statusMessage = newStatus === 'active' && previousStatus === 'suspended'
    ? `Incident resumed by ${actorName}`
    : newStatus === 'suspended'
      ? `Incident suspended by ${actorName}`
      : `Incident closed by ${actorName}`

  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'incident_status_change',
      message: statusMessage,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: { previous_status: previousStatus, new_status: newStatus },
    })

  if (logError) {
    console.error('[updateIncidentStatus] log insert failed:', logError.code)
  }

  // Audit log (best-effort)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: actorUserId,
    action: `incident.${newStatus}`,
    resource_type: 'incident',
    resource_id: incidentId,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { previous_status: previousStatus, new_status: newStatus },
  })

  return { incidentId, previousStatus, newStatus }
}
