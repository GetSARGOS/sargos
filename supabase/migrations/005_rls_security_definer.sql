-- Migration 005: Fix RLS infinite recursion via SECURITY DEFINER functions
--
-- PROBLEM: Policies on organization_members that subquery organization_members
-- (e.g. "get all orgs this user belongs to, then check if this row is in one
-- of those orgs") cause infinite recursion — the subquery triggers the same
-- policy, which triggers the same subquery, forever.
--
-- The same recursion happens on organizations policies because they also
-- subquery organization_members, which has its own recursive policy.
--
-- SOLUTION: Wrap the membership subquery in a SECURITY DEFINER function.
-- SECURITY DEFINER executes as the function owner (postgres superuser),
-- which bypasses RLS entirely. The subquery inside the function reads the
-- table directly without triggering policies, breaking the recursive loop.
--
-- SET search_path = public prevents search-path injection attacks.

-- ============================================================
-- Helper function: returns all org IDs the current user belongs to
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
    AND is_active = true
    AND deleted_at IS NULL
$$;

-- ============================================================
-- Helper function: returns true if current user is org_admin for a given org
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'org_admin'
      AND is_active = true
      AND deleted_at IS NULL
  )
$$;

-- ============================================================
-- Recreate organizations policies using the helper functions
-- ============================================================
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;

CREATE POLICY "organizations_select" ON organizations
  FOR SELECT
  USING (id IN (SELECT public.get_my_organization_ids()));

CREATE POLICY "organizations_update" ON organizations
  FOR UPDATE
  USING (public.is_org_admin(id));

-- ============================================================
-- Recreate organization_members policies using the helper functions
-- ============================================================
DROP POLICY IF EXISTS "org_members_select" ON organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
DROP POLICY IF EXISTS "org_members_update" ON organization_members;

CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT
  USING (organization_id IN (SELECT public.get_my_organization_ids()));

CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR user_id = auth.uid()
  );

CREATE POLICY "org_members_update" ON organization_members
  FOR UPDATE
  USING (
    public.is_org_admin(organization_id)
    OR user_id = auth.uid()
  );
