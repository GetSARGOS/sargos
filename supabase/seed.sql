-- ===========================================================================
-- SAR SaaS — Development Seed Data (Application Tables)
-- ===========================================================================
-- SEEDING IS A 2-STEP PROCESS:
--
--   Step 1 — Create auth users (run ONCE from your terminal):
--     npx tsx scripts/seed-auth-users.ts
--
--   Step 2 — Create app data (paste into Supabase SQL Editor):
--     1. Go to your Supabase Dashboard → SQL Editor
--     2. Paste this ENTIRE file
--     3. Click "Run" (Ctrl+Enter / Cmd+Enter)
--     4. "Success. No rows returned" means it worked.
--
-- WHY TWO STEPS?
--   Direct INSERT into auth.users doesn't work on hosted Supabase — GoTrue
--   (the auth service) has internal state that raw SQL can't replicate.
--   The script in Step 1 uses the Admin API to create users properly.
--
-- SAFE TO RE-RUN: Both steps delete existing seed data first.
--
-- WARNING: Only run this on your DEVELOPMENT project. Never on production.
-- Contains obviously fake data — no real PII.
--
-- Test User Credentials (dev only — never use in production)
--   admin@alphasar.test     / TestPassword1!
--   ic@alphasar.test        / TestPassword1!
--   ops@alphasar.test       / TestPassword1!
--   field@alphasar.test     / TestPassword1!
--   observer@alphasar.test  / TestPassword1!
--   admin@betasar.test      / TestPassword1!
--
-- Fixed UUIDs (used in Playwright tests):
--   Alpha SAR Org:    11111111-1111-4111-8111-111111111111
--   Beta SAR Org:     22222222-2222-4222-8222-222222222222
--   Admin user:       aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
--   IC user:          bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
--   Ops user:         cccccccc-cccc-4ccc-8ccc-cccccccccccc
--   Field user:       dddddddd-dddd-4ddd-8ddd-dddddddddddd
--   Observer user:    eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
--   Beta Admin user:  ffffffff-ffff-4fff-8fff-ffffffffffff
--   Alpha Incident:   11110000-0000-4000-8000-000000000001
--   Alpha Resource:   11110000-0000-4000-8000-000000000002
-- ===========================================================================

-- Everything runs in a single transaction: if any statement fails,
-- nothing changes. This protects your database from partial inserts.
BEGIN;

-- ===========================================================================
-- CLEANUP: Delete any existing seed data so this is safe to re-run.
-- Order matters — delete children before parents (foreign key constraints).
-- ===========================================================================

-- Helper: collect all org member IDs we need to clean up references for.
-- This temp table avoids repeating the same subquery everywhere.
CREATE TEMP TABLE _seed_member_ids AS
  SELECT om.id FROM organization_members om
  WHERE om.organization_id IN (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )
  UNION
  SELECT om.id FROM organization_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE u.email IN (
    'admin@alphasar.test', 'ic@alphasar.test', 'ops@alphasar.test',
    'field@alphasar.test', 'observer@alphasar.test', 'admin@betasar.test'
  );

-- 1. Delete PAR responses then PAR events (RESTRICT on initiated_by)
DELETE FROM incident_par_responses WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM incident_par_events WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM incident_par_events WHERE initiated_by IN (SELECT id FROM _seed_member_ids);

-- 2. Delete QR tokens (RESTRICT on created_by)
DELETE FROM incident_qr_tokens WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM incident_qr_tokens WHERE created_by IN (SELECT id FROM _seed_member_ids);

-- 3. Delete invites (RESTRICT on invited_by)
DELETE FROM organization_invites WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM organization_invites WHERE invited_by IN (SELECT id FROM _seed_member_ids);

-- 4. Delete incident resources (SET NULL on checked_out_by/checked_in_by — safe, but clean)
DELETE FROM incident_resources WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 5. Delete resources
DELETE FROM resources WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM resources WHERE id = '11110000-0000-4000-8000-000000000002';

-- 6. Delete incident command structure (SET NULL — safe, but clean)
DELETE FROM incident_command_structure WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 7. Delete audit log entries
DELETE FROM audit_log WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 8. Delete incident log entries
DELETE FROM incident_log WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 9. Delete incident personnel — must come before org member deletion
--    (SET NULL on member_id would violate identity check constraint)
DELETE FROM incident_personnel WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM incident_personnel WHERE member_id IN (SELECT id FROM _seed_member_ids);

-- 10. Delete incidents
DELETE FROM incidents WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 11. Delete team members (CASCADE — but explicit is clearer)
DELETE FROM team_members WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 12. Delete teams
DELETE FROM teams WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 13. Now safe to delete organization members
DELETE FROM organization_members WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM organization_members WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'admin@alphasar.test', 'ic@alphasar.test', 'ops@alphasar.test',
    'field@alphasar.test', 'observer@alphasar.test', 'admin@betasar.test'
  )
);

-- 14. Delete subscriptions
DELETE FROM subscriptions WHERE organization_id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- 15. Delete organizations
DELETE FROM organizations WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
DELETE FROM organizations WHERE slug IN ('alpha-sar', 'beta-sar');

-- Done with temp table
DROP TABLE _seed_member_ids;

-- NOTE: Auth users (auth.users, auth.identities) are NOT managed in this file.
-- They are created by: npx tsx scripts/seed-auth-users.ts
-- See the header comment for the full 2-step workflow.

