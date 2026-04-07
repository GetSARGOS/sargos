'use client'

// ---------------------------------------------------------------------------
// SubscriptionContext — Client-side tier awareness (Feature 8a)
// ---------------------------------------------------------------------------
// Provides tier info and a cosmetic `canDo()` helper to client components.
// This is for UI gating ONLY (hiding/disabling buttons, showing upgrade badges).
// The real enforcement happens server-side in API routes via enforceTierLimit.
// ---------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TIER_LIMITS,
  ACTIVE_SUBSCRIPTION_STATUSES,
  type Tier,
  type TierAction,
} from '@/constants/tier-limits'

interface SubscriptionState {
  tier: Tier
  status: string
  seatCap: number
  loading: boolean
}

interface SubscriptionContextValue extends SubscriptionState {
  /** Cosmetic check — returns true if the action is allowed by the tier. */
  canDo: (action: TierAction) => boolean
}

const defaultState: SubscriptionState = {
  tier: 'free',
  status: 'active',
  seatCap: 5,
  loading: true,
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  ...defaultState,
  canDo: () => false,
})

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(defaultState)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setState((prev) => ({ ...prev, loading: false }))
        return
      }

      // Fetch org membership to get organization_id
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!member || cancelled) {
        setState((prev) => ({ ...prev, loading: false }))
        return
      }

      // Fetch subscription + org seat_cap in parallel
      const [subResult, orgResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('tier, status')
          .eq('organization_id', member.organization_id)
          .maybeSingle(),
        supabase
          .from('organizations')
          .select('seat_cap')
          .eq('id', member.organization_id)
          .maybeSingle(),
      ])

      if (cancelled) return

      setState({
        tier: (subResult.data?.tier ?? 'free') as Tier,
        status: subResult.data?.status ?? 'active',
        seatCap: orgResult.data?.seat_cap ?? 5,
        loading: false,
      })
    }

    load()
    return () => { cancelled = true }
  }, [])

  const canDo = (action: TierAction): boolean => {
    if (state.loading) return false

    const isActive = (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(state.status)
    if (!isActive) return false

    const limits = TIER_LIMITS[state.tier]

    switch (action) {
      case 'create_incident':
        // Can't know the count client-side without an extra query — allow optimistically.
        // The API will enforce the real limit.
        return limits.maxActiveIncidents === null || true
      case 'add_member':
        return limits.maxMembers === null || state.tier !== 'free' || true
      case 'export_ics_form':
      case 'view_audit_log':
      case 'use_notifications':
      case 'use_branding':
      case 'use_api': {
        const featureKey = action as keyof typeof limits.features
        return limits.features[featureKey] ?? false
      }
    }
  }

  return (
    <SubscriptionContext.Provider value={{ ...state, canDo }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext)
}
