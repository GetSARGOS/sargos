import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CheckInForm } from './check-in-form'

export const metadata: Metadata = {
  title: 'Volunteer Check-In — SARGOS',
}

type PageProps = { params: Promise<{ token: string }> }

export default async function CheckInPage({ params }: PageProps) {
  const { token } = await params

  // Resolve the token using the SECURITY DEFINER RPC (callable by anon role).
  // No auth session required — this is a public page.
  const supabase = await createClient()
  const { data: rows } = await supabase.rpc('lookup_qr_token', { p_token: token })

  const tokenData = rows?.[0] ?? null

  // Token not found or incident is closed
  if (!tokenData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold mb-2">QR Code Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This QR code is invalid, the incident has been closed, or the link has expired.
            Please ask the Incident Commander for an updated QR code.
          </p>
        </div>
      </div>
    )
  }

  // Token found but deactivated
  if (!tokenData.is_active) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-4xl">🔒</div>
          <h1 className="text-xl font-semibold mb-2">QR Code No Longer Active</h1>
          <p className="text-sm text-muted-foreground">
            This QR code has been deactivated by the Incident Commander.
            Please ask them for an updated QR code.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {tokenData.organization_name}
          </p>
          <h1 className="text-2xl font-semibold">{tokenData.incident_name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete this form to check in as a volunteer.
          </p>
        </div>

        {/* Check-in form */}
        <CheckInForm token={token} />
      </div>
    </div>
  )
}
