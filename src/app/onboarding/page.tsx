import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateOrgForm } from '@/features/organizations/components/create-org-form'

export const metadata: Metadata = {
  title: 'Set Up Your Organization — SARGOS',
}

export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Proxy handles unauthenticated users, but belt-and-suspenders check here.
  if (!user) {
    redirect('/login')
  }

  // If the user already has an org, send them to the dashboard.
  const { data: existingMembership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (existingMembership) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up your organization
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This takes 2 minutes. You can update any of this later.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <CreateOrgForm />
        </div>
      </div>
    </div>
  )
}
