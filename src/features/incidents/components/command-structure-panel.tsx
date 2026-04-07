'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  INCIDENT_ROLE_LABELS,
  ASSIGNABLE_ICS_ROLES,
  OUTGOING_IC_ROLES,
  type IncidentRole,
  type AssignableIcsRole,
  type OutgoingIcRole,
} from '@/features/incidents/schemas'
import type { CommandStructureRow } from './incident-overview'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrgMember {
  id: string
  display_name: string
}

interface PersonnelMember {
  member_id: string | null
}

interface CommandStructurePanelProps {
  incidentId: string
  initialCommandStructure: CommandStructureRow[]
  orgMembers: OrgMember[]
  checkedInMemberIds: string[]
  isIc: boolean
  currentUserMemberId: string
}

const OUTGOING_ROLE_LABELS: Record<OutgoingIcRole, string> = {
  field_member: 'Field Member',
  observer: 'Observer',
  stood_down: 'Stood Down',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CommandStructurePanel({
  incidentId,
  initialCommandStructure,
  orgMembers,
  checkedInMemberIds,
  isIc,
  currentUserMemberId,
}: CommandStructurePanelProps) {
  const [commandStructure, setCommandStructure] = useState(initialCommandStructure)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [handOffOpen, setHandOffOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const activeRoles = commandStructure.filter((r) => r.relieved_at === null)
  const relievedRoles = commandStructure.filter((r) => r.relieved_at !== null)

  // Filter org members to only checked-in personnel
  const checkedInMembers = orgMembers.filter((m) => checkedInMemberIds.includes(m.id))

  async function refreshCommandStructure() {
    // Re-fetch from the page server component isn't possible — we'll reload
    // For now, do a simple approach: toggle state optimistically
  }

  async function handleAssignRole(formData: FormData) {
    setError(null)
    const memberId = formData.get('memberId') as string
    const icsRole = formData.get('icsRole') as string

    if (!memberId || !icsRole) {
      setError('Please select a member and role')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/command-structure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, icsRole }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to assign role')
          return
        }

        // Optimistic update: add the new assignment; relieve (a) any current
        // holder of the target role, and (b) any other active role held by the
        // target member — one member holds one role at a time.
        const memberName = orgMembers.find((m) => m.id === memberId)?.display_name ?? 'Unknown'
        const now = new Date().toISOString()
        setCommandStructure((prev) => {
          const updated = prev.map((r) => {
            if (r.relieved_at !== null) return r
            const isCurrentHolderOfRole = r.ics_role === icsRole && r.member_id !== memberId
            const isOtherActiveRoleOfMember = r.member_id === memberId && r.ics_role !== icsRole
            if (isCurrentHolderOfRole || isOtherActiveRoleOfMember) {
              return { ...r, relieved_at: now }
            }
            return r
          })
          updated.push({
            id: json.data.commandStructureId,
            ics_role: icsRole,
            member_id: memberId,
            assigned_at: now,
            relieved_at: null,
            memberName,
          })
          return updated
        })
        setAssignOpen(false)
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  async function handleHandOff(formData: FormData) {
    setError(null)
    const newIcMemberId = formData.get('newIcMemberId') as string
    const outgoingIcNewRole = formData.get('outgoingIcNewRole') as string

    if (!newIcMemberId || !outgoingIcNewRole) {
      setError('Please select the new IC and your new role')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/hand-off`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newIcMemberId, outgoingIcNewRole }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to hand off IC')
          return
        }

        // Optimistic update: relieve (a) the outgoing IC's row, and (b) any
        // other active role the new IC was holding (e.g. Deputy IC). One member
        // holds at most one command role at a time.
        const newIcName = orgMembers.find((m) => m.id === newIcMemberId)?.display_name ?? 'Unknown'
        const now = new Date().toISOString()
        setCommandStructure((prev) => {
          const updated = prev.map((r) => {
            if (r.relieved_at !== null) return r
            const isOutgoingIc = r.ics_role === 'incident_commander'
            const isOtherActiveRoleOfNewIc = r.member_id === newIcMemberId
            if (isOutgoingIc || isOtherActiveRoleOfNewIc) {
              return { ...r, relieved_at: now }
            }
            return r
          })
          updated.push({
            id: json.data.newIcCommandStructureId,
            ics_role: 'incident_commander',
            member_id: newIcMemberId,
            assigned_at: now,
            relieved_at: null,
            memberName: newIcName,
          })
          return updated
        })
        setHandOffOpen(false)
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Command Structure
        </h3>
        {isIc && (
          <div className="flex gap-2">
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={isPending}>Assign Role</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign ICS Role</DialogTitle>
                  <DialogDescription>Assign an ICS command role to a checked-in team member.</DialogDescription>
                </DialogHeader>
                <form action={handleAssignRole} className="space-y-4">
                  <div>
                    <Label htmlFor="assign-member">Team Member</Label>
                    <Select name="memberId" required>
                      <SelectTrigger id="assign-member" className="w-full">
                        <SelectValue placeholder="Select member…" />
                      </SelectTrigger>
                      <SelectContent>
                        {checkedInMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="assign-role">ICS Role</Label>
                    <Select name="icsRole" required>
                      <SelectTrigger id="assign-role" className="w-full">
                        <SelectValue placeholder="Select role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ICS_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{INCIDENT_ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isPending}>Assign</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={handOffOpen} onOpenChange={setHandOffOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={isPending}>Hand Off IC</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Hand Off Incident Commander</DialogTitle>
                  <DialogDescription>Transfer IC responsibility to another team member. This is immediate and recorded in the incident log.</DialogDescription>
                </DialogHeader>
                <form action={handleHandOff} className="space-y-4">
                  <div>
                    <Label htmlFor="handoff-newIc">New Incident Commander</Label>
                    <Select name="newIcMemberId" required>
                      <SelectTrigger id="handoff-newIc" className="w-full">
                        <SelectValue placeholder="Select member…" />
                      </SelectTrigger>
                      <SelectContent>
                        {checkedInMembers
                          .filter((m) => m.id !== currentUserMemberId)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="handoff-outgoingRole">Your New Role</Label>
                    <Select name="outgoingIcNewRole" required>
                      <SelectTrigger id="handoff-outgoingRole" className="w-full">
                        <SelectValue placeholder="Select role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTGOING_IC_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{OUTGOING_ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isPending}>Confirm Hand-Off</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
      <Separator className="my-3" />

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {activeRoles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No command roles assigned.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeRoles.map((row) => (
            <div key={row.id} className="rounded-lg border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                {INCIDENT_ROLE_LABELS[row.ics_role as IncidentRole] ?? row.ics_role}
              </p>
              <p className="text-sm font-medium">
                {row.memberName ?? 'Unassigned'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* History section */}
      {relievedRoles.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showHistory ? 'Hide' : 'Show'} history ({relievedRoles.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1">
              {relievedRoles.map((row) => (
                <div key={row.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{INCIDENT_ROLE_LABELS[row.ics_role as IncidentRole] ?? row.ics_role}</span>
                  <span>—</span>
                  <span>{row.memberName ?? 'Unknown'}</span>
                  <span className="text-xs opacity-60">
                    (relieved)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
