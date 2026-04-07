-- Migration 019: Align org tier enum with subscriptions table + add seat_cap
-- The original migration 002 used tier values (volunteer, professional) that don't
-- match the feature spec (free, team, enterprise). This aligns them.

-- Step 1: Migrate data to canonical tier names
UPDATE organizations SET subscription_tier = 'team' WHERE subscription_tier IN ('volunteer', 'professional');

-- Step 2: Replace the CHECK constraint with correct values
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'team', 'enterprise'));

-- Step 3: Add seat_cap column (admin-configurable spending cap for Team tier)
-- Free tier: always 5 (enforced in application, not here). Team: seat_cap. Enterprise: unlimited.
ALTER TABLE organizations ADD COLUMN seat_cap INTEGER NOT NULL DEFAULT 5;
