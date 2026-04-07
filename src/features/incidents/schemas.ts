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
  'missing',
] as const
export type PersonnelStatus = (typeof PERSONNEL_STATUSES)[number]

export const PERSONNEL_STATUS_LABELS: Record<PersonnelStatus, string> = {
  available: 'Available',
  assigned: 'Assigned',
  in_field: 'In Field',
  resting: 'Resting',
  injured: 'Injured',
  stood_down: 'Stood Down',
  missing: 'Missing',
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
// Check-in always creates the personnel record as `field_member`. Command roles
// are assigned exclusively via the Command Structure panel so that the
// `incident_command_structure` table remains the single source of truth.

export const CheckInPersonnelSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
})

export type CheckInPersonnelInput = z.infer<typeof CheckInPersonnelSchema>

// ─── Update Personnel ────────────────────────────────────────────────────────
// Covers status change and checkout. Command roles are NOT editable here —
// they flow exclusively through the Command Structure panel.

export const UpdatePersonnelSchema = z.object({
  status: z.enum(PERSONNEL_STATUSES).optional(),
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

// ─── Log Entry ──────────────────────────────────────────────────────────────

export const LOG_ENTRY_TYPES = [
  'narrative',
  'personnel_checkin',
  'personnel_checkout',
  'personnel_status_change',
  'resource_deployed',
  'resource_returned',
  'sector_assigned',
  'sector_status_change',
  'subject_update',
  'par_initiated',
  'par_completed',
  'role_assigned',
  'incident_status_change',
  'form_exported',
  'flight_path_added',
  'system',
] as const
export type LogEntryType = (typeof LOG_ENTRY_TYPES)[number]

export const LOG_ENTRY_TYPE_LABELS: Record<LogEntryType, string> = {
  narrative: 'Narrative',
  personnel_checkin: 'Check In',
  personnel_checkout: 'Check Out',
  personnel_status_change: 'Status Change',
  resource_deployed: 'Resource Deployed',
  resource_returned: 'Resource Returned',
  sector_assigned: 'Sector Assigned',
  sector_status_change: 'Sector Status',
  subject_update: 'Subject Update',
  par_initiated: 'PAR Initiated',
  par_completed: 'PAR Completed',
  role_assigned: 'Role Assigned',
  incident_status_change: 'Status Change',
  form_exported: 'Form Exported',
  flight_path_added: 'Flight Path',
  system: 'System',
}

export const AddLogEntrySchema = z.object({
  message: z.string().trim().min(1, 'Entry cannot be empty').max(2000),
})

export type AddLogEntryInput = z.infer<typeof AddLogEntrySchema>
export type AddLogEntryFormInput = z.input<typeof AddLogEntrySchema>

// ─── Update Incident Status ─────────────────────────────────────────────────

export const UpdateIncidentStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'closed']),
  afterActionNotes: z.string().trim().max(5000).optional(),
})

export type UpdateIncidentStatusInput = z.infer<typeof UpdateIncidentStatusSchema>

// ─── Incident Status Labels ─────────────────────────────────────────────────

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  suspended: 'Suspended',
  closed: 'Closed',
}

// ─── Subject Types ──────────────────────────────────────────────────────────

export const SUBJECT_TYPES = [
  'hiker', 'hunter', 'child', 'dementia_patient',
  'despondent', 'climber', 'skier', 'other',
] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

export const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  hiker: 'Hiker',
  hunter: 'Hunter',
  child: 'Child',
  dementia_patient: 'Dementia Patient',
  despondent: 'Despondent',
  climber: 'Climber',
  skier: 'Skier',
  other: 'Other',
}

export const SUBJECT_GENDERS = ['male', 'female', 'nonbinary', 'unknown'] as const
export type SubjectGender = (typeof SUBJECT_GENDERS)[number]

export const SUBJECT_GENDER_LABELS: Record<SubjectGender, string> = {
  male: 'Male',
  female: 'Female',
  nonbinary: 'Non-binary',
  unknown: 'Unknown',
}

