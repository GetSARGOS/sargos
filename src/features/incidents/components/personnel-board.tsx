'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PERSONNEL_STATUSES,
  PERSONNEL_STATUS_LABELS,
  INCIDENT_ROLES,
  INCIDENT_ROLE_LABELS,
  type PersonnelStatus,
  type IncidentRole,
  CheckInPersonnelSchema,
} from '@/features/incidents/schemas'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

// Avoid Supabase relational join type inference (not supported in hand-authored stubs).
// Member data is merged manually after two separate fetches.
export interface PersonnelWithMember {
  id: string
  incident_id: string
  organization_id: string
  member_id: string | null
  volunteer_name: string | null
  volunteer_phone: string | null
  volunteer_certifications: string[]
  personnel_type: 'member' | 'volunteer'
  checkin_method: 'manual' | 'qr_scan' | 'app'
  checked_in_at: string
  checked_out_at: string | null
  status: PersonnelStatus
  incident_role: IncidentRole | null
  assigned_sector_id: string | null
  assigned_team_id: string | null
  last_checked_in_at: string | null
  notes: string | null
  updated_at: string
  // Merged from organization_members
  memberName: string | null
  memberPhone: string | null
  memberCertifications: string[]
}

export interface OrgMember {
  id: string
  display_name: string
}

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<PersonnelStatus, string> = {
  available: 'bg-green-100 text-green-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_field: 'bg-orange-100 text-orange-800',
  resting: 'bg-yellow-100 text-yellow-800',
  injured: 'bg-red-100 text-red-800',
  stood_down: 'bg-muted text-muted-foreground',
}

// ─── Check In Form ────────────────────────────────────────────────────────────

interface CheckInFormProps {
  incidentId: string
  orgMembers: OrgMember[]
  alreadyCheckedInIds: Set<string>
  onCheckedIn: () => void
  onCancel: () => void
}

function CheckInForm({ incidentId, orgMembers, alreadyCheckedInIds, onCheckedIn, onCancel }: CheckInFormProps) {
  const [memberId, setMemberId] = useState('')
  const [incidentRole, setIncidentRole] = useState<IncidentRole | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const availableMembers = useMemo(
    () => orgMembers.filter((m) => !alreadyCheckedInIds.has(m.id)),
    [orgMembers, alreadyCheckedInIds],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = CheckInPersonnelSchema.safeParse({
      memberId,
      incidentRole: incidentRole || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/personnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        })
        const json = (await res.json()) as { error: { message: string } | null }
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to check in')
          return
        }
        onCheckedIn()
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="check-in-member" className="sr-only">
          Select member
        </label>
        <select
          id="check-in-member"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          required
        >
          <option value="">Select member…</option>
          {availableMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="check-in-role" className="sr-only">
          Incident role (optional)
        </label>
        <select
          id="check-in-role"
          value={incidentRole}
          onChange={(e) => setIncidentRole(e.target.value as IncidentRole | '')}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">No role</option>
          {INCIDENT_ROLES.map((r) => (
            <option key={r} value={r}>
              {INCIDENT_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <button
        type="submit"
        disabled={isPending || !memberId}
        className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? 'Checking in…' : 'Check In'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
      >
        Cancel
      </button>
    </form>
  )
}

// ─── Status Select ────────────────────────────────────────────────────────────

interface StatusSelectProps {
  personnelId: string
  incidentId: string
  currentStatus: PersonnelStatus
  onStatusChange: (personnelId: string, status: PersonnelStatus) => void
  onRollback: (personnelId: string, status: PersonnelStatus) => void
}

function StatusSelect({ personnelId, incidentId, currentStatus, onStatusChange, onRollback }: StatusSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as PersonnelStatus
    const previousStatus = currentStatus

    // Optimistic update
    onStatusChange(personnelId, newStatus)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/personnel/${personnelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        if (!res.ok) {
          onRollback(personnelId, previousStatus)
        }
      } catch {
        onRollback(personnelId, previousStatus)
      }
    })
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Personnel status"
      className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 cursor-pointer ${STATUS_STYLES[currentStatus]} disabled:opacity-70`}
    >
      {PERSONNEL_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-background text-foreground">
          {PERSONNEL_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}

// ─── Role Select ──────────────────────────────────────────────────────────────

interface RoleSelectProps {
  personnelId: string
  incidentId: string
  currentRole: IncidentRole | null
  onRoleChange: (personnelId: string, role: IncidentRole | null) => void
  onRollback: (personnelId: string, role: IncidentRole | null) => void
}

function RoleSelect({ personnelId, incidentId, currentRole, onRoleChange, onRollback }: RoleSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = (e.target.value || null) as IncidentRole | null
    const previousRole = currentRole

    // Optimistic update
    onRoleChange(personnelId, newRole)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/personnel/${personnelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incidentRole: newRole }),
        })
        if (!res.ok) {
          onRollback(personnelId, previousRole)
        }
      } catch {
        onRollback(personnelId, previousRole)
      }
    })
  }

  return (
    <select
      value={currentRole ?? ''}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Incident role"
      className="rounded-md border-0 bg-transparent px-0 py-0.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground focus:outline-none disabled:opacity-70"
    >
      <option value="">No role</option>
      {INCIDENT_ROLES.map((r) => (
        <option key={r} value={r} className="bg-background text-foreground">
          {INCIDENT_ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  )
}

// ─── Check Out Button ─────────────────────────────────────────────────────────

interface CheckOutButtonProps {
  personnelId: string
  incidentId: string
  onCheckOut: (personnelId: string) => void
}

function CheckOutButton({ personnelId, incidentId, onCheckOut }: CheckOutButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    // Optimistic removal
    onCheckOut(personnelId)

    startTransition(async () => {
      try {
        await fetch(`/api/incidents/${incidentId}/personnel/${personnelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkout: true }),
        })
        // On failure we don't roll back the optimistic removal — the Realtime
        // UPDATE will correct state on next event. A full rollback would require
        // re-inserting the row, which is confusing UX for a checkout failure.
      } catch {
        // Network error — same rationale as above
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label="Check out"
      className="h-7 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50 transition-colors"
    >
      {isPending ? '…' : 'Check Out'}
    </button>
  )
}

