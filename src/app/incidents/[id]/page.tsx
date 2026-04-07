import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IncidentBoard, type IncidentData } from '@/features/incidents/components/incident-board'
import type { PersonnelWithMember } from '@/features/incidents/components/personnel-board'
import type { ParEvent, ParResponse } from '@/features/incidents/components/par-panel'
import type { DeployedResource, AvailableResource } from '@/features/incidents/components/resource-board'
import type { CommandStructureRow, OperationalPeriodData } from '@/features/incidents/components/incident-overview'
import type { SubjectRow } from '@/features/incidents/components/subject-list'

export const metadata: Metadata = {
  title: 'Incident Board — SARGOS',
}

type PageProps = { params: Promise<{ id: string }> }

export default async function IncidentPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id, organization_id, display_name, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const isOrgAdmin = membership.role === 'org_admin'

  // Fetch the incident
  const { data: incident } = await supabase
    .from('incidents')
    .select('id, name, incident_type, status, location_address, started_at, organization_id, timezone, current_operational_period')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!incident) {
    notFound()
  }

  // Parallel data fetches for all tabs
  const [
    orgMemberRows,
    personnelRows,
    parEventRow,
    incidentResourceRows,
    availableResourceRows,
    qrTokenRows,
    commandStructureRows,
    subjectRows,
    currentPeriodRow,
  ] = await Promise.all([
    // Org members for check-in dropdown
    supabase
      .from('organization_members')
      .select('id, display_name')
      .eq('organization_id', membership.organization_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_name', { ascending: true })
      .then((r) => r.data ?? []),

    // Personnel
    supabase
      .from('incident_personnel')
      .select('*')
      .eq('incident_id', id)
      .eq('organization_id', membership.organization_id)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: true })
      .then((r) => r.data ?? []),

    // Latest PAR event
    supabase
      .from('incident_par_events')
      .select('*')
      .eq('incident_id', id)
      .eq('organization_id', membership.organization_id)
      .order('initiated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),

    // Deployed resources
    supabase
      .from('incident_resources')
      .select('*')
      .eq('incident_id', id)
      .eq('organization_id', membership.organization_id)
      .in('status', ['requested', 'deployed'])
      .order('checked_out_at', { ascending: true })
      .then((r) => r.data ?? []),

    // Available resources
    supabase
      .from('resources')
      .select('id, name, category, identifier, status')
      .eq('organization_id', membership.organization_id)
      .eq('status', 'available')
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .then((r) => r.data ?? []),

    // QR tokens
    supabase
      .from('incident_qr_tokens')
      .select('id, token, is_active, scans, created_at')
      .eq('incident_id', id)
      .order('created_at', { ascending: false })
      .then((r) => r.data ?? []),

    // Command structure (all rows — active + relieved for history)
    supabase
      .from('incident_command_structure')
      .select('id, ics_role, member_id, assigned_at, relieved_at')
      .eq('incident_id', id)
      .eq('organization_id', membership.organization_id)
      .order('assigned_at', { ascending: true })
      .then((r) => r.data ?? []),

    // Subjects (non-PHI columns, primary first)
    supabase
      .from('incident_subjects')
      .select('id, first_name, last_name, age, gender, height_cm, weight_kg, physical_description, clothing_description, subject_type, last_seen_at, is_primary, found_condition, found_at, created_at')
      .eq('incident_id', id)
      .eq('organization_id', membership.organization_id)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .then((r) => r.data ?? []),

    // Current operational period (open — no ends_at)
    supabase
      .from('operational_periods')
      .select('id, period_number, starts_at, objectives, weather_summary')
      .eq('incident_id', id)
      .eq('organization_id', membership.organization_id)
      .is('ends_at', null)
      .order('period_number', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
  ])

  const initialOrgMembers = orgMemberRows.map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }))

  // Resolve member names for personnel
  const memberIds = personnelRows
    .map((p) => p.member_id)
    .filter((mid): mid is string => mid !== null)

  const memberMap = new Map<string, { display_name: string; phone: string | null; certifications: string[] }>()
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from('organization_members')
      .select('id, display_name, phone, certifications')
      .in('id', memberIds)
    for (const m of members ?? []) {
      memberMap.set(m.id, { display_name: m.display_name, phone: m.phone, certifications: m.certifications ?? [] })
    }
  }

  const personnel: PersonnelWithMember[] = personnelRows.map((p) => {
    const member = p.member_id ? memberMap.get(p.member_id) : undefined
    return {
      ...p,
      status: p.status as PersonnelWithMember['status'],
      incident_role: p.incident_role as PersonnelWithMember['incident_role'],
      memberName: member?.display_name ?? null,
      memberPhone: member?.phone ?? null,
      memberCertifications: member?.certifications ?? [],
    }
  })

  // Compute current user's incident role and checked-in member IDs
  const currentUserPersonnel = personnelRows.find((p) => p.member_id === membership.id)
  const currentUserIncidentRole = (currentUserPersonnel?.incident_role as string | null) ?? null
  const checkedInMemberIds = personnelRows
    .map((p) => p.member_id)
    .filter((mid): mid is string => mid !== null)

  // PAR data
  const initialParEvent: ParEvent | null = parEventRow
    ? {
        id: parEventRow.id,
        incident_id: parEventRow.incident_id,
        organization_id: parEventRow.organization_id,
        initiated_by: parEventRow.initiated_by,
        initiated_at: parEventRow.initiated_at,
        completed_at: parEventRow.completed_at,
        total_personnel: parEventRow.total_personnel,
        confirmed_count: parEventRow.confirmed_count,
        unaccounted_ids: parEventRow.unaccounted_ids,
      }
    : null

  const initialParResponses: ParResponse[] = []
  if (parEventRow) {
    const { data: parResponseRows } = await supabase
      .from('incident_par_responses')
      .select('id, par_event_id, personnel_id, confirmed_safe, confirmed_at, notes')
      .eq('par_event_id', parEventRow.id)
    for (const r of parResponseRows ?? []) {
      initialParResponses.push({
        id: r.id,
        par_event_id: r.par_event_id,
        personnel_id: r.personnel_id,
        confirmed_safe: r.confirmed_safe,
        confirmed_at: r.confirmed_at,
        notes: r.notes,
      })
    }
  }

  // Resources with detail lookup
  const deployedResourceIds = incidentResourceRows.map((r) => r.resource_id)
  const resourceDetailMap = new Map<string, { name: string; category: string; identifier: string | null }>()
  if (deployedResourceIds.length > 0) {
    const { data: resourceDetailRows } = await supabase
      .from('resources')
      .select('id, name, category, identifier')
      .in('id', deployedResourceIds)
    for (const r of resourceDetailRows ?? []) {
      resourceDetailMap.set(r.id, { name: r.name, category: r.category, identifier: r.identifier })
    }
  }

  const initialDeployedResources: DeployedResource[] = incidentResourceRows.map((ir) => ({
    id: ir.id,
    resource_id: ir.resource_id,
    status: ir.status as DeployedResource['status'],
    checked_out_at: ir.checked_out_at,
    checked_in_at: ir.checked_in_at,
    notes: ir.notes,
    resourceName: resourceDetailMap.get(ir.resource_id)?.name ?? '—',
    resourceCategory: resourceDetailMap.get(ir.resource_id)?.category ?? '—',
    resourceIdentifier: resourceDetailMap.get(ir.resource_id)?.identifier ?? null,
  }))

  const initialAvailableResources: AvailableResource[] = availableResourceRows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    identifier: r.identifier,
    status: r.status,
  }))

  const initialQrTokens = qrTokenRows.map((t) => ({
    id: t.id,
    token: t.token,
    is_active: t.is_active,
    scans: t.scans,
    created_at: t.created_at,
  }))

  // Resolve command structure member names
  const commandMemberIds = commandStructureRows
    .map((r) => r.member_id)
    .filter((mid): mid is string => mid !== null)

  const commandMemberMap = new Map<string, string>()
  if (commandMemberIds.length > 0) {
    const { data: commandMembers } = await supabase
      .from('organization_members')
      .select('id, display_name')
      .in('id', commandMemberIds)
    for (const m of commandMembers ?? []) {
      commandMemberMap.set(m.id, m.display_name)
    }
  }

  const initialCommandStructure: CommandStructureRow[] = commandStructureRows.map((r) => ({
    id: r.id,
    ics_role: r.ics_role,
    member_id: r.member_id,
    assigned_at: r.assigned_at,
    relieved_at: r.relieved_at,
    memberName: r.member_id ? commandMemberMap.get(r.member_id) ?? null : null,
  }))

  // Map subjects to SubjectRow
  const initialSubjects: SubjectRow[] = subjectRows.map((s) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    age: s.age,
    gender: s.gender,
    height_cm: s.height_cm,
    weight_kg: s.weight_kg,
    physical_description: s.physical_description,
    clothing_description: s.clothing_description,
    subject_type: s.subject_type,
    last_seen_at: s.last_seen_at,
    is_primary: s.is_primary,
    found_condition: s.found_condition,
    found_at: s.found_at,
    created_at: s.created_at,
  }))

  // Map current operational period
  const initialCurrentPeriod: OperationalPeriodData | null = currentPeriodRow
    ? {
        id: currentPeriodRow.id,
        period_number: currentPeriodRow.period_number,
        starts_at: currentPeriodRow.starts_at,
        objectives: currentPeriodRow.objectives,
        weather_summary: currentPeriodRow.weather_summary,
      }
    : null

  const incidentData: IncidentData = {
    id: incident.id,
    name: incident.name,
    incident_type: incident.incident_type,
    status: incident.status,
    location_address: incident.location_address,
    started_at: incident.started_at,
    organization_id: incident.organization_id,
    timezone: incident.timezone,
    current_operational_period: incident.current_operational_period,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b bg-card px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">S</span>
            </div>
            <Link href="/dashboard" className="font-semibold hover:underline">
              SARGOS
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {incident.name}
            </span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← All incidents
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-6">
        <IncidentBoard
          incident={incidentData}
          orgId={membership.organization_id}
          initialPersonnel={personnel}
          initialOrgMembers={initialOrgMembers}
          initialParEvent={initialParEvent}
          initialParResponses={initialParResponses}
          initialDeployedResources={initialDeployedResources}
          initialAvailableResources={initialAvailableResources}
          initialQrTokens={initialQrTokens}
          initialCommandStructure={initialCommandStructure}
          initialSubjects={initialSubjects}
          initialCurrentPeriod={initialCurrentPeriod}
          checkedInMemberIds={checkedInMemberIds}
          currentUserMemberId={membership.id}
          currentUserIncidentRole={currentUserIncidentRole}
          isOrgAdmin={isOrgAdmin}
        />
      </main>
    </div>
  )
}
