import { createServiceClient } from '@/lib/supabase/service'
import type { ReturnResourceInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type ReturnResourceErrorCode =
  | 'INCIDENT_RESOURCE_NOT_FOUND'
  | 'ALREADY_RETURNED'
  | 'DB_ERROR'

export class ReturnResourceError extends Error {
  constructor(
    public readonly code: ReturnResourceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ReturnResourceError'
  }
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function returnResource(
  organizationId: string,
  incidentResourceId: string,
  actorMemberId: string,
  actorName: string,
  input: ReturnResourceInput,
): Promise<{ returned: boolean }> {
  const supabase = createServiceClient()

  // Verify the incident_resource record belongs to this org and is currently deployed
  const { data: incidentResource, error: fetchError } = await supabase
    .from('incident_resources')
    .select('id, incident_id, resource_id, status')
    .eq('id', incidentResourceId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (fetchError || !incidentResource) {
    throw new ReturnResourceError('INCIDENT_RESOURCE_NOT_FOUND', 'Deployment record not found')
  }

  if (incidentResource.status === 'returned') {
    throw new ReturnResourceError('ALREADY_RETURNED', 'This resource has already been returned')
  }

  const now = new Date().toISOString()

  // Mark the deployment as returned
  const { error: updateError } = await supabase
    .from('incident_resources')
    .update({
      status: 'returned',
      checked_in_at: now,
      checked_in_by: actorMemberId,
      notes: input.notes ?? null,
    })
    .eq('id', incidentResourceId)

  if (updateError) {
    console.error('[returnResource] update failed:', updateError.code)
    throw new ReturnResourceError('DB_ERROR', 'Failed to return resource')
  }

  // Reset the resource status back to 'available'
  const { data: resource } = await supabase
    .from('resources')
    .update({ status: 'available' })
    .eq('id', incidentResource.resource_id)
    .select('name')
    .single()

  // Write incident log entry
  await supabase.from('incident_log').insert({
    incident_id: incidentResource.incident_id,
    organization_id: organizationId,
    entry_type: 'resource_returned',
    message: `Resource returned: ${resource?.name ?? incidentResource.resource_id}`,
    actor_id: actorMemberId,
    actor_name: actorName,
    metadata: {
      incident_resource_id: incidentResourceId,
      resource_id: incidentResource.resource_id,
    },
  })

  return { returned: true }
}
