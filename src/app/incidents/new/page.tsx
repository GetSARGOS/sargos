import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateIncidentForm } from '@/features/incidents/components/create-incident-form'

export const metadata: Metadata = {
  title: 'New Incident — SARGOS',
}

export default async function NewIncidentPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-lg">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold">New Incident</h1>
            <p className="text-sm text-muted-foreground">
              You will be the Incident Commander.
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <CreateIncidentForm />
        </div>
      </div>
    </div>
  )
}
