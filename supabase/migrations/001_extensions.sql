-- Migration 001: Extensions and shared utilities
-- Run this first before any table migrations.

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- full-text search on names and logs

-- Shared trigger function: keeps updated_at current on every mutable table.
-- Applied to individual tables in subsequent migrations.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
