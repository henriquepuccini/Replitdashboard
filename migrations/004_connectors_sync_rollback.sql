-- Rollback Migration 004: Connectors, Sync & Normalized Tables

BEGIN;

DROP TRIGGER IF EXISTS trg_enrollments_updated_at ON enrollments;
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS trg_connector_mappings_updated_at ON connector_mappings;
DROP TRIGGER IF EXISTS trg_connectors_updated_at ON connectors;

DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS sync_runs CASCADE;
DROP TABLE IF EXISTS raw_ingest_files CASCADE;
DROP TABLE IF EXISTS connector_mappings CASCADE;
DROP TABLE IF EXISTS connectors CASCADE;

COMMIT;
