import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { AddLogEntryInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type AddLogEntryErrorCode = 'INSERT_FAILED'

export class AddLogEntryError extends Error {
  constructor(
    public readonly code: AddLogEntryErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AddLogEntryError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string
  incident_id: string
  entry_type: string
  message: string
  actor_id: string | null
  actor_name: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function addLogEntry(
  supabase: SupabaseClient<Database>,
  incidentId: string,
  organizationId: string,
  actorMemberId: string,
  actorName: string,
  input: AddLogEntryInput,
): Promise<LogEntry> {
  const { data, error } = await supabase
    .from('incident_log')
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      entry_type: 'narrative',
      message: input.message,
      actor_id: actorMemberId,
      actor_name: actorName,
      metadata: {},
    })
    .select('id, incident_id, entry_type, message, actor_id, actor_name, created_at, metadata')
    .single()

  if (error || !data) {
    console.error('[addLogEntry] insert failed:', error?.code)
    throw new AddLogEntryError('INSERT_FAILED', 'Failed to add log entry')
  }

  return data as LogEntry
}
