import { createServiceClient } from '@/lib/supabase/service'
import type { CheckInPersonnelInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type CheckInPersonnelErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'ALREADY_CHECKED_IN'
  | 'CHECK_IN_FAILED'

export class CheckInPersonnelError extends Error {
  constructor(
    public readonly code: CheckInPersonnelErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CheckInPersonnelError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface CheckInPersonnelResult {
  personnelId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function checkInPersonnel(
  organizationId: string,
  actorMemberId: string,
  actorDisplayName: string,
  incidentId: string,
  input: CheckInPersonnelInput,
): Promise<CheckInPersonnelResult> {
  const supabase = createServiceClient()

  // Verify incident belongs to this org and is not closed
  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .select('id, name, status')
    .eq('id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (incidentError || !incident) {
    throw new CheckInPersonnelError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  // Verify the member to check in belongs to the same org
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id, display_name')
    .eq('id', input.memberId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single()

  if (memberError || !member) {
    throw new CheckInPersonnelError('MEMBER_NOT_FOUND', 'Member not found in this organization')
  }

  // Check if member is already checked in (no checkout yet)
  const { data: existing } = await supabase
    .from('incident_personnel')
    .select('id')
    .eq('incident_id', incidentId)
    .eq('member_id', input.memberId)
    .is('checked_out_at', null)
    .maybeSingle()

  if (existing) {
    throw new CheckInPersonnelError('ALREADY_CHECKED_IN', 'Member is already checked in to this incident')
  }

  // Insert personnel record
  const { data: personnel, error: personnelError } = await supabase
    .from('incident_personnel')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      member_id: input.memberId,
      personnel_type: 'member',
      checkin_method: 'manual',
      status: 'available',
      incident_role: input.incidentRole ?? 'field_member',
    })
    .select('id')
    .single()

  if (personnelError || !personnel) {
    console.error('[checkInPersonnel] insert failed:', personnelError?.code)
    throw new CheckInPersonnelError('CHECK_IN_FAILED', 'Failed to check in personnel')
  }

  // If a PAR roll call is currently active, include the new person in the denominator
  // so the count stays accurate. The Realtime UPDATE on incident_par_events propagates
  // to all clients, matching the behaviour on the checkout path.
  const { data: activePar } = await supabase
    .from('incident_par_events')
    .select('id, total_personnel')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .is('completed_at', null)
    .maybeSingle()

  if (activePar) {
    await supabase
      .from('incident_par_events')
      .update({ total_personnel: activePar.total_personnel + 1 })
      .eq('id', activePar.id)
  }

  // Append incident log entry
  await supabase.from('incident_log').insert({
    incident_id: incidentId,
    organization_id: organizationId,
    entry_type: 'personnel_checkin',
    message: `${member.display_name} checked in`,
    actor_id: actorMemberId,
    actor_name: actorDisplayName,
    metadata: { personnel_id: personnel.id, member_id: input.memberId },
  })

  return { personnelId: personnel.id }
}
