// ---------------------------------------------------------------------------
// Tier Limits — Feature 8a Billing Enforcement
// ---------------------------------------------------------------------------
// Defines what each subscription tier gets. This is the single source of truth
// for limit checks. The API enforcement layer (`checkTierAccess`) reads from here.
//
// See feature-list.md "Tier Matrix" for the full specification.
// ---------------------------------------------------------------------------

export const TIERS = ['free', 'team', 'enterprise'] as const;
export type Tier = (typeof TIERS)[number];

// Actions that can be checked against the tier matrix.
export const TIER_ACTIONS = [
  'create_incident',
  'add_member',
  'export_ics_form',
  'view_audit_log',
  'use_notifications',
  'use_branding',
  'use_api',
] as const;
export type TierAction = (typeof TIER_ACTIONS)[number];

/** Feature flags per tier — true means the feature is available. */
export interface TierFeatures {
  export_ics_form: boolean;
  view_audit_log: boolean;
  use_notifications: boolean;
  use_branding: boolean;
  use_api: boolean;
}

export interface TierLimits {
  /**
   * Maximum active org members. null = unlimited.
   * For 'team' tier, the actual limit is the org's `seat_cap` column — this
   * value is ignored and the org-level cap is used instead.
   */
  maxMembers: number | null;
  /**
   * Maximum concurrent active + planning incidents. null = unlimited.
   */
  maxActiveIncidents: number | null;
  /** Feature gate flags. */
  features: TierFeatures;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxMembers: 5,
    maxActiveIncidents: 1,
    features: {
      export_ics_form: false,
      view_audit_log: false,
      use_notifications: false,
      use_branding: false,
      use_api: false,
    },
  },
  team: {
    maxMembers: null, // uses org.seat_cap
    maxActiveIncidents: null,
    features: {
      export_ics_form: true,
      view_audit_log: true,
      use_notifications: true,
      use_branding: true,
      use_api: false,
    },
  },
  enterprise: {
    maxMembers: null,
    maxActiveIncidents: null,
    features: {
      export_ics_form: true,
      view_audit_log: true,
      use_notifications: true,
      use_branding: true,
      use_api: true,
    },
  },
};

/** Subscription statuses that allow normal access. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;
