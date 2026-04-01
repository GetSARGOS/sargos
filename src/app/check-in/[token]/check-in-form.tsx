'use client'

import { useState, useTransition } from 'react'
import { COMMON_CERTIFICATIONS, type QrVolunteerCheckInFormInput } from '@/features/incidents/schemas'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CheckInFormProps {
  token: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckInForm({ token }: CheckInFormProps) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Controlled form state
  const [form, setForm] = useState<{
    name: string
    phone: string
    certifications: string[]
    otherCert: string
    vehicle: string
    medicalNotes: string
    safetyAck: boolean
  }>({
    name: '',
    phone: '',
    certifications: [],
    otherCert: '',
    vehicle: '',
    medicalNotes: '',
    safetyAck: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function toggleCert(label: string) {
    setForm((prev) => ({
      ...prev,
      certifications: prev.certifications.includes(label)
        ? prev.certifications.filter((c) => c !== label)
        : [...prev.certifications, label],
    }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters'
    if (form.phone.trim().length < 7) next.phone = 'Enter a valid phone number'
    if (!form.safetyAck) next.safetyAck = 'You must acknowledge the safety briefing to check in'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError(null)

    if (!validate()) return

    // Build certifications list: checked common + any free-text "other" entries
    const allCerts = [...form.certifications]
    if (form.otherCert.trim()) {
      form.otherCert
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => allCerts.push(c))
    }

    const payload: QrVolunteerCheckInFormInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      certifications: allCerts,
      vehicle: form.vehicle.trim() || undefined,
      medicalNotes: form.medicalNotes.trim() || undefined,
      safetyAck: true,
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/check-in/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as { error: { message: string } | null }
        if (!res.ok) {
          setGlobalError(json.error?.message ?? 'Check-in failed. Please try again.')
          return
        }
        setSuccess(true)
      } catch {
        setGlobalError('Network error — please check your connection and try again.')
      }
    })
  }

  // ─── Success State ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mb-4 text-5xl">✓</div>
        <h2 className="text-xl font-semibold mb-2">You&apos;re Checked In!</h2>
        <p className="text-sm text-muted-foreground">
          You are now visible on the Incident Commander&apos;s resource board as an available
          volunteer. Please report to the staging area and await assignment.
        </p>
      </div>
    )
  }

  // ─── Form ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact Information */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Contact Information
        </h2>

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1.5">
            Full Name <span className="text-destructive">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            autoComplete="name"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1.5">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            autoComplete="tel"
            placeholder="e.g. 555-867-5309"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
        </div>
      </div>

      {/* Qualifications */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Qualifications (check all that apply)
        </h2>

        <div className="space-y-3">
          {COMMON_CERTIFICATIONS.map((cert) => (
            <label key={cert} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.certifications.includes(cert)}
                onChange={() => toggleCert(cert)}
                className="h-5 w-5 rounded border-input accent-primary"
              />
              <span className="text-sm">{cert}</span>
            </label>
          ))}
        </div>

        <div>
          <label htmlFor="other-cert" className="block text-sm font-medium mb-1.5">
            Other certifications
          </label>
          <input
            id="other-cert"
            type="text"
            value={form.otherCert}
            onChange={(e) => setForm((p) => ({ ...p, otherCert: e.target.value }))}
            placeholder="e.g. EMT, Rope Access Level 2 (comma-separated)"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Optional Details */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Optional Details
        </h2>

        <div>
          <label htmlFor="vehicle" className="block text-sm font-medium mb-1.5">
            Vehicle description &amp; plate
          </label>
          <input
            id="vehicle"
            type="text"
            value={form.vehicle}
            onChange={(e) => setForm((p) => ({ ...p, vehicle: e.target.value }))}
            placeholder="e.g. Red Toyota Tacoma, ABC123"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="medical-notes" className="block text-sm font-medium mb-1.5">
            Medical limitations or conditions relevant to deployment
          </label>
          <textarea
            id="medical-notes"
            value={form.medicalNotes}
            onChange={(e) => setForm((p) => ({ ...p, medicalNotes: e.target.value }))}
            rows={3}
            placeholder="Only include information relevant to the IC for safe deployment. This is optional."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      </div>

      {/* Safety Acknowledgment */}
      <div className="rounded-xl border border-border bg-card p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.safetyAck}
            onChange={(e) => setForm((p) => ({ ...p, safetyAck: e.target.checked }))}
            className="mt-0.5 h-5 w-5 rounded border-input accent-primary flex-shrink-0"
          />
          <span className="text-sm leading-relaxed">
            I acknowledge that I have received a safety briefing, understand the hazards involved
            in this operation, and will follow all instructions from the Incident Commander.{' '}
            <span className="text-destructive font-medium">*</span>
          </span>
        </label>
        {errors.safetyAck && (
          <p className="mt-2 text-xs text-destructive">{errors.safetyAck}</p>
        )}
      </div>

      {/* Global error */}
      {globalError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {globalError}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Checking in…' : 'Check In'}
      </button>
    </form>
  )
}
