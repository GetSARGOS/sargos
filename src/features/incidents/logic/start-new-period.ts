import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { StartNewPeriodInput } from '@/features/incidents/schemas'
import type { RequestMeta } from '@/lib/request-meta'
import { withRetry } from '@/lib/retry'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type StartNewPeriodErrorCode =
  | 'INCIDENT_NOT_FOUND'
  | 'START_FAILED'

export class StartNewPeriodError extends Error {
  constructor(
    public readonly code: StartNewPeriodErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'StartNewPeriodError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface StartNewPeriodResult {
  periodId: string
  periodNumber: number
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function startNewPeriod(
  supabase: SupabaseClient<Database>,
  incidentId: string,
  organizationId: string,
  actorMemberId: string,
  actorName: string,
  actorUserId: string,
  input: StartNewPeriodInput,
  requestMeta?: RequestMeta,
): Promise<StartNewPeriodResult> {
  // Fetch incident — verify exists, not closed
  const { data: incident, error: incErr } = await supabase
    .from('incidents')
    .select('id, status')
    .eq('id', incidentId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  if (incErr || !incident) {
    throw new StartNewPeriodError('INCIDENT_NOT_FOUND', 'Incident not found')
  }

  const now = new Date().toISOString()

  // Determine next period number from operational_periods directly — this is
  // the source of truth. If no rows exist (e.g. the create-incident best-effort
  // insert silently failed, or this incident pre-dates that logic), start at 1.
  const { data: latestPeriod } = await supabase
    .from('operational_periods')
    .select('period_number')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .order('period_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPeriodNumber = latestPeriod ? latestPeriod.period_number + 1 : 1

  // Close any currently-open period (only meaningful if a previous period exists)
  if (latestPeriod) {
    await supabase
      .from('operational_periods')
      .update({ ends_at: now })
      .eq('incident_id', incidentId)
      .eq('organization_id', organizationId)
      .is('ends_at', null)
  }

  // Insert new period
  const period = await withRetry(async () => {
    const { data, error } = await supabase
      .from('operational_periods')
      .insert({
        incident_id: incidentId,
        organization_id: organizationId,
        period_number: nextPeriodNumber,
        starts_at: now,
        objectives: input.objectives ?? null,
        weather_summary: input.weatherSummary ?? null,
        created_by: actorMemberId,
      })
      .select('id')
      .single()

    if (error || !data) throw error ?? new Error('No data returned')
    return data
  }).catch(() => {
    throw new StartNewPeriodError('START_FAILED', 'Failed to start new operational period')
  })

  // Update incident's current_operational_period
  await supabase
    .from('incidents')
    .update({ current_operational_period: nextPeriodNumber })
    .eq('id', incidentId)

  // Write incident_log (best-effort)
  const { error: logError } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'system',
      message: `Operational period ${nextPeriodNumber} started by ${actorName}`,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: { period_number: nextPeriodNumber },
    })

  if (logError) {
    console.error('[startNewPeriod] incident_log insert failed:', logError.code)
  }

  // Write audit_log (best-effort)
  await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: actorUserId,
    action: 'incident.period_started',
    resource_type: 'operational_period',
    resource_id: period.id,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { incident_id: incidentId, period_number: nextPeriodNumber },
  })

  return { periodId: period.id, periodNumber: nextPeriodNumber }
}
