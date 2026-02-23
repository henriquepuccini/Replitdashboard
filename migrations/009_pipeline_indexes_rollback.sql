-- Rollback migration 009: Pipeline indexes and materialized view

-- Drop materialized view and its indexes
DROP INDEX IF EXISTS idx_leads_pipeline_agg_seller;
DROP INDEX IF EXISTS idx_leads_pipeline_agg_school;
DROP INDEX IF EXISTS idx_leads_pipeline_agg_unique;
DROP MATERIALIZED VIEW IF EXISTS leads_pipeline_agg;

-- Drop composite indexes
DROP INDEX IF EXISTS idx_leads_seller_id;
DROP INDEX IF EXISTS idx_leads_stage_last_interaction;
DROP INDEX IF EXISTS idx_leads_school_created_desc;
DROP INDEX IF EXISTS idx_leads_seller_school_stage;

-- Remove added columns
ALTER TABLE leads
  DROP COLUMN IF EXISTS last_interaction,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS stage,
  DROP COLUMN IF EXISTS seller_id;
