// ---------------------------------------------------------------------------
// enforceTierLimit — API route helper for tier enforcement (Feature 8a)
// ---------------------------------------------------------------------------
// Thin wrapper around checkTierAccess that returns a 403 Response when the
// action is not allowed, or null when it is. Use in API route handlers:
//
//   const denied = await enforceTierLimit(supabase, orgId, 'create_incident')
//   if (denied) return denied
//
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { checkTierAccess, type TierCheckResult } from '@/lib/billing/check-tier-access'
import {
  errorResponse,
  TIER_SEAT_LIMIT,
  TIER_INCIDENT_LIMIT,
  TIER_FEATURE_GATED,
  SUBSCRIPTION_LAPSED,
  type ErrorCode,
} from '@/constants/error-codes'
import type { TierAction } from '@/constants/tier-limits'

type ServiceClient = SupabaseClient<Database>

const ACTION_ERROR_CODES: Record<string, ErrorCode> = {
  create_incident: TIER_INCIDENT_LIMIT,
  add_member: TIER_SEAT_LIMIT,
  export_ics_form: TIER_FEATURE_GATED,
  view_audit_log: TIER_FEATURE_GATED,
  use_notifications: TIER_FEATURE_GATED,
  use_branding: TIER_FEATURE_GATED,
  use_api: TIER_FEATURE_GATED,
}

/**
 * Enforce a tier limit for an API route. Returns null if allowed,
 * or a 403 Response if denied.
 */
export async function enforceTierLimit(
  supabase: ServiceClient,
  orgId: string,
  action: TierAction,
): Promise<Response | null> {
  const result: TierCheckResult = await checkTierAccess(supabase, orgId, action)

  if (result.allowed) {
    return null
  }

  // Determine the appropriate error code
  const isLapsed = result.reason?.includes('Subscription is')
  const errorCode = isLapsed
    ? SUBSCRIPTION_LAPSED
    : ACTION_ERROR_CODES[action] ?? TIER_FEATURE_GATED

  return errorResponse(errorCode, result.reason ?? 'Tier limit reached', {
    tier: result.tier,
    ...(result.limit !== undefined ? { limit: result.limit } : {}),
    ...(result.current !== undefined ? { current: result.current } : {}),
  })
}
