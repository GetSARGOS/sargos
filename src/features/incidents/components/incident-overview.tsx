'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
  INCIDENT_TYPE_LABELS,
  type IncidentType,
  type IncidentStatus,
} from '@/features/incidents/schemas'
import type { IncidentData } from './incident-board'
import { SubjectList, type SubjectRow } from './subject-list'
import { CommandStructurePanel } from './command-structure-panel'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommandStructureRow {
  id: string
  ics_role: string
  member_id: string | null
  assigned_at: string
  relieved_at: string | null
  memberName: string | null
}

export interface OperationalPeriodData {
  id: string
  period_number: number
  starts_at: string
  objectives: string | null
  weather_summary: string | null
}

interface OrgMember {
  id: string
  display_name: string
}

interface IncidentOverviewProps {
  incident: IncidentData
  initialCommandStructure: CommandStructureRow[]
  initialSubjects: SubjectRow[]
  initialCurrentPeriod: OperationalPeriodData | null
  orgMembers: OrgMember[]
  checkedInMemberIds: string[]
  currentUserMemberId: string
  currentUserIncidentRole: string | null
  isOrgAdmin: boolean
  onStatusChange: (newStatus: string) => void
}

// ─── Status Badge Styles ────────────────────────────────────────────────────

const STATUS_BADGE_VARIANT: Record<IncidentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  planning: 'secondary',
  suspended: 'outline',
  closed: 'secondary',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function IncidentOverview({
  incident,
  initialCommandStructure,
  initialSubjects,
  initialCurrentPeriod,
  orgMembers,
  checkedInMemberIds,
  currentUserMemberId,
  currentUserIncidentRole,
  isOrgAdmin,
  onStatusChange,
}: IncidentOverviewProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [afterActionNotes, setAfterActionNotes] = useState('')
  const [currentPeriod, setCurrentPeriod] = useState(initialCurrentPeriod)
  const [newPeriodOpen, setNewPeriodOpen] = useState(false)

  const status = incident.status as IncidentStatus
  const isIc = currentUserIncidentRole === 'incident_commander'
  const canControlStatus = isIc || isOrgAdmin
  const canEditSubjects = isIc || isOrgAdmin || currentUserIncidentRole === 'planning_section_chief'
  const canStartPeriod = isIc || isOrgAdmin || currentUserIncidentRole === 'planning_section_chief'

  const fmt = new Intl.DateTimeFormat('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: incident.timezone, timeZoneName: 'short',
  })

  async function handleStatusChange(newStatus: 'active' | 'suspended' | 'closed') {
    setError(null)
    startTransition(async () => {
      try {
        const body: Record<string, string> = { status: newStatus }
        if (newStatus === 'closed' && afterActionNotes.trim()) {
          body.afterActionNotes = afterActionNotes.trim()
        }

        const res = await fetch(`/api/incidents/${incident.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const json = (await res.json()) as {
          data: { incidentId: string; newStatus: string } | null
          error: { code: string; message: string } | null
        }

        if (!res.ok || !json.data) {
          setError(json.error?.message ?? 'Failed to update status')
          return
        }

        onStatusChange(newStatus)
        setAfterActionNotes('')
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  async function handleStartNewPeriod(formData: FormData) {
    setError(null)
    const objectives = (formData.get('objectives') as string) || undefined
    const weatherSummary = (formData.get('weatherSummary') as string) || undefined

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incident.id}/operational-periods`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectives, weatherSummary }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to start new period')
          return
        }
        setCurrentPeriod({
          id: json.data.periodId,
          period_number: json.data.periodNumber,
          starts_at: new Date().toISOString(),
          objectives: objectives ?? null,
          weather_summary: weatherSummary ?? null,
        })
        setNewPeriodOpen(false)
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Incident summary card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{incident.name}</h2>
              <Badge variant={STATUS_BADGE_VARIANT[status]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                {INCIDENT_TYPE_LABELS[incident.incident_type as IncidentType] ?? incident.incident_type}
              </span>
              {incident.location_address && (
                <>
                  <span>·</span>
                  <span>{incident.location_address}</span>
                </>
              )}
              {incident.started_at && (
                <>
                  <span>·</span>
                  <span>Started {fmt.format(new Date(incident.started_at))}</span>
                </>
              )}
              <span>·</span>
              <span>Op Period {currentPeriod?.period_number ?? incident.current_operational_period}</span>
            </div>
          </div>

          {/* Status actions — IC or org admin (emergency override) */}
          {status !== 'closed' && canControlStatus && (
            <div className="flex items-center gap-2">
              {status === 'active' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isPending}>Suspend</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Suspend Incident?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Suspending the incident pauses all active operations. Personnel remain checked in
                        but field operations are halted. You can resume at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="sm:flex-1">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="sm:flex-1"
                        onClick={() => handleStatusChange('suspended')}
                      >
                        Suspend Incident
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {status === 'suspended' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isPending}>Resume</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resume Incident?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will resume active operations. All checked-in personnel will be notified.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="sm:flex-1">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="sm:flex-1"
                        onClick={() => handleStatusChange('active')}
                      >
                        Resume Incident
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isPending}>Close Incident</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close Incident?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Closing the incident is permanent. All personnel will be checked out and QR tokens
                      deactivated. The incident will become read-only.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="px-0">
                    <label htmlFor="after-action" className="text-sm font-medium">
                      After-Action Notes (optional)
                    </label>
                    <Textarea
                      id="after-action"
                      placeholder="Summary of the incident, outcomes, lessons learned…"
                      value={afterActionNotes}
                      onChange={(e) => setAfterActionNotes(e.target.value)}
                      className="mt-1"
                      rows={4}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="sm:flex-1">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      className="sm:flex-1"
                      onClick={() => handleStatusChange('closed')}
                    >
                      Close Incident
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Command Structure */}
      <CommandStructurePanel
        incidentId={incident.id}
        initialCommandStructure={initialCommandStructure}
        orgMembers={orgMembers}
        checkedInMemberIds={checkedInMemberIds}
        isIc={isIc}
        currentUserMemberId={currentUserMemberId}
      />

      {/* Subject Information */}
      <SubjectList
        incidentId={incident.id}
        initialSubjects={initialSubjects}
        canEdit={canEditSubjects}
        timezone={incident.timezone}
      />

      {/* Operational Period */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Operational Period
          </h3>
          {canStartPeriod && status !== 'closed' && (
            <Dialog open={newPeriodOpen} onOpenChange={setNewPeriodOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={isPending}>Start New Period</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Operational Period</DialogTitle>
                  <DialogDescription>
                    Close the current period and start a new one. This action is recorded in the incident log.
                  </DialogDescription>
                </DialogHeader>
                <form action={handleStartNewPeriod} className="space-y-4">
                  <div>
                    <Label htmlFor="period-objectives">Objectives</Label>
                    <Textarea id="period-objectives" name="objectives" rows={3} placeholder="Primary objectives for this operational period…" />
                  </div>
                  <div>
                    <Label htmlFor="period-weather">Weather Summary</Label>
                    <Textarea id="period-weather" name="weatherSummary" rows={2} placeholder="Current and forecasted conditions…" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isPending}>Start Period</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <Separator className="my-3" />
        {currentPeriod ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">Period {currentPeriod.period_number}</span>
              <span className="text-muted-foreground">
                Started {fmt.format(new Date(currentPeriod.starts_at))}
              </span>
            </div>
            {currentPeriod.objectives && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Objectives</p>
                <p className="text-sm">{currentPeriod.objectives}</p>
              </div>
            )}
            {currentPeriod.weather_summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Weather</p>
                <p className="text-sm">{currentPeriod.weather_summary}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No operational period data available.</p>
        )}
      </div>
    </div>
  )
}