// ─── Personnel Board ──────────────────────────────────────────────────────────

interface PersonnelBoardProps {
  incidentId: string
  orgId: string
  initialPersonnel: PersonnelWithMember[]
  initialOrgMembers: OrgMember[]
}

export function PersonnelBoard({ incidentId, orgId: _orgId, initialPersonnel, initialOrgMembers }: PersonnelBoardProps) {
  const [personnel, setPersonnel] = useState<PersonnelWithMember[]>(initialPersonnel)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Set of member_ids currently checked in (to filter the check-in dropdown)
  const checkedInMemberIds = useMemo(
    () => new Set(personnel.filter((p) => p.checked_out_at === null && p.member_id).map((p) => p.member_id as string)),
    [personnel],
  )

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    function setupChannel(accessToken: string) {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      supabase.realtime.setAuth(accessToken)

      const channel = supabase
        .channel(`incident:${incidentId}:personnel`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'incident_personnel',
            filter: `incident_id=eq.${incidentId}`,
          },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRow = payload.new as Record<string, unknown>

              let memberName: string | null = null
              let memberPhone: string | null = null
              let memberCertifications: string[] = []

              if (newRow['member_id']) {
                const { data: memberRow } = await supabase
                  .from('organization_members')
                  .select('display_name, phone, certifications')
                  .eq('id', newRow['member_id'] as string)
                  .single()
                if (memberRow) {
                  memberName = memberRow.display_name
                  memberPhone = memberRow.phone
                  memberCertifications = memberRow.certifications
                }
              }

              const entry: PersonnelWithMember = {
                id: newRow['id'] as string,
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
                memberName,
                memberPhone,
                memberCertifications,
              }

              setPersonnel((prev) => {
                const exists = prev.some((p) => p.id === entry.id)
                return exists ? prev : [...prev, entry]
              })
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Record<string, unknown>
              setPersonnel((prev) =>
                prev.map((p) => {
                  if (p.id !== updated['id']) return p
                  return {
                    ...p,
                    status: (updated['status'] as PersonnelStatus) ?? p.status,
                    // Use explicit 'in' check so a null role correctly clears to null
                    // rather than being swallowed by the ?? operator.
                    incident_role: 'incident_role' in updated
                      ? (updated['incident_role'] as IncidentRole | null)
                      : p.incident_role,
                    assigned_sector_id: 'assigned_sector_id' in updated
                      ? (updated['assigned_sector_id'] as string | null)
                      : p.assigned_sector_id,
                    assigned_team_id: 'assigned_team_id' in updated
                      ? (updated['assigned_team_id'] as string | null)
                      : p.assigned_team_id,
                    checked_out_at: 'checked_out_at' in updated
                      ? (updated['checked_out_at'] as string | null)
                      : p.checked_out_at,
                    updated_at: (updated['updated_at'] as string) ?? p.updated_at,
                  }
                }),
              )
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as Record<string, unknown>
              setPersonnel((prev) => prev.filter((p) => p.id !== deleted['id']))
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

    // INITIAL_SESSION fires once per registration, after auth fully initialises
    // (including any token refresh). Using it here guarantees a single setupChannel
    // call per effect run with a valid, post-refresh token. See par-panel.tsx for
    // the full explanation of why getSession() + TOKEN_REFRESHED causes races.
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

  // ── Optimistic status update ───────────────────────────────────────────────
  function handleStatusChange(personnelId: string, newStatus: PersonnelStatus) {
    setPersonnel((prev) =>
      prev.map((p) => (p.id === personnelId ? { ...p, status: newStatus } : p)),
    )
  }

  function handleStatusRollback(personnelId: string, previousStatus: PersonnelStatus) {
    setPersonnel((prev) =>
      prev.map((p) => (p.id === personnelId ? { ...p, status: previousStatus } : p)),
    )
  }

  // ── Optimistic role update ─────────────────────────────────────────────────
  function handleRoleChange(personnelId: string, newRole: IncidentRole | null) {
    setPersonnel((prev) =>
      prev.map((p) => (p.id === personnelId ? { ...p, incident_role: newRole } : p)),
    )
  }

  function handleRoleRollback(personnelId: string, previousRole: IncidentRole | null) {
    setPersonnel((prev) =>
      prev.map((p) => (p.id === personnelId ? { ...p, incident_role: previousRole } : p)),
    )
  }

  // ── Check out ─────────────────────────────────────────────────────────────
  function handleCheckOut(personnelId: string) {
    setPersonnel((prev) =>
      prev.map((p) =>
        p.id === personnelId ? { ...p, checked_out_at: new Date().toISOString() } : p,
      ),
    )
  }

  // ── Personnel checked in — close form ─────────────────────────────────────
  function handleCheckedIn() {
    setShowCheckIn(false)
  }

  const activePersonnel = personnel.filter((p) => p.checked_out_at === null)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Board header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 gap-4">
        <div className="shrink-0">
          <h2 className="font-semibold">Personnel Board</h2>
          <p className="text-xs text-muted-foreground">{activePersonnel.length} checked in</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {showCheckIn ? (
            <CheckInForm
              incidentId={incidentId}
              orgMembers={initialOrgMembers}
              alreadyCheckedInIds={checkedInMemberIds}
              onCheckedIn={handleCheckedIn}
              onCancel={() => setShowCheckIn(false)}
            />
          ) : (
            <button
              onClick={() => setShowCheckIn(true)}
              className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Check In Member
            </button>
          )}
        </div>
      </div>

      {activePersonnel.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium">No personnel checked in</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the button above to check members into this incident.
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Checked In</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {activePersonnel.map((p) => {
              const name =
                p.personnel_type === 'member'
                  ? (p.memberName ?? '—')
                  : (p.volunteer_name ?? 'Volunteer')
              const checkedInTime = new Date(p.checked_in_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {name}
                    {p.personnel_type === 'volunteer' && (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        Volunteer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.personnel_type === 'volunteer' ? (
                      <span className="text-xs text-muted-foreground">Unaffiliated</span>
                    ) : (
                      <RoleSelect
                        personnelId={p.id}
                        incidentId={incidentId}
                        currentRole={p.incident_role}
                        onRoleChange={handleRoleChange}
                        onRollback={handleRoleRollback}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      personnelId={p.id}
                      incidentId={incidentId}
                      currentStatus={p.status}
                      onStatusChange={handleStatusChange}
                      onRollback={handleStatusRollback}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{checkedInTime}</td>
                  <td className="px-4 py-3">
                    <CheckOutButton
                      personnelId={p.id}
                      incidentId={incidentId}
                      onCheckOut={handleCheckOut}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
