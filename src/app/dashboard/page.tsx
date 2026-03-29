import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Dashboard — SARGOS',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check org membership — redirect to onboarding if none found
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
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">
            Welcome, {membership.display_name}
          </h1>
          {org && (
            <p className="mt-1 text-sm text-muted-foreground">
              {org.name} · {org.unit_type.replace('_', ' ').toUpperCase()}
            </p>
          )}
        </div>

        {/* Empty state for incidents */}
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-20 text-center">
          <div className="mb-4 text-4xl">🗺</div>
          <h2 className="text-lg font-medium">No active incidents</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Your organization is ready. Create your first incident to start
            managing resources and coordinating your team.
          </p>
          <p className="mt-6 text-xs text-muted-foreground">
            Incident management coming in the next session.
          </p>
        </div>
      </main>
    </div>
  )
}