export const FOUND_CONDITIONS = [
  'alive_uninjured', 'alive_injured', 'deceased', 'not_found',
] as const
export type FoundCondition = (typeof FOUND_CONDITIONS)[number]

export const FOUND_CONDITION_LABELS: Record<FoundCondition, string> = {
  alive_uninjured: 'Alive — Uninjured',
  alive_injured: 'Alive — Injured',
  deceased: 'Deceased',
  not_found: 'Not Found',
}

// ─── Create Subject ─────────────────────────────────────────────────────────

export const CreateSubjectSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(SUBJECT_GENDERS).optional(),
  heightCm: z.number().int().min(30).max(300).optional(),
  weightKg: z.number().min(1).max(500).optional(),
  physicalDescription: z.string().trim().max(2000).optional(),
  clothingDescription: z.string().trim().max(2000).optional(),
  subjectType: z.enum(SUBJECT_TYPES).optional(),
  lastSeenAt: z.string().datetime({ offset: true }).optional(),
  isPrimary: z.boolean().optional(),
})

export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>
export type CreateSubjectFormInput = z.input<typeof CreateSubjectSchema>

// ─── Update Subject ─────────────────────────────────────────────────────────

export const UpdateSubjectSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  age: z.number().int().min(0).max(150).nullable().optional(),
  gender: z.enum(SUBJECT_GENDERS).nullable().optional(),
  heightCm: z.number().int().min(30).max(300).nullable().optional(),
  weightKg: z.number().min(1).max(500).nullable().optional(),
  physicalDescription: z.string().trim().max(2000).nullable().optional(),
  clothingDescription: z.string().trim().max(2000).nullable().optional(),
  subjectType: z.enum(SUBJECT_TYPES).nullable().optional(),
  lastSeenAt: z.string().datetime({ offset: true }).nullable().optional(),
  isPrimary: z.boolean().optional(),
  foundCondition: z.enum(FOUND_CONDITIONS).nullable().optional(),
  foundAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export type UpdateSubjectInput = z.infer<typeof UpdateSubjectSchema>
export type UpdateSubjectFormInput = z.input<typeof UpdateSubjectSchema>

// ─── Assign Command Role ────────────────────────────────────────────────────

export const ASSIGNABLE_ICS_ROLES = [
  'incident_commander', 'deputy_ic', 'safety_officer',
  'public_information_officer', 'liaison_officer',
  'operations_section_chief', 'planning_section_chief',
  'logistics_section_chief', 'finance_section_chief',
  'medical_officer', 'observer',
] as const
export type AssignableIcsRole = (typeof ASSIGNABLE_ICS_ROLES)[number]

export const AssignRoleSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  icsRole: z.enum(ASSIGNABLE_ICS_ROLES),
})

export type AssignRoleInput = z.infer<typeof AssignRoleSchema>

// ─── IC Hand-Off ────────────────────────────────────────────────────────────

export const OUTGOING_IC_ROLES = ['field_member', 'observer', 'stood_down'] as const
export type OutgoingIcRole = (typeof OUTGOING_IC_ROLES)[number]

export const HandOffIcSchema = z.object({
  newIcMemberId: z.string().uuid('Invalid member ID'),
  outgoingIcNewRole: z.enum(OUTGOING_IC_ROLES),
})

export type HandOffIcInput = z.infer<typeof HandOffIcSchema>

// ─── Operational Period ─────────────────────────────────────────────────────

export const StartNewPeriodSchema = z.object({
  objectives: z.string().trim().max(5000).optional(),
  weatherSummary: z.string().trim().max(2000).optional(),
})

export type StartNewPeriodInput = z.infer<typeof StartNewPeriodSchema>

export const UpdatePeriodSchema = z.object({
  objectives: z.string().trim().max(5000).optional(),
  weatherSummary: z.string().trim().max(2000).optional(),
})

export type UpdatePeriodInput = z.infer<typeof UpdatePeriodSchema>
