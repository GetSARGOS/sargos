'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { PersonnelStatus, IncidentRole } from '@/features/incidents/schemas'
import type { PersonnelWithMember } from './personnel-board'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParEvent {
  id: string
  incident_id: string
  organization_id: string
  initiated_by: string
  initiated_at: string
  completed_at: string | null
  total_personnel: number
  confirmed_count: number
  unaccounted_ids: string[]
}

export interface ParResponse {
  id: string
  par_event_id: string
  personnel_id: string
  confirmed_safe: boolean
  confirmed_at: string
  notes: string | null
}

interface ParPanelProps {
  incidentId: string
  initialParEvent: ParEvent | null
  initialResponses: ParResponse[]
  personnel: PersonnelWithMember[]
}

// ─── PAR Panel ────────────────────────────────────────────────────────────────

export function ParPanel({ incidentId, initialParEvent, initialResponses, personnel }: ParPanelProps) {
  const [parEvent, setParEvent] = useState<ParEvent | null>(initialParEvent)
  const [responses, setResponses] = useState<ParResponse[]>(initialResponses)
  // livePersonnel mirrors the server-rendered list but removes anyone who checks out
  // after page load. Without this, stale personnel appear in the PAR table even after
  // checking out, causing PERSONNEL_NOT_FOUND errors when "Mark Safe" is clicked.
  const [livePersonnel, setLivePersonnel] = useState<PersonnelWithMember[]>(personnel)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Mutable refs so Realtime event handlers (set up once at mount) always read
  // the latest state values without being stale closures.
  const responsesRef = useRef(responses)
  const parEventRef = useRef(parEvent)
  responsesRef.current = responses
  parEventRef.current = parEvent

  // Map from personnelId → response for O(1) lookup
  const responseMap = useMemo(() => {
    const m = new Map<string, ParResponse>()
    for (const r of responses) {
      m.set(r.personnel_id, r)
    }
    return m
  }, [responses])

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    // cancelled flag: prevents the Strict Mode first-run effect from setting up
    // a channel after React has already cleaned up and re-run the effect.
    let cancelled = false

    function setupChannel(accessToken: string) {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      supabase.realtime.setAuth(accessToken)

      const channel = supabase
        .channel(`incident:${incidentId}:par`)
        // New PAR event initiated by someone else
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'incident_par_events',
            filter: `incident_id=eq.${incidentId}`,
          },
          (payload) => {
            const newEvent = payload.new as ParEvent
            setParEvent(newEvent)
            setResponses([])
          },
        )
        // PAR event updated (confirmed_count / completed_at changes)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'incident_par_events',
            filter: `incident_id=eq.${incidentId}`,
          },
          (payload) => {
            const updated = payload.new as ParEvent
            setParEvent((prev) => {
              if (!prev || prev.id !== updated.id) return prev
              return {
                ...updated,
                // Never let a stale Realtime UPDATE raise total_personnel — the checkout
                // path decrements client-state immediately, but a concurrent mark-safe
                // update may carry a stale (higher) total from the DB if the checkout's
                // PAR update hadn't committed yet when mark-safe read the row.
                total_personnel: Math.min(prev.total_personnel, updated.total_personnel),
                // completed_at is monotonic — once set (optimistically or by server) it
                // must never be cleared by a later stale update.
                completed_at: updated.completed_at ?? prev.completed_at,
              }
            })
          },
        )
        // New response recorded
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'incident_par_responses',
            filter: `incident_id=eq.${incidentId}`,
          },
          (payload) => {
            const newResponse = payload.new as ParResponse
            // Replace any existing entry for this person (optimistic or real) keyed by
            // personnel_id — the optimistic entry has a fake id so id-based dedup misses it,
            // which caused double-counting (2 entries per click → count inflated by 2x).
            setResponses((prev) => {
              const filtered = prev.filter((r) => r.personnel_id !== newResponse.personnel_id)
              return [...filtered, newResponse]
            })
          },
        )
        // Personnel check-out — remove from live list so "Mark Safe" doesn't appear
        // for people who checked out after page load (would cause PERSONNEL_NOT_FOUND).
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'incident_personnel',
            filter: `incident_id=eq.${incidentId}`,
          },
          (payload) => {
            const updated = payload.new as { id: string; checked_out_at: string | null }
            if (updated.checked_out_at !== null) {
              // Use refs (not closed-over state) so we always read the latest values.
              // Exclude the departing person's response when counting safe responses.
              const currentResponses = responsesRef.current
              const currentParEvent = parEventRef.current
              const newSafeCount = currentResponses.filter(
                (r) => r.confirmed_safe && r.personnel_id !== updated.id,
              ).length
              const newTotal = Math.max(0, (currentParEvent?.total_personnel ?? 0) - 1)
              // Only optimistically complete if PAR is still active and everyone remaining is safe.
              const willComplete = !currentParEvent?.completed_at && newTotal > 0 && newSafeCount >= newTotal
              const optimisticCompletedAt = willComplete ? new Date().toISOString() : null

              setLivePersonnel((prev) => prev.filter((p) => p.id !== updated.id))
              // Clear their PAR response so confirmedCount (derived from responses) stays correct.
              setResponses((prev) => prev.filter((r) => r.personnel_id !== updated.id))
              // Decrement total_personnel and, if the checkout causes PAR completion, set
              // completed_at optimistically. The follow-on Realtime UPDATE on incident_par_events
              // will arrive with the server's completed_at timestamp and overwrite if needed.
              setParEvent((prev) => {
                if (!prev || prev.completed_at !== null) return prev
                return {
                  ...prev,
                  total_personnel: Math.max(0, prev.total_personnel - 1),
                  ...(optimisticCompletedAt ? { completed_at: optimisticCompletedAt } : {}),
                }
              })
            }
          },
        )
        // New personnel check-in — add to live list so they appear in the PAR table.
        // This fires on other tabs when someone is checked in during an active PAR.
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'incident_personnel',
            filter: `incident_id=eq.${incidentId}`,
          },
          async (payload) => {
            const newRow = payload.new as Record<string, unknown>
            const personnelId = newRow['id'] as string

            // Build the entry with memberName: null immediately — name is filled in after
            // the async fetch below. Adding to livePersonnel synchronously (before the await)
            // ensures activePersonnel.length is correct when handleMarkSafe runs, preventing
            // false PAR completion (e.g. 1 >= 1 = true when it should be 1 >= 2 = false).
            const entry: PersonnelWithMember = {
              id: personnelId,
              incident_id: newRow['incident_id'] as string,
              organization_id: newRow['organization_id'] as string,
              member_id: (newRow['member_id'] as string | null) ?? null,
              volunteer_name: (newRow['volunteer_name'] as string | null) ?? null,
              volunteer_phone: (newRow['volunteer_phone'] as string | null) ?? null,
              volunteer_certifications: (newRow['volunteer_certifications'] as string[]) ?? [],
              personnel_type: newRow['personnel_type'] as 'member' | 'volunteer',
              checkin_method: newRow['checkin_method'] as 'manual' | 'qr_scan' | 'app',
              checked_in_at: newRow['checked_in_at'] as string,
              checked_out_at: (newRow['checked_out_at'] as string | null) ?? null,
              status: newRow['status'] as PersonnelStatus,
              incident_role: (newRow['incident_role'] as IncidentRole | null) ?? null,
              assigned_sector_id: (newRow['assigned_sector_id'] as string | null) ?? null,
              assigned_team_id: (newRow['assigned_team_id'] as string | null) ?? null,
              last_checked_in_at: (newRow['last_checked_in_at'] as string | null) ?? null,
              notes: (newRow['notes'] as string | null) ?? null,
              updated_at: newRow['updated_at'] as string,
              memberName: null,
              memberPhone: null,
              memberCertifications: [],
            }

            // Add to list and increment PAR total synchronously — before any await.
            setLivePersonnel((prev) => {
              const exists = prev.some((p) => p.id === entry.id)
              return exists ? prev : [...prev, entry]
            })
            setParEvent((prev) => {
              if (!prev || prev.completed_at !== null) return prev
              return { ...prev, total_personnel: prev.total_personnel + 1 }
            })

            // Fetch member name and patch the entry once the name arrives.
            if (newRow['member_id']) {
              const { data: memberRow } = await supabase
                .from('organization_members')
                .select('display_name')
                .eq('id', newRow['member_id'] as string)
                .single()
              if (memberRow) {
                setLivePersonnel((prev) =>
                  prev.map((p) =>
                    p.id === personnelId ? { ...p, memberName: memberRow.display_name } : p,
                  ),
                )
              }
            }
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            // Only reconnect on actual errors — CLOSED means we intentionally
            // removed the channel (e.g. effect cleanup), not a network failure.
            setTimeout(async () => {
              if (cancelled) return
              const { data: { session } } = await supabase.auth.getSession()
              if (session) setupChannel(session.access_token)
            }, 2000)
          }
        })

      channelRef.current = channel
    }

    // INITIAL_SESSION fires once per onAuthStateChange registration, after
    // Supabase auth finishes initialising (including any token refresh). It
    // always carries the valid session if one exists — never a stale token.
    //
    // We do NOT use getSession().then() because on first page load it races
    // with TOKEN_REFRESHED (which also fires during init when the token needed
    // refreshing), causing two simultaneous setupChannel calls, channel
    // teardown races, and a phx_join that lands while the socket accessToken
    // is briefly null — breaking RLS on the server side.
    //
    // TOKEN_REFRESHED (hourly) is handled automatically by the Supabase client's
    // internal auth listener which calls realtime.setAuth(new_token), updating
    // the existing subscription's JWT without needing to recreate the channel.
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return
        if (event === 'INITIAL_SESSION' && session !== null) {
          setupChannel(session.access_token)
        } else if (event === 'SIGNED_OUT') {
          if (channelRef.current) {
            void supabase.removeChannel(channelRef.current)
            channelRef.current = null
          }
        }
      },
    )

    return () => {
      cancelled = true
      authSub.unsubscribe()
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [incidentId, supabase])

  // ── Initiate PAR ───────────────────────────────────────────────────────────
  function handleInitiatePar() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/par`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
        const json = (await res.json()) as {
          data: { parEventId: string; totalPersonnel: number } | null
          error: { message: string } | null
        }
        if (!res.ok || !json.data) {
          setError(json.error?.message ?? 'Failed to initiate PAR')
          return
        }
        // Realtime INSERT will update state, but also fetch to get the full event object
        const parRes = await fetch(`/api/incidents/${incidentId}/par`)
        const parJson = (await parRes.json()) as {
          data: { parEvent: ParEvent | null; responses: ParResponse[] } | null
          error: { message: string } | null
        }
        if (parJson.data?.parEvent) {
          setParEvent(parJson.data.parEvent)
          setResponses(parJson.data.responses)
        }
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  // ── Mark safe ─────────────────────────────────────────────────────────────
  function handleMarkSafe(personnelId: string) {
    if (!parEvent) return
    setError(null)

    // Optimistic response
    const optimisticResponse: ParResponse = {
      id: `optimistic-${personnelId}`,
      par_event_id: parEvent.id,
      personnel_id: personnelId,
      confirmed_safe: true,
      confirmed_at: new Date().toISOString(),
      notes: null,
    }
    setResponses((prev) => {
      const filtered = prev.filter((r) => r.personnel_id !== personnelId)
      return [...filtered, optimisticResponse]
    })

    // Optimistically complete the PAR if this is the last response.
    // Count safe responses excluding any prior response for this person, then add 1.
    // Use activePersonnel.length (derived from livePersonnel) rather than parEvent.total_personnel —
    // parEvent.total_personnel can lag when a new check-in's Realtime UPDATE hasn't arrived yet,
    // causing 1 >= 1 = true false-completion when the real denominator is 2.
    const newConfirmedCount =
      responses.filter((r) => r.confirmed_safe && r.personnel_id !== personnelId).length + 1
    const willComplete = newConfirmedCount >= activePersonnel.length
    const completedAt = new Date().toISOString()
    if (willComplete) {
      setParEvent((prev) =>
        prev ? { ...prev, confirmed_count: newConfirmedCount, completed_at: completedAt } : prev,
      )
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/par/${parEvent.id}/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personnelId, confirmedSafe: true }),
        })
        if (!res.ok) {
          // Rollback both the response and any optimistic completion
          setResponses((prev) => prev.filter((r) => r.id !== optimisticResponse.id))
          if (willComplete) {
            setParEvent((prev) =>
              prev ? { ...prev, confirmed_count: parEvent.confirmed_count, completed_at: null } : prev,
            )
          }
          const json = (await res.json()) as { error: { message: string } | null }
          setError(json.error?.message ?? 'Failed to record response')
        }
        // Realtime UPDATE on par_events will confirm the server state
      } catch {
        setResponses((prev) => prev.filter((r) => r.id !== optimisticResponse.id))
        if (willComplete) {
          setParEvent((prev) =>
            prev ? { ...prev, confirmed_count: parEvent.confirmed_count, completed_at: null } : prev,
          )
        }
        setError('Network error — please try again')
      }
    })
  }

  const activePersonnel = livePersonnel.filter((p) => p.checked_out_at === null)
  const confirmedCount = responses.filter((r) => r.confirmed_safe).length
  const progressPercent = parEvent && parEvent.total_personnel > 0
    ? Math.round((confirmedCount / parEvent.total_personnel) * 100)
    : 0

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold">PAR Roll Call</h2>
          {parEvent && !parEvent.completed_at && (
            <p className="text-xs text-muted-foreground">
              {confirmedCount} / {parEvent.total_personnel} accounted for
            </p>
          )}
          {parEvent?.completed_at && (
            <p className="text-xs text-green-600">
              Completed at {new Date(parEvent.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={handleInitiatePar}
          disabled={isPending}
          className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Starting…' : parEvent ? 'New PAR' : 'Initiate PAR'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {!parEvent ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium">No PAR initiated</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click &ldquo;Initiate PAR&rdquo; to start a roll call for all checked-in personnel.
          </p>
        </div>
      ) : (
        <div>
          {/* Progress bar */}
          <div className="px-4 pt-3 pb-2">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${parEvent.completed_at ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {activePersonnel.length === 0 ? (
            <div className="px-4 pb-4 text-center text-xs text-muted-foreground">
              No personnel currently checked in.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">PAR Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {activePersonnel.map((p) => {
                  const name =
                    p.personnel_type === 'member'
                      ? (p.memberName ?? '—')
                      : (p.volunteer_name ?? 'Volunteer')
                  const response = responseMap.get(p.id)
                  const hasResponded = response !== undefined
                  const isSafe = response?.confirmed_safe === true

                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">{name}</td>
                      <td className="px-4 py-2.5">
                        {hasResponded ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                              isSafe
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`h-1.5 w-1.5 rounded-full ${isSafe ? 'bg-green-500' : 'bg-red-500'}`}
                            />
                            {isSafe ? 'Safe' : 'Unaccounted'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            No response
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {!parEvent.completed_at && !hasResponded && (
                          <button
                            onClick={() => handleMarkSafe(p.id)}
                            disabled={isPending}
                            className="h-7 rounded-md bg-green-600 px-2.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Mark Safe
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
