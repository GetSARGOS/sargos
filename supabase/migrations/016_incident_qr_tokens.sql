-- 016_incident_qr_tokens.sql
-- QR tokens for spontaneous volunteer check-in at active incidents.
-- One active token per incident is the typical pattern; the IC can regenerate
-- (which deactivates the previous token) at any time.
-- Tokens are never deleted — they are deactivated to preserve the audit trail.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE incident_qr_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  scans           INTEGER NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES organization_members(id),
  expires_at      TIMESTAMPTZ,                        -- null = active until incident closes
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_incident_qr_tokens
  BEFORE UPDATE ON incident_qr_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_qr_tokens_token ON incident_qr_tokens(token);
CREATE INDEX idx_qr_tokens_incident_id ON incident_qr_tokens(incident_id);
CREATE INDEX idx_qr_tokens_organization_id ON incident_qr_tokens(organization_id);

ALTER TABLE incident_qr_tokens ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- Org members can view tokens for their incidents
CREATE POLICY "Org members can view QR tokens"
  ON incident_qr_tokens FOR SELECT
  USING (organization_id IN (SELECT get_my_organization_ids()));

-- Org members can create tokens for their incidents.
-- IC-only enforcement happens at the API layer; RLS provides belt-and-suspenders.
CREATE POLICY "Org members can create QR tokens"
  ON incident_qr_tokens FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

-- Org members can deactivate or update expiry on their tokens
CREATE POLICY "Org members can update QR tokens"
  ON incident_qr_tokens FOR UPDATE
  USING (organization_id IN (SELECT get_my_organization_ids()))
  WITH CHECK (organization_id IN (SELECT get_my_organization_ids()));

-- No DELETE policy — tokens are deactivated, not deleted.

-- ─── Public Token Lookup RPC ──────────────────────────────────────────────────
-- SECURITY DEFINER lets unauthenticated callers resolve a token.
-- Returns zero rows if the token string is unknown or the incident is closed/deleted.
-- Intentionally returns only the minimum fields required to render the check-in form.

CREATE OR REPLACE FUNCTION lookup_qr_token(p_token TEXT)
RETURNS TABLE (
  incident_id       UUID,
  is_active         BOOLEAN,
  incident_name     TEXT,
  organization_name TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.incident_id,
    q.is_active,
    i.name,
    o.name
  FROM incident_qr_tokens q
  JOIN incidents i ON i.id = q.incident_id
  JOIN organizations o ON o.id = i.organization_id
  WHERE q.token = p_token
    AND i.status != 'closed'
    AND i.deleted_at IS NULL;
END;
$$;

-- Allow the anon role to call the public token lookup
GRANT EXECUTE ON FUNCTION lookup_qr_token(TEXT) TO anon;

-- ─── Scan Counter RPC ─────────────────────────────────────────────────────────
-- Atomic increment using PostgreSQL expression-based UPDATE.
-- Called server-side only via the service role; no public grant needed.

CREATE OR REPLACE FUNCTION increment_qr_scans(p_token TEXT)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE incident_qr_tokens SET scans = scans + 1 WHERE token = p_token;
END;
$$;
