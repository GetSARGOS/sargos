'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PersonnelBoard, type PersonnelWithMember } from './personnel-board'
import { ParPanel, type ParEvent, type ParResponse } from './par-panel'
import { ResourceBoard, type DeployedResource, type AvailableResource } from './resource-board'
import { QrPanel } from './qr-panel'
import { IncidentOverview, type CommandStructureRow, type OperationalPeriodData } from './incident-overview'
import { IncidentLog } from './incident-log'
import type { SubjectRow } from './subject-list'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IncidentData {
  id: string
  name: string
  incident_type: string
  status: string
  location_address: string | null
  started_at: string | null
  organization_id: string
  timezone: string
  current_operational_period: number
}

interface OrgMember {
  id: string
  display_name: string
}

interface QrToken {
  id: string
  token: string
  is_active: boolean
  scans: number
  created_at: string
}

export interface IncidentBoardProps {
  incident: IncidentData
  orgId: string
  // Personnel tab
  initialPersonnel: PersonnelWithMember[]
  initialOrgMembers: OrgMember[]
  initialParEvent: ParEvent | null
  initialParResponses: ParResponse[]
  // Resources tab
  initialDeployedResources: DeployedResource[]
  initialAvailableResources: AvailableResource[]
  // QR tab
  initialQrTokens: QrToken[]
  // Overview tab
  initialCommandStructure: CommandStructureRow[]
  initialSubjects: SubjectRow[]
  initialCurrentPeriod: OperationalPeriodData | null
  checkedInMemberIds: string[]
  currentUserMemberId: string
  currentUserIncidentRole: string | null
  isOrgAdmin: boolean
}

// ─── Tab Configuration ──────────────────────────────────────────────────────

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'resources', label: 'Resources' },
  { value: 'map', label: 'Map' },
  { value: 'forms', label: 'Forms' },
  { value: 'log', label: 'Log' },
] as const

type TabValue = (typeof TABS)[number]['value']

const VALID_TABS = new Set<string>(TABS.map((t) => t.value))

// Personnel and Resources tabs stay mounted for Realtime subscriptions
const ALWAYS_MOUNTED_TABS = new Set<TabValue>(['personnel', 'resources'])

// ─── Component ──────────────────────────────────────────────────────────────

export function IncidentBoard({
  incident,
  orgId,
  initialPersonnel,
  initialOrgMembers,
  initialParEvent,
  initialParResponses,
  initialDeployedResources,
  initialAvailableResources,
  initialQrTokens,
  initialCommandStructure,
  initialSubjects,
  initialCurrentPeriod,
  checkedInMemberIds,
  currentUserMemberId,
  currentUserIncidentRole,
  isOrgAdmin,
}: IncidentBoardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const paramTab = searchParams.get('tab') ?? ''
  const activeTab: TabValue = VALID_TABS.has(paramTab) ? (paramTab as TabValue) : 'overview'

  // Track which tabs have been activated (for lazy mounting)
  const [mountedTabs, setMountedTabs] = useState<Set<TabValue>>(() => {
    const initial = new Set<TabValue>([activeTab])
    for (const tab of ALWAYS_MOUNTED_TABS) {
      initial.add(tab)
    }
    return initial
  })

  // Track incident status locally for optimistic UI after status changes
  const [incidentStatus, setIncidentStatus] = useState(incident.status)

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = value as TabValue
      setMountedTabs((prev) => {
        if (prev.has(tab)) return prev
        const next = new Set(prev)
        next.add(tab)
        return next
      })
      // Update URL search param
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const handleStatusChange = useCallback((newStatus: string) => {
    setIncidentStatus(newStatus)
  }, [])

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="w-full justify-start">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Overview tab */}
      <TabsContent value="overview">
        <IncidentOverview
          incident={{ ...incident, status: incidentStatus }}
          initialCommandStructure={initialCommandStructure}
          initialSubjects={initialSubjects}
          initialCurrentPeriod={initialCurrentPeriod}
          orgMembers={initialOrgMembers}
          checkedInMemberIds={checkedInMemberIds}
          currentUserMemberId={currentUserMemberId}
          currentUserIncidentRole={currentUserIncidentRole}
          isOrgAdmin={isOrgAdmin}
          onStatusChange={handleStatusChange}
        />
      </TabsContent>

      {/* Personnel tab — always mounted for Realtime */}
      <TabsContent value="personnel" forceMount className={activeTab !== 'personnel' ? 'hidden' : ''}>
        <div className="space-y-6">
          <PersonnelBoard
            incidentId={incident.id}
            orgId={orgId}
            initialPersonnel={initialPersonnel}
            initialOrgMembers={initialOrgMembers}
          />
          <ParPanel
            incidentId={incident.id}
            initialParEvent={initialParEvent}
            initialResponses={initialParResponses}
            personnel={initialPersonnel}
          />
          <QrPanel
            incidentId={incident.id}
            initialTokens={initialQrTokens}
          />
        </div>
      </TabsContent>

      {/* Resources tab — always mounted for Realtime */}
      <TabsContent value="resources" forceMount className={activeTab !== 'resources' ? 'hidden' : ''}>
        <ResourceBoard
          incidentId={incident.id}
          initialDeployedResources={initialDeployedResources}
          initialAvailableResources={initialAvailableResources}
        />
      </TabsContent>

      {/* Map tab — placeholder */}
      {mountedTabs.has('map') && (
        <TabsContent value="map">
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium">Search Map</p>
            <p className="mt-1 text-sm">Map features coming in Feature 4</p>
          </div>
        </TabsContent>
      )}

      {/* Forms tab — placeholder */}
      {mountedTabs.has('forms') && (
        <TabsContent value="forms">
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium">ICS Forms</p>
            <p className="mt-1 text-sm">ICS form auto-fill coming in Feature 5</p>
          </div>
        </TabsContent>
      )}

      {/* Log tab — lazy mounted */}
      {mountedTabs.has('log') && (
        <TabsContent value="log">
          <IncidentLog
            incidentId={incident.id}
            incidentTimezone={incident.timezone}
          />
        </TabsContent>
      )}
    </Tabs>
  )
}
