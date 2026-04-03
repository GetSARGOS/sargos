import { createServiceClient } from '@/lib/supabase/service'
import type { CreateIncidentInput } from '@/features/incidents/schemas'
import type { RequestMeta } from '@/lib/request-meta'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type CreateIncidentErrorCode =
  | 'MEMBER_NOT_FOUND'
  | 'CREATE_FAILED'

export class CreateIncidentError extends Error {
  constructor(
    public readonly code: CreateIncidentErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CreateIncidentError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface CreateIncidentResult {
  incidentId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function createIncident(
  organizationId: string,
  creatorUserId: string,
  input: CreateIncidentInput,
  requestMeta?: RequestMeta,
): Promise<CreateIncidentResult> {
  const supabase = createServiceClient()

  // Look up the creating user's org member record to get their member ID and display name
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id, display_name')
    .eq('organization_id', organizationId)
    .eq('user_id', creatorUserId)
    .eq('is_active', true)
    .single()

  if (memberError || !member) {
    throw new CreateIncidentError('MEMBER_NOT_FOUND', 'Creator is not an active member of this organization')
  }

  // Insert the incident
  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .insert({
      organization_id: organizationId,
      name: input.name,
      incident_type: input.incidentType,
      status: 'active',
      location_address: input.locationAddress ?? null,
      started_at: input.startedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (incidentError || !incident) {
    console.error('[createIncident] incident insert failed:', incidentError?.code)
    throw new CreateIncidentError('CREATE_FAILED', 'Failed to create incident')
  }

  const incidentId = incident.id

  // Insert the IC into command structure
  const { error: commandError } = await supabase
    .from('incident_command_structure')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      member_id: member.id,
      ics_role: 'incident_commander',
    })

  if (commandError) {
    // Best effort — log but don't fail incident creation
    console.error('[createIncident] command structure insert failed:', commandError.code)
  }

  // Check in the creator as IC on the incident_personnel board
  const { error: personnelError } = await supabase
    .from('incident_personnel')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      member_id: member.id,
      personnel_type: 'member',
      checkin_method: 'app',
      status: 'available',
      incident_role: 'incident_commander',
    })

  if (personnelError) {
    console.error('[createIncident] personnel insert failed:', personnelError.code)
  }

  // Append incident_log entry
  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'incident_status_change',
      message: `Incident "${input.name}" created and set to active`,
      actor_id: member.id,
      actor_name: member.display_name,
      metadata: { status: 'active', incident_type: input.incidentType },
    })

  if (logError) {
    console.error('[createIncident] incident_log insert failed:', logError.code)
  }

  // Audit log (best-effort — does not block)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: creatorUserId,
    action: 'incident.created',
    resource_type: 'incident',
    resource_id: incidentId,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { incident_type: input.incidentType },
  })

  // Audit log for IC role assignment (SOC 2 — role changes are sensitive actions)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: creatorUserId,
    action: 'incident.role_assigned',
    resource_type: 'incident_personnel',
    resource_id: incidentId,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: {
      incident_id: incidentId,
      role: 'incident_commander',
      previous_role: null,
      member_id: member.id,
    },
  })

  return { incidentId }
}
