import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { AssignRoleInput } from '@/features/incidents/schemas'
import type { RequestMeta } from '@/lib/request-meta'
import { withRetry } from '@/lib/retry'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type AssignRoleErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'MEMBER_NOT_CHECKED_IN'
  | 'ASSIGNMENT_FAILED'

export class AssignRoleError extends Error {
  constructor(
    public readonly code: AssignRoleErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AssignRoleError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface AssignRoleResult {
  commandStructureId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function assignRole(
  supabase: SupabaseClient<Database>,
  incidentId: string,
  organizationId: string,
  actorMemberId: string,
  actorName: string,
  actorUserId: string,
  input: AssignRoleInput,
  requestMeta?: RequestMeta,
): Promise<AssignRoleResult> {
  // Verify incident exists in org and is not closed
  const { data: incident, error: incErr } = await supabase
    .from('incidents')
    .select('id, status')
    .eq('id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (incErr || !incident) {
    throw new AssignRoleError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  // Verify the target member is checked into this incident
  const { data: targetPersonnel } = await supabase
    .from('incident_personnel')
    .select('id, member_id, incident_role')
    .eq('incident_id', incidentId)
    .eq('member_id', input.memberId)
    .is('checked_out_at', null)
    .single()

  if (!targetPersonnel) {
    throw new AssignRoleError('MEMBER_NOT_CHECKED_IN', 'Member is not checked into this incident')
  }

  // Resolve the target member's display name
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('display_name')
    .eq('id', input.memberId)
    .single()

  const targetName = targetMember?.display_name ?? 'Unknown'

  // Check if someone else already holds this role — relieve them
  const { data: currentHolder } = await supabase
    .from('incident_command_structure')
    .select('id, member_id')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .eq('ics_role', input.icsRole)
    .is('relieved_at', null)
    .single()

  if (currentHolder && currentHolder.member_id !== input.memberId) {
    // Relieve the current holder
    await supabase
      .from('incident_command_structure')
      .update({ relieved_at: new Date().toISOString() })
      .eq('id', currentHolder.id)

    // Demote the previous holder's personnel role to field_member
    if (currentHolder.member_id) {
      await supabase
        .from('incident_personnel')
        .update({ incident_role: 'field_member' })
        .eq('incident_id', incidentId)
        .eq('member_id', currentHolder.member_id)
        .is('checked_out_at', null)
    }
  } else if (currentHolder && currentHolder.member_id === input.memberId) {
    // Same member already holds the role — relieve old record before re-inserting
    await supabase
      .from('incident_command_structure')
      .update({ relieved_at: new Date().toISOString() })
      .eq('id', currentHolder.id)
  }

  // Relieve any OTHER active roles the target member currently holds.
  // A member holds at most one command role at a time — reassigning them to a
  // new role must vacate any previous one.
  const { data: otherRoles } = await supabase
    .from('incident_command_structure')
    .select('id')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .eq('member_id', input.memberId)
    .neq('ics_role', input.icsRole)
    .is('relieved_at', null)

  if (otherRoles && otherRoles.length > 0) {
    await supabase
      .from('incident_command_structure')
      .update({ relieved_at: new Date().toISOString() })
      .in('id', otherRoles.map((r) => r.id))
  }

  // Insert new command structure record
  const inserted = await withRetry(async () => {
    const { data, error } = await supabase
      .from('incident_command_structure')
      .insert({
        incident_id: incidentId,
        organization_id: organizationId,
        member_id: input.memberId,
        ics_role: input.icsRole,
      })
      .select('id')
      .single()

    if (error || !data) throw error ?? new Error('No data returned')
    return data
  }).catch(() => {
    throw new AssignRoleError('ASSIGNMENT_FAILED', 'Failed to assign role')
  })

  // Update personnel role (dual-write)
  await supabase
    .from('incident_personnel')
    .update({ incident_role: input.icsRole })
    .eq('incident_id', incidentId)
    .eq('member_id', input.memberId)
    .is('checked_out_at', null)

  // Write incident_log (best-effort)
  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'role_assigned',
      message: `${actorName} assigned ${targetName} as ${input.icsRole.replace(/_/g, ' ')}`,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: { member_id: input.memberId, ics_role: input.icsRole },
    })

  if (logError) {
    console.error('[assignRole] incident_log insert failed:', logError.code)
  }

  // Write audit_log (best-effort)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: actorUserId,
    action: 'incident.role_assigned',
    resource_type: 'incident_command_structure',
    resource_id: inserted.id,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { incident_id: incidentId, member_id: input.memberId, ics_role: input.icsRole },
  })

  return { commandStructureId: inserted.id }
}
