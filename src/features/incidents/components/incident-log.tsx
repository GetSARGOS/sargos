'use client'

import { useState, useTransition, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  LOG_ENTRY_TYPE_LABELS,
  type LogEntryType,
} from '@/features/incidents/schemas'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string
  incident_id: string
  entry_type: string
  message: string
  actor_id: string | null
  actor_name: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

interface IncidentLogProps {
  incidentId: string
  incidentTimezone: string
}

// ─── Entry Type Badge Variants ──────────────────────────────────────────────

const ENTRY_TYPE_VARIANT: Partial<Record<LogEntryType, 'default' | 'secondary' | 'destructive' | 'outline'>> = {
  narrative: 'default',
  incident_status_change: 'destructive',
  personnel_checkin: 'secondary',
  personnel_checkout: 'secondary',
  personnel_status_change: 'outline',
  role_assigned: 'outline',
  par_initiated: 'destructive',
  par_completed: 'secondary',
  resource_deployed: 'secondary',
  resource_returned: 'outline',
  system: 'outline',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function IncidentLog({ incidentId, incidentTimezone }: IncidentLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Format timestamp in incident timezone
  const formatTime = useCallback(
    (iso: string) => {
      return new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: incidentTimezone,
        timeZoneName: 'short',
      }).format(new Date(iso))
    },
    [incidentTimezone],
  )

  // Fetch log entries
  const fetchEntries = useCallback(
    async (cursorParam: string | null) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: '50' })
        if (cursorParam) params.set('cursor', cursorParam)

        const res = await fetch(`/api/incidents/${incidentId}/log?${params}`)
        const json = (await res.json()) as {
          data: { entries: LogEntry[] } | null
          error: { code: string; message: string } | null
          meta: { cursor: string | null; hasMore: boolean } | null
        }

        if (!res.ok || !json.data) {
          setError(json.error?.message ?? 'Failed to load log')
          return
        }

        setEntries((prev) => (cursorParam ? [...prev, ...json.data!.entries] : json.data!.entries))
        setCursor(json.meta?.cursor ?? null)
        setHasMore(json.meta?.hasMore ?? false)
        setInitialLoaded(true)
      } catch {
        setError('Network error — please try again')
      } finally {
        setIsLoading(false)
      }
    },
    [incidentId],
  )

  // Load initial entries on first render
  if (!initialLoaded && !isLoading) {
    fetchEntries(null)
  }

  // Submit narrative entry
  function handleSubmitNarrative() {
    if (!narrative.trim()) return
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: narrative.trim() }),
        })

        const json = (await res.json()) as {
          data: { entry: LogEntry } | null
          error: { code: string; message: string } | null
        }

        if (!res.ok || !json.data) {
          setError(json.error?.message ?? 'Failed to add entry')
          return
        }

        // Prepend new entry to the list
        setEntries((prev) => [json.data!.entry, ...prev])
        setNarrative('')
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Narrative entry form */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Add Log Entry
        </h3>
        <div className="flex gap-3">
          <Textarea
            placeholder="IC narrative, situation update, or notes…"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={2}
            className="flex-1 resize-none"
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSubmitNarrative()
              }
            }}
          />
          <Button
            onClick={handleSubmitNarrative}
            disabled={isPending || !narrative.trim()}
            className="self-end"
          >
            {isPending ? 'Adding…' : 'Add Entry'}
          </Button>
        </div>
        {error && (
          <div className="mt-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Log entries list */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Incident Log
            {initialLoaded && (
              <span className="ml-2 font-normal normal-case">
                ({entries.length}{hasMore ? '+' : ''} entries)
              </span>
            )}
          </h3>
        </div>
        <Separator />

        {!initialLoaded && isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading log entries…</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No log entries yet.</div>
        ) : (
          <div className="divide-y">
            {entries.map((entry) => (
              <div key={entry.id} className="flex gap-3 px-4 py-3">
                <div className="w-28 shrink-0 text-xs text-muted-foreground pt-0.5">
                  {formatTime(entry.created_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={ENTRY_TYPE_VARIANT[entry.entry_type as LogEntryType] ?? 'outline'}
                      className="text-[10px]"
                    >
                      {LOG_ENTRY_TYPE_LABELS[entry.entry_type as LogEntryType] ?? entry.entry_type}
                    </Badge>
                    {entry.actor_name && (
                      <span className="text-xs text-muted-foreground">{entry.actor_name}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{entry.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && initialLoaded && (
          <div className="border-t p-3 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchEntries(cursor)}
              disabled={isLoading}
            >
              {isLoading ? 'Loading…' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
