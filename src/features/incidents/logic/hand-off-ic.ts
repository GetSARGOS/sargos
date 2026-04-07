import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { HandOffIcInput } from '@/features/incidents/schemas'
import type { RequestMeta } from '@/lib/request-meta'
import { withRetry } from '@/lib/retry'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type HandOffIcErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'NOT_CURRENT_IC'
  | 'NEW_IC_NOT_CHECKED_IN'
  | 'HANDOFF_FAILED'

export class HandOffIcError extends Error {
  constructor(
    public readonly code: HandOffIcErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'HandOffIcError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface HandOffIcResult {
  newIcCommandStructureId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function handOffIc(
  supabase: SupabaseClient<Database>,
  incidentId: string,
  organizationId: string,
  actorMemberId: string,
  actorName: string,
  actorUserId: string,
  input: HandOffIcInput,
  requestMeta?: RequestMeta,
): Promise<HandOffIcResult> {
  // Verify incident exists in org and is not closed
  const { data: incident, error: incErr } = await supabase
    .from('incidents')
    .select('id, status')
    .eq('id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (incErr || !incident) {
    throw new HandOffIcError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  // Verify actor is the current IC
  const { data: currentIcRecord } = await supabase
    .from('incident_command_structure')
    .select('id, member_id')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .eq('ics_role', 'incident_commander')
    .eq('member_id', actorMemberId)
    .is('relieved_at', null)
    .single()

  if (!currentIcRecord) {
    throw new HandOffIcError('NOT_CURRENT_IC', 'Only the current Incident Commander can hand off')
  }

  // Verify new IC is checked into this incident
  const { data: newIcPersonnel } = await supabase
    .from('incident_personnel')
    .select('id, member_id')
    .eq('incident_id', incidentId)
    .eq('member_id', input.newIcMemberId)
    .is('checked_out_at', null)
    .single()

  if (!newIcPersonnel) {
    throw new HandOffIcError('NEW_IC_NOT_CHECKED_IN', 'New IC is not checked into this incident')
  }

  // Resolve new IC's display name
  const { data: newIcMember } = await supabase
    .from('organization_members')
    .select('display_name')
    .eq('id', input.newIcMemberId)
    .single()

  const newIcName = newIcMember?.display_name ?? 'Unknown'

  // Relieve old IC's command structure record
  await supabase
    .from('incident_command_structure')
    .update({ relieved_at: new Date().toISOString() })
    .eq('id', currentIcRecord.id)

  // Relieve any OTHER active command roles the new IC currently holds.
  // A member holds at most one command role at a time — promoting them to IC
  // must vacate any previous role (e.g. Operations Section Chief).
  const { data: newIcOtherRoles } = await supabase
    .from('incident_command_structure')
    .select('id')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .eq('member_id', input.newIcMemberId)
    .neq('ics_role', 'incident_commander')
    .is('relieved_at', null)

  if (newIcOtherRoles && newIcOtherRoles.length > 0) {
    await supabase
      .from('incident_command_structure')
      .update({ relieved_at: new Date().toISOString() })
      .in('id', newIcOtherRoles.map((r) => r.id))
  }

  // Insert new IC command structure record
  const inserted = await withRetry(async () => {
    const { data, error } = await supabase
      .from('incident_command_structure')
      .insert({
        incident_id: incidentId,
        organization_id: organizationId,
        member_id: input.newIcMemberId,
        ics_role: 'incident_commander',
      })
      .select('id')
      .single()

    if (error || !data) throw error ?? new Error('No data returned')
    return data
  }).catch(() => {
    throw new HandOffIcError('HANDOFF_FAILED', 'Failed to complete IC hand-off')
  })

  // Update new IC's personnel role
  await supabase
    .from('incident_personnel')
    .update({ incident_role: 'incident_commander' })
    .eq('incident_id', incidentId)
    .eq('member_id', input.newIcMemberId)
    .is('checked_out_at', null)

  // Update old IC's personnel — outgoingIcNewRole maps:
  //   'field_member' → incident_role = 'field_member'
  //   'observer' → incident_role = 'observer'
  //   'stood_down' → incident_role = 'field_member' AND status = 'stood_down'
  const oldIcUpdate: Record<string, unknown> = {}
  if (input.outgoingIcNewRole === 'stood_down') {
    oldIcUpdate.incident_role = 'field_member'
    oldIcUpdate.status = 'stood_down'
  } else {
    oldIcUpdate.incident_role = input.outgoingIcNewRole
  }

  await supabase
    .from('incident_personnel')
    .update(oldIcUpdate)
    .eq('incident_id', incidentId)
    .eq('member_id', actorMemberId)
    .is('checked_out_at', null)

  // Write incident_log (best-effort)
  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'role_assigned',
      message: `IC transferred from ${actorName} to ${newIcName}`,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: {
        previous_ic_member_id: actorMemberId,
        new_ic_member_id: input.newIcMemberId,
        outgoing_role: input.outgoingIcNewRole,
      },
    })

  if (logError) {
    console.error('[handOffIc] incident_log insert failed:', logError.code)
  }

  // Write audit_log (best-effort)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: actorUserId,
    action: 'incident.ic_handoff',
    resource_type: 'incident_command_structure',
    resource_id: inserted.id,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: {
      incident_id: incidentId,
      previous_ic_member_id: actorMemberId,
      new_ic_member_id: input.newIcMemberId,
    },
  })

  return { newIcCommandStructureId: inserted.id }
}