-- ===========================================================================
-- 1. ORGANIZATIONS (2 test orgs)
-- ===========================================================================

INSERT INTO organizations (id, name, slug, unit_type, region, state, contact_email, contact_phone)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Alpha SAR Team', 'alpha-sar', 'sar',
   'Pacific Northwest', 'WA', 'dispatch@alphasar.test', '555-0100'),
  ('22222222-2222-4222-8222-222222222222', 'Beta SAR Team', 'beta-sar', 'sar',
   'Mountain West', 'CO', 'dispatch@betasar.test', '555-0200');

-- ===========================================================================
-- 1b. SUBSCRIPTIONS (Free tier for both orgs — Feature 8a)
-- ===========================================================================

INSERT INTO subscriptions (organization_id, tier, status)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'free', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'free', 'active');

-- ===========================================================================
-- 2. ORGANIZATION MEMBERS (5 in Alpha, 1 in Beta)
-- ===========================================================================

INSERT INTO organization_members (
  id, organization_id, user_id, role, display_name, phone, certifications, availability
) VALUES
  -- Alpha SAR: 5 members with different roles
  ('aa000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'org_admin', 'Alice Admin',
   '555-0101', '{"SARTECH_II","WFA"}', 'available'),
  ('aa000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member', 'Bob Commander',
   '555-0102', '{"SARTECH_I","EMT"}', 'available'),
  ('aa000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'member', 'Carol Ops',
   '555-0103', '{"SARTECH_II"}', 'available'),
  ('aa000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'member', 'Dave Field',
   '555-0104', '{}', 'available'),
  ('aa000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'member', 'Eve Observer',
   '555-0105', '{}', 'on_call'),
  -- Beta SAR: 1 admin (for cross-org isolation testing)
  ('bb000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'ffffffff-ffff-4fff-8fff-ffffffffffff', 'org_admin', 'Frank Beta',
   '555-0201', '{"SARTECH_III"}', 'available');

-- ===========================================================================
-- 3. INCIDENT (1 active incident for Alpha SAR)
-- ===========================================================================

INSERT INTO incidents (
  id, organization_id, name, incident_number, incident_type, status,
  location_address, started_at
) VALUES (
  '11110000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Lost Hiker — Mt. Rainier Trail',
  'ALPHA-2026-001',
  'lost_person',
  'active',
  'Mt. Rainier National Park, Sunrise Trailhead, WA',
  now() - INTERVAL '4 hours'
);

-- ===========================================================================
-- 3a. OPERATIONAL PERIOD (Period 1 for the seeded incident)
-- ===========================================================================

INSERT INTO operational_periods (
  id, incident_id, organization_id, period_number, starts_at, created_by
) VALUES (
  '11110000-0000-4000-8000-0000000000a1',
  '11110000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  1,
  now() - INTERVAL '4 hours',
  'aa000000-0000-4000-8000-000000000001'
);

-- ===========================================================================
-- 4. INCIDENT PERSONNEL (2 people checked in)
-- ===========================================================================

INSERT INTO incident_personnel (
  id, incident_id, organization_id, member_id,
  personnel_type, checkin_method, status, incident_role
) VALUES
  -- Alice Admin acting as Incident Commander
  (
    'ab000000-0000-4000-8000-000000000001',
    '11110000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aa000000-0000-4000-8000-000000000001',
    'member', 'manual', 'available', 'incident_commander'
  ),
  -- Dave Field as field member, currently in the field
  (
    'ab000000-0000-4000-8000-000000000002',
    '11110000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aa000000-0000-4000-8000-000000000004',
    'member', 'manual', 'in_field', 'field_member'
  );

-- ===========================================================================
-- 5. INCIDENT LOG (1 entry recording incident creation)
-- ===========================================================================

INSERT INTO incident_log (
  incident_id, organization_id, entry_type, message,
  actor_id, actor_name, metadata
) VALUES (
  '11110000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'incident_status_change',
  'Incident created: Lost Hiker — Mt. Rainier Trail',
  'aa000000-0000-4000-8000-000000000001',
  'Alice Admin',
  '{"from_status": null, "to_status": "active"}'
);

-- ===========================================================================
-- 6. AUDIT LOG (1 entry for compliance trail)
-- ===========================================================================

INSERT INTO audit_log (
  organization_id, actor_id, actor_email, action,
  resource_type, resource_id, metadata
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'admin@alphasar.test',
  'incident.created',
  'incident',
  '11110000-0000-4000-8000-000000000001',
  '{"incident_name": "Lost Hiker — Mt. Rainier Trail", "incident_type": "lost_person"}'
);

-- ===========================================================================
-- 7. RESOURCE (1 vehicle for Alpha SAR)
-- ===========================================================================

INSERT INTO resources (
  id, organization_id, name, category, identifier, status, notes
) VALUES (
  '11110000-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'Command Vehicle 1',
  'vehicle',
  'ALPHA-CV-01',
  'available',
  'Ford F-350 with command post equipment'
);

-- ===========================================================================
-- DONE! If you see "Success. No rows returned" — everything worked.
-- Log in with admin@alphasar.test / TestPassword1!
-- (Auth users must already exist from Step 1: npx tsx scripts/seed-auth-users.ts)
-- ===========================================================================

COMMIT;
