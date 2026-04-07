-- Migration 020: Backfill subscriptions for existing organizations
-- Every org must have a subscription row. New orgs get one at creation time (Feature 8a).
-- This handles orgs created before Feature 8a was deployed.

INSERT INTO subscriptions (organization_id, tier, status)
SELECT id, 'free', 'active'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions WHERE subscriptions.organization_id = organizations.id
);
