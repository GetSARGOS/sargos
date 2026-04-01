'use client'

import { useEffect, useState, useTransition } from 'react'
import QRCode from 'react-qr-code'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrToken {
  id: string
  token: string
  is_active: boolean
  scans: number
  created_at: string
}

interface QrPanelProps {
  incidentId: string
  initialTokens: QrToken[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QrPanel({ incidentId, initialTokens }: QrPanelProps) {
  const [tokens, setTokens] = useState<QrToken[]>(initialTokens)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const activeToken = tokens.find((t) => t.is_active) ?? null

  // Build the check-in URL from the current origin so it works in all environments
  const [checkInUrl, setCheckInUrl] = useState<string | null>(null)

  useEffect(() => {
    if (activeToken) {
      setCheckInUrl(`${window.location.origin}/check-in/${activeToken.token}`)
    } else {
      setCheckInUrl(null)
    }
  }, [activeToken])

  // ── Generate (or regenerate) QR token ──────────────────────────────────────

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/qr-tokens`, { method: 'POST' })
        const json = (await res.json()) as {
          data: { id: string; token: string } | null
          error: { message: string } | null
        }
        if (!res.ok || !json.data) {
          setError(json.error?.message ?? 'Failed to generate QR code')
          return
        }
        // Refresh the full list so the new token and old deactivated ones are accurate
        const listRes = await fetch(`/api/incidents/${incidentId}/qr-tokens`)
        const listJson = (await listRes.json()) as { data: QrToken[] }
        setTokens(listJson.data ?? [])
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  // ── Deactivate active token ─────────────────────────────────────────────────

  function handleDeactivate() {
    if (!activeToken) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/incidents/${incidentId}/qr-tokens/${activeToken.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false }),
          },
        )
        if (!res.ok) {
          const json = (await res.json()) as { error: { message: string } | null }
          setError(json.error?.message ?? 'Failed to deactivate QR code')
          return
        }
        setTokens((prev) =>
          prev.map((t) => (t.id === activeToken.id ? { ...t, is_active: false } : t)),
        )
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  // ── Copy URL to clipboard ───────────────────────────────────────────────────

  async function handleCopy() {
    if (!checkInUrl) return
    try {
      await navigator.clipboard.writeText(checkInUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may be blocked in non-HTTPS contexts during dev
      setError('Could not copy — please copy the URL manually')
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold">Volunteer QR Check-In</h2>
          <p className="text-xs text-muted-foreground">
            {activeToken
              ? `Active · ${activeToken.scans} scan${activeToken.scans === 1 ? '' : 's'}`
              : 'No active QR code'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeToken ? (
            <>
              <button
                onClick={handleDeactivate}
                disabled={isPending}
                className="h-8 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Deactivate
              </button>
              <button
                onClick={handleGenerate}
                disabled={isPending}
                className="h-8 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Regenerate
              </button>
            </>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Generating…' : 'Generate QR Code'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-border px-4 py-2 text-xs text-destructive bg-destructive/5">
          {error}
        </div>
      )}

      {/* QR display */}
      {activeToken && checkInUrl ? (
        <div className="flex flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:items-start sm:gap-8">
          {/* QR code */}
          <div className="flex-shrink-0 rounded-xl border border-border p-3 bg-white">
            <QRCode value={checkInUrl} size={160} />
          </div>

          {/* Instructions + URL */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-sm font-medium mb-1">Display this QR code at the staging area</p>
            <p className="text-xs text-muted-foreground mb-4">
              Volunteers scan it with their phone camera — no app download required. They fill
              in a brief form and appear on this board instantly.
            </p>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="flex-1 truncate text-xs font-mono text-muted-foreground">
                  {checkInUrl}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="h-8 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      ) : !activeToken && !isPending ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
          <p className="text-sm font-medium">No active QR code</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a QR code so walk-up volunteers can check in from their phones.
          </p>
        </div>
      ) : null}
    </div>
  )
}
