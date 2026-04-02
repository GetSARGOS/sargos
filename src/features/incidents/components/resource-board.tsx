'use client'

import { useState, useTransition } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeployedResource {
  id: string  // incident_resources.id
  resource_id: string
  status: 'requested' | 'deployed' | 'returned' | 'out_of_service'
  checked_out_at: string
  checked_in_at: string | null
  notes: string | null
  resourceName: string
  resourceCategory: string
  resourceIdentifier: string | null
}

export interface AvailableResource {
  id: string
  name: string
  category: string
  identifier: string | null
  status: string
}

const CATEGORY_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  radio: 'Radio',
  rope_rigging: 'Rope & Rigging',
  medical: 'Medical',
  shelter: 'Shelter',
  navigation: 'Navigation',
  water_rescue: 'Water Rescue',
  air: 'Air',
  other: 'Other',
}

interface ResourceBoardProps {
  incidentId: string
  initialDeployedResources: DeployedResource[]
  initialAvailableResources: AvailableResource[]
}

// ─── Resource Board ───────────────────────────────────────────────────────────

export function ResourceBoard({ incidentId, initialDeployedResources, initialAvailableResources }: ResourceBoardProps) {
  const [deployed, setDeployed] = useState<DeployedResource[]>(initialDeployedResources)
  const [available, setAvailable] = useState<AvailableResource[]>(initialAvailableResources)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // ── Deploy a resource ──────────────────────────────────────────────────────
  function handleDeploy(resource: AvailableResource) {
    setError(null)

    // Optimistic: move from available to deployed
    const optimisticDeployed: DeployedResource = {
      id: `optimistic-${resource.id}`,
      resource_id: resource.id,
      status: 'deployed',
      checked_out_at: new Date().toISOString(),
      checked_in_at: null,
      notes: null,
      resourceName: resource.name,
      resourceCategory: resource.category,
      resourceIdentifier: resource.identifier,
    }
    setAvailable((prev) => prev.filter((r) => r.id !== resource.id))
    setDeployed((prev) => [...prev, optimisticDeployed])

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/resources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId: resource.id }),
        })
        const json = (await res.json()) as {
          data: { incidentResourceId: string } | null
          error: { message: string } | null
        }
        if (!res.ok) {
          // Rollback optimistic changes
          setDeployed((prev) => prev.filter((r) => r.id !== optimisticDeployed.id))
          setAvailable((prev) => [...prev, resource].sort((a, b) => a.name.localeCompare(b.name)))
          setError(json.error?.message ?? 'Failed to deploy resource')
          return
        }
        // Replace optimistic record with real ID from server
        if (json.data?.incidentResourceId) {
          setDeployed((prev) =>
            prev.map((r) =>
              r.id === optimisticDeployed.id ? { ...r, id: json.data!.incidentResourceId } : r,
            ),
          )
        }
      } catch {
        setDeployed((prev) => prev.filter((r) => r.id !== optimisticDeployed.id))
        setAvailable((prev) => [...prev, resource].sort((a, b) => a.name.localeCompare(b.name)))
        setError('Network error — please try again')
      }
    })
  }

  // ── Return a resource ──────────────────────────────────────────────────────
  function handleReturn(incidentResource: DeployedResource) {
    setError(null)

    // Optimistic: remove from deployed, restore to available
    setDeployed((prev) => prev.filter((r) => r.id !== incidentResource.id))
    const restored: AvailableResource = {
      id: incidentResource.resource_id,
      name: incidentResource.resourceName,
      category: incidentResource.resourceCategory,
      identifier: incidentResource.resourceIdentifier,
      status: 'available',
    }
    setAvailable((prev) => [...prev, restored].sort((a, b) => a.name.localeCompare(b.name)))

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/resources/${incidentResource.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        if (!res.ok) {
          // Rollback
          setAvailable((prev) => prev.filter((r) => r.id !== incidentResource.resource_id))
          setDeployed((prev) => [...prev, incidentResource])
          const json = (await res.json()) as { error: { message: string } | null }
          setError(json.error?.message ?? 'Failed to return resource')
        }
      } catch {
        setAvailable((prev) => prev.filter((r) => r.id !== incidentResource.resource_id))
        setDeployed((prev) => [...prev, incidentResource])
        setError('Network error — please try again')
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold">Equipment & Resources</h2>
        <p className="text-xs text-muted-foreground">{deployed.length} deployed</p>
      </div>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Deployed resources */}
      <div className="border-b border-border">
        <div className="px-4 py-2 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deployed</p>
        </div>
        {deployed.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No resources deployed to this incident.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Deployed At</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {deployed.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {r.resourceName}
                    {r.resourceIdentifier && (
                      <span className="ml-2 text-xs text-muted-foreground">#{r.resourceIdentifier}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {CATEGORY_LABELS[r.resourceCategory] ?? r.resourceCategory}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(r.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleReturn(r)}
                      disabled={isPending}
                      className="h-7 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 transition-colors"
                    >
                      Return
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Available resources to deploy */}
      <div>
        <div className="px-4 py-2 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available to Deploy</p>
        </div>
        {available.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No resources available. Add resources to your organization inventory first.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {available.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {r.name}
                    {r.identifier && (
                      <span className="ml-2 text-xs text-muted-foreground">#{r.identifier}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDeploy(r)}
                      disabled={isPending}
                      className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Deploy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
