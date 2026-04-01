import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { INCIDENT_TYPE_LABELS, type IncidentType, type IncidentStatus } from '@/features/incidents/schemas'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export const metadata: Metadata = {
  title: 'Dashboard — SARGOS',
}

const STATUS_STYLES: Record<IncidentStatus, string> = {
  active: 'bg-green-100 text-green-800',
  planning: 'bg-blue-100 text-blue-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-muted text-muted-foreground',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id, role, organization_id, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, unit_type')
    .eq('id', membership.organization_id)
    .maybeSingle()

  // Fetch incidents for this org
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, name, incident_type, status, location_address, started_at, created_at')
    .eq('organization_id', membership.organization_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const statusOrder: Record<string, number> = { active: 0, planning: 1, suspended: 2, closed: 3 }
  const sortedIncidents = (incidents ?? []).sort(
    (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99),
  )

  const activeCount = sortedIncidents.filter((i) => i.status === 'active' || i.status === 'planning').length

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b bg-card px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">S</span>
            </div>
            <span className="font-semibold">SARGOS</span>
            {org && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm text-muted-foreground">{org.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{membership.display_name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {membership.role === 'org_admin' ? 'Admin' : 'Member'}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Incidents</h1>
            {org && (
              <p className="mt-1 text-sm text-muted-foreground">
                {org.name} · {activeCount} active
              </p>
            )}
          </div>
          <Link
            href="/incidents/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + New Incident
          </Link>
        </div>

        {sortedIncidents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-20 text-center">
            <div className="mb-4 text-4xl">🗺</div>
            <h2 className="text-lg font-medium">No active incidents</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create your first incident to start managing resources and coordinating your team.
            </p>
            <Link
              href="/incidents/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + New Incident
            </Link>
          </div>
        ) : (
          /* Incident list */
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Incident</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Started</th>
                </tr>
              </thead>
              <tbody>
                {sortedIncidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {incident.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {INCIDENT_TYPE_LABELS[incident.incident_type as IncidentType] ?? incident.incident_type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[incident.status as IncidentStatus] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {incident.location_address ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {incident.started_at
                        ? new Date(incident.started_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
