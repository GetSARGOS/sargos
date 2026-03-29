-- Migration 006: audit_log table
--
-- Immutable compliance log for SOC 2 / HIPAA / FedRAMP path.
-- INSERT-only: UPDATE and DELETE are disabled via RLS.
-- actor_email is intentionally denormalized — users may be deleted but
-- the audit record must remain accurate for legal and compliance purposes.
--
-- Dependencies: organizations (migration 002), auth.users (Supabase built-in)

CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     TEXT, -- denormalized in case user is deleted
  action          TEXT NOT NULL, -- e.g. 'organization.created', 'member.role_changed'
  resource_type   TEXT NOT NULL, -- e.g. 'organization', 'organization_member'
  resource_id     UUID,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}', -- non-PII context only
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at — this table is append-only
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_organization_id ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Org Admins can read their own org's audit records
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT
  USING (
    organization_id IN (SELECT public.get_my_organization_ids())
    AND public.is_org_admin(organization_id)
  );

-- INSERT: via server-side only (service role bypasses RLS).
-- No client-side INSERT policy is defined — direct client inserts are blocked.

-- UPDATE: completely disabled
CREATE POLICY "audit_log_no_update" ON audit_log
  FOR UPDATE
  USING (false);

-- DELETE: completely disabled
CREATE POLICY "audit_log_no_delete" ON audit_log
  FOR DELETE
  USING (false);
