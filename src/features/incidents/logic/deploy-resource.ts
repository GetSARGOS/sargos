import { createServiceClient } from '@/lib/supabase/service'
import type { DeployResourceInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type DeployResourceErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'INCIDENT_NOT_ACTIVE'
  | 'RESOURCE_NOT_FOUND'
  | 'ALREADY_DEPLOYED'
  | 'DB_ERROR'

export class DeployResourceError extends Error {
  constructor(
    public readonly code: DeployResourceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DeployResourceError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface DeployResourceResult {
  incidentResourceId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function deployResource(
  organizationId: string,
  incidentId: string,
  actorMemberId: string,
  actorName: string,
  input: DeployResourceInput,
): Promise<DeployResourceResult> {
  const supabase = createServiceClient()

  // Verify the incident is active and belongs to this org
  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .select('id, status')
    .eq('id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (incidentError || !incident) {
    throw new DeployResourceError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  if (incident.status === 'closed') {
    throw new DeployResourceError('INCIDENT_NOT_ACTIVE', 'Cannot deploy resources to a closed incident')
  }

  // Verify the resource belongs to this org
  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('id, name, status')
    .eq('id', input.resourceId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (resourceError || !resource) {
    throw new DeployResourceError('RESOURCE_NOT_FOUND', 'Resource not found')
  }

  // Check it's not already deployed to this incident
  const { count: existingCount } = await supabase
    .from('incident_resources')
    .select('id', { count: 'exact', head: true })
    .eq('incident_id', incidentId)
    .eq('resource_id', input.resourceId)
    .in('status', ['requested', 'deployed'])

  if ((existingCount ?? 0) > 0) {
    throw new DeployResourceError('ALREADY_DEPLOYED', 'This resource is already deployed to this incident')
  }

  // Insert the incident_resource record
  const { data: incidentResource, error: insertError } = await supabase
    .from('incident_resources')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      resource_id: input.resourceId,
      status: 'deployed',
      checked_out_by: actorMemberId,
    })
    .select('id')
    .single()

  if (insertError || !incidentResource) {
    console.error('[deployResource] insert failed:', insertError?.code)
    throw new DeployResourceError('DB_ERROR', 'Failed to deploy resource')
  }

  // Update the resource status to 'deployed'
  await supabase
    .from('resources')
    .update({ status: 'deployed' })
    .eq('id', input.resourceId)

  // Write incident log entry
  await supabase.from('incident_log').insert({
    incident_id: incidentId,
    organization_id: organizationId,
    entry_type: 'resource_deployed',
    message: `Resource deployed: ${resource.name}`,
    actor_id: actorMemberId,
    actor_name: actorName,
    metadata: {
      incident_resource_id: incidentResource.id,
      resource_id: input.resourceId,
      resource_name: resource.name,
    },
  })

  return { incidentResourceId: incidentResource.id }
}
