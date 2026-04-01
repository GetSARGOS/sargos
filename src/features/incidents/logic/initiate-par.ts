import { createServiceClient } from '@/lib/supabase/service'
import type { InitiateParInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type InitiateParErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'INCIDENT_NOT_ACTIVE'
  | 'NO_PERSONNEL'
  | 'DB_ERROR'

export class InitiateParError extends Error {
  constructor(
    public readonly code: InitiateParErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'InitiateParError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface InitiateParResult {
  parEventId: string
  totalPersonnel: number
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function initiatePar(
  organizationId: string,
  incidentId: string,
  initiatedByMemberId: string,
  initiatedByName: string,
  input: InitiateParInput,
): Promise<InitiateParResult> {
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
    throw new InitiateParError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  if (incident.status === 'closed' || incident.status === 'suspended') {
    throw new InitiateParError('INCIDENT_NOT_ACTIVE', 'PAR can only be initiated on an active incident')
  }

  // Count currently checked-in personnel
  const { count, error: countError } = await supabase
    .from('incident_personnel')
    .select('id', { count: 'exact', head: true })
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .is('checked_out_at', null)

  if (countError) {
    console.error('[initiatePar] count failed:', countError.code)
    throw new InitiateParError('DB_ERROR', 'Failed to count personnel')
  }

  const totalPersonnel = count ?? 0

  if (totalPersonnel === 0) {
    throw new InitiateParError('NO_PERSONNEL', 'No personnel are currently checked in')
  }

  // Insert the PAR event
  const { data: parEvent, error: insertError } = await supabase
    .from('incident_par_events')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      initiated_by: initiatedByMemberId,
      total_personnel: totalPersonnel,
    })
    .select('id')
    .single()

  if (insertError || !parEvent) {
    console.error('[initiatePar] insert failed:', insertError?.code)
    throw new InitiateParError('DB_ERROR', 'Failed to create PAR event')
  }

  // Write incident log entry
  await supabase.from('incident_log').insert({
    incident_id: incidentId,
    organization_id: organizationId,
    entry_type: 'par_initiated',
    message: `PAR initiated — ${totalPersonnel} personnel${input.notes ? `. Note: ${input.notes}` : ''}`,
    actor_id: initiatedByMemberId,
    actor_name: initiatedByName,
    metadata: {
      par_event_id: parEvent.id,
      total_personnel: totalPersonnel,
    },
  })

  return { parEventId: parEvent.id, totalPersonnel }
}
