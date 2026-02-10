-- Migration 004: Connectors, Sync & Normalized Tables
-- Creates tables for connector configs, field mappings, raw ingest files,
-- sync run logs, and normalized data tables (leads, payments, enrollments).

BEGIN;

-- ============================================================
-- 1. connectors
-- ============================================================
CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type VARCHAR(20) NOT NULL,
  config JSONB DEFAULT '{}',
  schedule_cron TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_connectors_type CHECK (type IN ('crm', 'finance', 'academic'))
);

CREATE INDEX IF NOT EXISTS idx_connectors_owner_id ON connectors(owner_id);
CREATE INDEX IF NOT EXISTS idx_connectors_type ON connectors(type);

-- ============================================================
-- 2. connector_mappings
-- ============================================================
CREATE TABLE IF NOT EXISTS connector_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  target_field TEXT NOT NULL,
  transform JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connector_mappings_connector_id ON connector_mappings(connector_id);

-- ============================================================
-- 3. raw_ingest_files
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_ingest_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  bucket_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_ingest_files_connector_id ON raw_ingest_files(connector_id);
CREATE INDEX IF NOT EXISTS idx_raw_ingest_files_processed ON raw_ingest_files(processed);

-- ============================================================
-- 4. sync_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  records_in INTEGER DEFAULT 0,
  records_out INTEGER DEFAULT 0,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sync_runs_status CHECK (status IN ('pending', 'running', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_connector_id_started_at ON sync_runs(connector_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

-- ============================================================
-- 5. leads (normalized)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_school_id ON leads(school_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_source_id ON leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_source_connector_id ON leads(source_connector_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_source ON leads(source_connector_id, source_id);

-- ============================================================
-- 6. payments (normalized)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_school_id ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_source_id ON payments(source_id);
CREATE INDEX IF NOT EXISTS idx_payments_source_connector_id ON payments(source_connector_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_source ON payments(source_connector_id, source_id);

-- ============================================================
-- 7. enrollments (normalized)
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_school_id ON enrollments(school_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_created_at ON enrollments(created_at);
CREATE INDEX IF NOT EXISTS idx_enrollments_source_id ON enrollments(source_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_source_connector_id ON enrollments(source_connector_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_source ON enrollments(source_connector_id, source_id);

-- ============================================================
-- 8. updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_connectors_updated_at
  BEFORE UPDATE ON connectors
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_connector_mappings_updated_at
  BEFORE UPDATE ON connector_mappings
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
