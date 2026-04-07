// ---------------------------------------------------------------------------
// checkTierAccess — Core tier enforcement utility (Feature 8a)
// ---------------------------------------------------------------------------
// Server-side function that checks whether an organization can perform a
// tier-gated action. This is the single enforcement point — all API routes
// call this (via enforceTierLimit) before executing gated operations.
//
// Uses the `subscriptions` table as the source of truth for tier.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import {
  TIER_LIMITS,
  ACTIVE_SUBSCRIPTION_STATUSES,
  type Tier,
  type TierAction,
} from '@/constants/tier-limits'

type ServiceClient = SupabaseClient<Database>

export interface TierCheckResult {
  allowed: boolean
  reason?: string
  limit?: number
  current?: number
  tier: Tier
}

/**
 * Check whether an organization can perform a tier-gated action.
 *
 * @param supabase  Service-role client (needs to count across RLS boundaries)
 * @param orgId     The organization ID to check
 * @param action    The action being attempted
 */
export async function checkTierAccess(
  supabase: ServiceClient,
  orgId: string,
  action: TierAction,
): Promise<TierCheckResult> {
  // 1. Fetch subscription + org seat_cap in parallel
  const [subResult, orgResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('seat_cap')
      .eq('id', orgId)
      .maybeSingle(),
  ])

  // Graceful fallback: missing subscription → treat as free
  const tier = (subResult.data?.tier ?? 'free') as Tier
  const status = subResult.data?.status ?? 'active'
  const seatCap = orgResult.data?.seat_cap ?? 5

  // 2. Check subscription status — lapsed subscriptions block all gated actions
  const isActive = (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
  if (!isActive) {
    return {
      allowed: false,
      reason: `Subscription is ${status}. Please update your billing.`,
      tier,
    }
  }

  const limits = TIER_LIMITS[tier]

  // 3. Action-specific checks
  switch (action) {
    case 'create_incident':
      return checkIncidentLimit(supabase, orgId, tier, limits)

    case 'add_member':
      return checkMemberLimit(supabase, orgId, tier, limits, seatCap)

    case 'export_ics_form':
    case 'view_audit_log':
    case 'use_notifications':
    case 'use_branding':
    case 'use_api':
      return checkFeatureGate(tier, action, limits)
  }
}

async function checkIncidentLimit(
  supabase: ServiceClient,
  orgId: string,
  tier: Tier,
  limits: typeof TIER_LIMITS[Tier],
): Promise<TierCheckResult> {
  if (limits.maxActiveIncidents === null) {
    return { allowed: true, tier }
  }

  const { count, error } = await supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('status', ['active', 'planning'])
    .is('deleted_at', null)

  if (error) {
    console.error('[checkTierAccess] incident count failed:', error.code)
    // Fail open — don't block operations if the count query fails
    return { allowed: true, tier }
  }

  const current = count ?? 0
  if (current >= limits.maxActiveIncidents) {
    return {
      allowed: false,
      reason: `Free tier allows ${limits.maxActiveIncidents} active incident. Upgrade to create more.`,
      limit: limits.maxActiveIncidents,
      current,
      tier,
    }
  }

  return { allowed: true, limit: limits.maxActiveIncidents, current, tier }
}

async function checkMemberLimit(
  supabase: ServiceClient,
  orgId: string,
  tier: Tier,
  limits: typeof TIER_LIMITS[Tier],
  seatCap: number,
): Promise<TierCheckResult> {
  // Enterprise: unlimited
  if (tier === 'enterprise') {
    return { allowed: true, tier }
  }

  // Team: use org's seat_cap. Free: use constant from TIER_LIMITS.
  const maxMembers = tier === 'team' ? seatCap : limits.maxMembers
  if (maxMembers === null) {
    return { allowed: true, tier }
  }

  const { count, error } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (error) {
    console.error('[checkTierAccess] member count failed:', error.code)
    return { allowed: true, tier }
  }

  const current = count ?? 0
  if (current >= maxMembers) {
    const tierLabel = tier === 'free' ? 'Free' : 'Team'
    return {
      allowed: false,
      reason: `${tierLabel} tier allows ${maxMembers} members. ${tier === 'free' ? 'Upgrade to add more.' : 'Increase your seat cap in settings.'}`,
      limit: maxMembers,
      current,
      tier,
    }
  }

  return { allowed: true, limit: maxMembers, current, tier }
}

function checkFeatureGate(
  tier: Tier,
  action: TierAction,
  limits: typeof TIER_LIMITS[Tier],
): TierCheckResult {
  const featureKey = action as keyof typeof limits.features
  const allowed = limits.features[featureKey] ?? false

  if (!allowed) {
    return {
      allowed: false,
      reason: `This feature requires a Team or Enterprise plan.`,
      tier,
    }
  }

  return { allowed: true, tier }
}
