import { createServiceClient } from '@/lib/supabase/service'
import type { QrVolunteerCheckInInput } from '@/features/incidents/schemas'

// ─── Error Types ──────────────────────────────────────────────────────────────

export type QrVolunteerCheckInErrorCode =
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_INACTIVE'
  | 'INCIDENT_CLOSED'
  | 'DB_ERROR'

export class QrVolunteerCheckInError extends Error {
  constructor(
    public readonly code: QrVolunteerCheckInErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'QrVolunteerCheckInError'
  }
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface QrVolunteerCheckInResult {
  personnelId: string
  incidentName: string
}

// ─── Business Logic ───────────────────────────────────────────────────────────

export async function qrVolunteerCheckIn(
  tokenString: string,
  input: QrVolunteerCheckInInput,
): Promise<QrVolunteerCheckInResult> {
  const supabase = createServiceClient()

  // Look up the token via the SECURITY DEFINER RPC.
  // Returns zero rows if the token is unknown or the incident is closed/deleted.
  const { data: tokenRows, error: lookupError } = await supabase
    .rpc('lookup_qr_token', { p_token: tokenString })

  if (lookupError || !tokenRows || tokenRows.length === 0) {
    throw new QrVolunteerCheckInError(
      'TOKEN_NOT_FOUND',
      'QR code not found or the incident has been closed',
    )
  }

  const tokenData = tokenRows[0]

  if (!tokenData.is_active) {
    throw new QrVolunteerCheckInError(
      'TOKEN_INACTIVE',
      'This QR code is no longer active. Please ask the Incident Commander for an updated code.',
    )
  }

  // Fetch the full token row to get organization_id (not returned by the public RPC)
  const { data: qrRow, error: qrError } = await supabase
    .from('incident_qr_tokens')
    .select('id, organization_id')
    .eq('token', tokenString)
    .single()

  if (qrError || !qrRow) {
    console.error('[qrVolunteerCheckIn] token row fetch failed:', qrError?.message)
    throw new QrVolunteerCheckInError('DB_ERROR', 'Failed to process check-in')
  }

  // Insert the volunteer into incident_personnel
  const { data: personnel, error: insertError } = await supabase
    .from('incident_personnel')
    .insert({
      incident_id: tokenData.incident_id,
      organization_id: qrRow.organization_id,
      personnel_type: 'volunteer',
      checkin_method: 'qr_scan',
      volunteer_name: input.name,
      volunteer_phone: input.phone,
      volunteer_certifications: input.certifications,
      volunteer_vehicle: input.vehicle ?? null,
      volunteer_medical_notes: input.medicalNotes ?? null,
      status: 'available',
    })
    .select('id')
    .single()

  if (insertError || !personnel) {
    console.error('[qrVolunteerCheckIn] personnel insert failed:', insertError?.code)
    throw new QrVolunteerCheckInError('DB_ERROR', 'Failed to complete check-in')
  }

  // Write an incident log entry for accountability
  await supabase.from('incident_log').insert({
    incident_id: tokenData.incident_id,
    organization_id: qrRow.organization_id,
    entry_type: 'personnel_checkin',
    message: `${input.name} checked in via QR code`,
    actor_id: null,   // no system actor — volunteer is unauthenticated
    actor_name: input.name,
    metadata: { personnel_id: personnel.id, checkin_method: 'qr_scan' },
  })

  // Atomically increment the token's scan counter
  await supabase.rpc('increment_qr_scans', { p_token: tokenString })

  return { personnelId: personnel.id, incidentName: tokenData.incident_name }
}
