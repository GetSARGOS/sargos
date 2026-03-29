-- RLS Cross-Organization Verification Script
-- Run the ENTIRE file as one block in Supabase SQL Editor.
-- Results appear in the Results panel.
-- Expected: all rows show result = 'PASS'.
--
-- HOW IT WORKS:
-- SET LOCAL ROLE authenticated — makes RLS actually apply (postgres superuser bypasses it)
-- SET LOCAL request.jwt.claims — makes auth.uid() return the test user's ID
-- Both settings are LOCAL to the transaction so they revert after COMMIT.
-- Test data is inserted before role change, deleted after reset.

BEGIN;

-- ============================================================
-- SETUP (as postgres superuser — RLS bypassed for data seeding)
-- ============================================================

-- Clean up any leftover state from a previous failed run
DELETE FROM organization_members
  WHERE user_id IN (
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000002'::uuid
  );
DELETE FROM organizations
  WHERE slug IN ('rls-test-org-a', 'rls-test-org-b');
DELETE FROM auth.users
  WHERE id IN (
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000002'::uuid
  );

-- Test users
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  aud, role, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'rls-test-a@example.invalid', '',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'rls-test-b@example.invalid', '',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  );

-- Test orgs
INSERT INTO organizations (name, slug, unit_type)
VALUES
  ('RLS Test Org A', 'rls-test-org-a', 'sar'),
  ('RLS Test Org B', 'rls-test-org-b', 'fire');

-- Test members
INSERT INTO organization_members (organization_id, user_id, role, display_name)
SELECT id, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'org_admin', 'Test User A'
FROM organizations WHERE slug = 'rls-test-org-a';

INSERT INTO organization_members (organization_id, user_id, role, display_name)
SELECT id, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'org_admin', 'Test User B'
FROM organizations WHERE slug = 'rls-test-org-b';

-- Temp table to collect results
CREATE TEMP TABLE _rls_results (
  num     int,
  test    text,
  expect  int,
  actual  int,
  result  text
) ON COMMIT DROP;

-- Grant write access before switching to the authenticated role
GRANT ALL ON _rls_results TO authenticated;

-- ============================================================
-- TESTS AS USER A
-- RLS is now enforced; auth.uid() returns User A's UUID
-- ============================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

INSERT INTO _rls_results
SELECT 1, 'User A cannot see Org B (organizations)', 0,
  COUNT(*)::int,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE '*** FAIL ***' END
FROM organizations WHERE slug = 'rls-test-org-b';

INSERT INTO _rls_results
SELECT 2, 'User A cannot see Org B members', 0,
  COUNT(*)::int,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE '*** FAIL ***' END
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE o.slug = 'rls-test-org-b';

INSERT INTO _rls_results
SELECT 3, 'User A CAN see their own org (sanity)', 1,
  COUNT(*)::int,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE '*** FAIL ***' END
FROM organizations WHERE slug = 'rls-test-org-a';

INSERT INTO _rls_results
SELECT 4, 'User A CAN see their own members (sanity)', 1,
  COUNT(*)::int,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE '*** FAIL ***' END
FROM organization_members
WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

-- ============================================================
-- TESTS AS USER B
-- ============================================================
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

INSERT INTO _rls_results
SELECT 5, 'User B cannot see Org A (organizations)', 0,
  COUNT(*)::int,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE '*** FAIL ***' END
FROM organizations WHERE slug = 'rls-test-org-a';

INSERT INTO _rls_results
SELECT 6, 'User B cannot see Org A members', 0,
  COUNT(*)::int,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE '*** FAIL ***' END
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE o.slug = 'rls-test-org-a';

-- ============================================================
-- Return to superuser for cleanup, then show results
-- ============================================================
RESET ROLE;

DELETE FROM organization_members
  WHERE user_id IN (
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000002'::uuid
  );
DELETE FROM organizations
  WHERE slug IN ('rls-test-org-a', 'rls-test-org-b');
DELETE FROM auth.users
  WHERE id IN (
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000002'::uuid
  );

-- Display results
SELECT num, test, expect AS expected, actual, result
FROM _rls_results
ORDER BY num;

COMMIT;
