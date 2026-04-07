-- Migration 018: subscriptions
-- Mirrors Stripe subscription state for fast in-app tier enforcement.
-- Every organization has exactly one subscription row (1:1 via UNIQUE constraint).
-- At MVP, all orgs are Free tier with no Stripe integration.

CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id       TEXT,
  tier                  TEXT NOT NULL CHECK (tier IN ('free', 'team', 'enterprise')),
  status                TEXT NOT NULL CHECK (status IN (
                          'trialing', 'active', 'past_due', 'canceled', 'unpaid'
                        )),
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,
  trial_ends_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- Trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's subscription
CREATE POLICY "subscriptions_select_org_members"
  ON subscriptions FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- No user-facing INSERT/UPDATE — service role only (Stripe webhooks + org creation)
