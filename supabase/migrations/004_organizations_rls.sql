-- Migration 004: organizations table — deferred RLS policies
-- These policies reference organization_members (created in migration 003)
-- and must be added after that table exists.

-- SELECT: org members can read their own organization record
CREATE POLICY "organizations_select" ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- UPDATE: only org admins can update the organization record
CREATE POLICY "organizations_update" ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role = 'org_admin'
        AND is_active = true
        AND deleted_at IS NULL
    )
  );
