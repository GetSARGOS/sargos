import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { UpdatePeriodInput } from '@/features/incidents/schemas'
import { withRetry } from '@/lib/retry'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type UpdatePeriodErrorCode =
  | 'PERIOD_NOT_FOUND'
  | 'UPDATE_FAILED'

export class UpdatePeriodError extends Error {
  constructor(
    public readonly code: UpdatePeriodErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'UpdatePeriodError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface UpdatePeriodResult {
  periodId: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function updatePeriod(
  supabase: SupabaseClient<Database>,
  periodId: string,
  incidentId: string,
  organizationId: string,
  input: UpdatePeriodInput,
): Promise<UpdatePeriodResult> {
  // Verify period exists
  const { data: existing, error: fetchError } = await supabase
    .from('operational_periods')
    .select('id')
    .eq('id', periodId)
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .single()

  if (fetchError || !existing) {
    throw new UpdatePeriodError('PERIOD_NOT_FOUND', 'Operational period not found')
  }

  // Build update payload
  const payload: Record<string, unknown> = {}
  if (input.objectives !== undefined) payload.objectives = input.objectives
  if (input.weatherSummary !== undefined) payload.weather_summary = input.weatherSummary

  if (Object.keys(payload).length === 0) {
    return { periodId }
  }

  await withRetry(async () => {
    const { error } = await supabase
      .from('operational_periods')
      .update(payload)
      .eq('id', periodId)

    if (error) throw error
  }).catch(() => {
    throw new UpdatePeriodError('UPDATE_FAILED', 'Failed to update operational period')
  })

  return { periodId }
}
