import { z } from 'zod'

// ─── Incident Types ───────────────────────────────────────────────────────────

export const INCIDENT_TYPES = [
  'lost_person',
  'overdue_hiker',
  'technical_rescue',
  'swift_water',
  'avalanche',
  'structure_collapse',
  'mutual_aid',
  'training',
  'other',
] as const

export type IncidentType = (typeof INCIDENT_TYPES)[number]

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  lost_person: 'Lost Person',
  overdue_hiker: 'Overdue Hiker',
  technical_rescue: 'Technical Rescue',
  swift_water: 'Swift Water',
  avalanche: 'Avalanche',
  structure_collapse: 'Structure Collapse',
  mutual_aid: 'Mutual Aid',
  training: 'Training Exercise',
  other: 'Other',
}

export const INCIDENT_STATUSES = ['planning', 'active', 'suspended', 'closed'] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

// ─── Personnel Types ──────────────────────────────────────────────────────────

export const PERSONNEL_STATUSES = [
  'available',
  'assigned',
  'in_field',
  'resting',
  'injured',
  'stood_down',
] as const
export type PersonnelStatus = (typeof PERSONNEL_STATUSES)[number]

export const PERSONNEL_STATUS_LABELS: Record<PersonnelStatus, string> = {
  available: 'Available',
  assigned: 'Assigned',
  in_field: 'In Field',
  resting: 'Resting',
  injured: 'Injured',
  stood_down: 'Stood Down',
}

export const INCIDENT_ROLES = [
  'incident_commander',
  'deputy_ic',
  'safety_officer',
  'public_information_officer',
  'liaison_officer',
  'operations_section_chief',
  'planning_section_chief',
  'logistics_section_chief',
  'finance_section_chief',
  'medical_officer',
  'field_member',
  'observer',
] as const
export type IncidentRole = (typeof INCIDENT_ROLES)[number]

export const INCIDENT_ROLE_LABELS: Record<IncidentRole, string> = {
  incident_commander: 'Incident Commander',
  deputy_ic: 'Deputy IC',
  safety_officer: 'Safety Officer',
  public_information_officer: 'PIO',
  liaison_officer: 'Liaison Officer',
  operations_section_chief: 'Operations Section Chief',
  planning_section_chief: 'Planning Section Chief',
  logistics_section_chief: 'Logistics Section Chief',
  finance_section_chief: 'Finance Section Chief',
  medical_officer: 'Medical Officer',
  field_member: 'Field Member',
  observer: 'Observer',
}

// ─── Create Incident ──────────────────────────────────────────────────────────

export const CreateIncidentSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(100),
  incidentType: z.enum(INCIDENT_TYPES),
  locationAddress: z.string().trim().max(200).optional(),
  startedAt: z.string().datetime({ offset: true }).optional(),
})

export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>
export type CreateIncidentFormInput = z.input<typeof CreateIncidentSchema>

// ─── Check In Personnel ───────────────────────────────────────────────────────

export const CheckInPersonnelSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  incidentRole: z.enum(INCIDENT_ROLES).optional(),
})

export type CheckInPersonnelInput = z.infer<typeof CheckInPersonnelSchema>

// ─── Update Personnel ────────────────────────────────────────────────────────
// Covers status change, incident role assignment, and checkout.
// At least one field must be meaningful — validated at the API layer.

export const UpdatePersonnelSchema = z.object({
  status: z.enum(PERSONNEL_STATUSES).optional(),
  // null clears the role; a value sets it
  incidentRole: z.enum(INCIDENT_ROLES).nullable().optional(),
  // When true, the server sets checked_out_at = now()
  checkout: z.boolean().optional(),
})

export type UpdatePersonnelInput = z.infer<typeof UpdatePersonnelSchema>

// Backward-compat aliases — existing imports continue to work
export const UpdatePersonnelStatusSchema = UpdatePersonnelSchema
export type UpdatePersonnelStatusInput = UpdatePersonnelInput

// ─── PAR Roll Call ────────────────────────────────────────────────────────────

export const InitiateParSchema = z.object({
  notes: z.string().trim().max(500).optional(),
})

export type InitiateParInput = z.infer<typeof InitiateParSchema>

export const SubmitParResponseSchema = z.object({
  personnelId: z.string().uuid('Invalid personnel ID'),
  confirmedSafe: z.boolean(),
  notes: z.string().trim().max(500).optional(),
})

export type SubmitParResponseInput = z.infer<typeof SubmitParResponseSchema>

// ─── Resource Deployment ─────────────────────────────────────────────────────

export const DeployResourceSchema = z.object({
  resourceId: z.string().uuid('Invalid resource ID'),
})

export type DeployResourceInput = z.infer<typeof DeployResourceSchema>

export const ReturnResourceSchema = z.object({
  notes: z.string().trim().max(500).optional(),
})

export type ReturnResourceInput = z.infer<typeof ReturnResourceSchema>

// ─── QR Volunteer Check-In ───────────────────────────────────────────────────

// Common certifications shown as checkboxes on the public check-in form.
// Stored as plain string labels in the volunteer_certifications array.
export const COMMON_CERTIFICATIONS = [
  'Wilderness First Aid (WFA)',
  'Wilderness First Responder (WFR)',
  'Swift Water Rescue',
  'K9 Handler',
  'Technical Rescue',
  'CPR / AED',
  'HAM Radio (FCC Licensed)',
] as const

export const QrVolunteerCheckInSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .max(30, 'Phone number too long'),
  certifications: z.array(z.string().max(100)).max(20).default([]),
  vehicle: z.string().trim().max(150).optional(),
  medicalNotes: z.string().trim().max(500).optional(),
  // Must be true — enforced by z.literal(true)
  safetyAck: z.literal(true, {
    error: 'You must acknowledge the safety briefing to check in',
  }),
})

export type QrVolunteerCheckInInput = z.infer<typeof QrVolunteerCheckInSchema>
export type QrVolunteerCheckInFormInput = z.input<typeof QrVolunteerCheckInSchema>
