import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersonnelBoard, type PersonnelWithMember } from '@/features/incidents/components/personnel-board'
import { QrPanel } from '@/features/incidents/components/qr-panel'
import { ParPanel, type ParEvent, type ParResponse } from '@/features/incidents/components/par-panel'
import { ResourceBoard, type DeployedResource, type AvailableResource } from '@/features/incidents/components/resource-board'
import {
  INCIDENT_TYPE_LABELS,
  type IncidentType,
  type IncidentStatus,
} from '@/features/incidents/schemas'

export const metadata: Metadata = {
  title: 'Incident Board — SARGOS',
}

const STATUS_STYLES: Record<IncidentStatus, string> = {
  active: 'bg-green-100 text-green-800',
  planning: 'bg-blue-100 text-blue-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-muted text-muted-foreground',
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
    .select('id, organization_id, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  // Fetch the incident — verify it belongs to this org

  const { data: incident } = await supabase
    .from('incidents')
    .select('id, name, incident_type, status, location_address, started_at, organization_id')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!incident) {
    notFound()
  }

  // Fetch org members for the check-in dropdown
  const { data: orgMemberRows } = await supabase
    .from('organization_members')
    .select('id, display_name')
    .eq('organization_id', membership.organization_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })

  const initialOrgMembers = (orgMemberRows ?? []).map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }))

  // Fetch initial personnel list, then member names separately
  // (relational join not supported in hand-authored type stubs)
  const { data: personnelRows } = await supabase
    .from('incident_personnel')
    .select('*')
    .eq('incident_id', id)
    .eq('organization_id', membership.organization_id)
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: true })

  const memberIds = (personnelRows ?? [])
    .map((p) => p.member_id)
    .filter((id): id is string => id !== null)

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

  const personnel: PersonnelWithMember[] = (personnelRows ?? []).map((p) => {
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

  // Fetch latest PAR event and responses for the ParPanel
  const { data: parEventRow } = await supabase
    .from('incident_par_events')
    .select('*')
    .eq('incident_id', id)
    .eq('organization_id', membership.organization_id)
    .order('initiated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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

  // Fetch deployed resources for the ResourceBoard
  const { data: incidentResourceRows } = await supabase
    .from('incident_resources')
    .select('*')
    .eq('incident_id', id)
    .eq('organization_id', membership.organization_id)
    .in('status', ['requested', 'deployed'])
    .order('checked_out_at', { ascending: true })

  const deployedResourceIds = (incidentResourceRows ?? []).map((r) => r.resource_id)
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

  const initialDeployedResources: DeployedResource[] = (incidentResourceRows ?? []).map((ir) => ({
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

  // Fetch available org resources for the deploy panel
  const { data: availableResourceRows } = await supabase
    .from('resources')
    .select('id, name, category, identifier, status')
    .eq('organization_id', membership.organization_id)
    .eq('status', 'available')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const initialAvailableResources: AvailableResource[] = (availableResourceRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    identifier: r.identifier,
    status: r.status,
  }))

  // Fetch initial QR tokens for the QrPanel
  const { data: qrTokenRows } = await supabase
    .from('incident_qr_tokens')
    .select('id, token, is_active, scans, created_at')
    .eq('incident_id', id)
    .order('created_at', { ascending: false })

  const initialQrTokens = (qrTokenRows ?? []).map((t) => ({
    id: t.id,
    token: t.token,
    is_active: t.is_active,
    scans: t.scans,
    created_at: t.created_at,
  }))

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
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Incident header */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{incident.name}</h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[incident.status as IncidentStatus] ?? 'bg-muted text-muted-foreground'}`}
                >
                  {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {INCIDENT_TYPE_LABELS[incident.incident_type as IncidentType] ?? incident.incident_type}
                </span>
                {incident.location_address && (
                  <>
                    <span>·</span>
                    <span>{incident.location_address}</span>
                  </>
                )}
                {incident.started_at && (
                  <>
                    <span>·</span>
                    <span>
                      Started {new Date(incident.started_at).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personnel board — client component with Supabase Realtime */}
        <PersonnelBoard
          incidentId={incident.id}
          orgId={membership.organization_id}
          initialPersonnel={personnel}
          initialOrgMembers={initialOrgMembers}
        />

        {/* PAR roll call panel */}
        <div className="mt-6">
          <ParPanel
            incidentId={incident.id}
            initialParEvent={initialParEvent}
            initialResponses={initialParResponses}
            personnel={personnel}
          />
        </div>

        {/* Equipment & resources board */}
        <div className="mt-6">
          <ResourceBoard
            incidentId={incident.id}
            initialDeployedResources={initialDeployedResources}
            initialAvailableResources={initialAvailableResources}
          />
        </div>

        {/* QR check-in panel */}
        <div className="mt-6">
          <QrPanel
            incidentId={incident.id}
            initialTokens={initialQrTokens}
          />
        </div>
      </main>
    </div>
  )
}
