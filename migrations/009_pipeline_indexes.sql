-- Migration 009: Pipeline indexes and materialized view for operational dashboard
-- Adds seller_id, stage, status, last_interaction to leads table
-- Creates composite indexes for seller-scoped pipeline queries
-- Creates materialized view for fast pipeline aggregations

-- 1. Add new columns to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ;

-- 2. Composite index for pipeline queries (seller + school + stage)
CREATE INDEX IF NOT EXISTS idx_leads_seller_school_stage
  ON leads(seller_id, school_id, stage);

-- 3. Index for school-scoped queries ordered by recency
CREATE INDEX IF NOT EXISTS idx_leads_school_created_desc
  ON leads(school_id, created_at DESC);

-- 4. Index for stage-based queries with last interaction ordering
CREATE INDEX IF NOT EXISTS idx_leads_stage_last_interaction
  ON leads(stage, last_interaction);

-- 5. Index on seller_id alone for seller-scoped lookups
CREATE INDEX IF NOT EXISTS idx_leads_seller_id
  ON leads(seller_id);

-- 6. Materialized view for pipeline aggregations
-- Provides pre-computed counts per school/seller/stage for fast dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS leads_pipeline_agg AS
SELECT
  school_id,
  seller_id,
  stage,
  COUNT(*)::INTEGER AS lead_count
FROM leads
WHERE status != 'deleted'
GROUP BY school_id, seller_id, stage;

-- 7. Unique index on the materialized view to enable REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_pipeline_agg_unique
  ON leads_pipeline_agg(school_id, seller_id, stage);

-- 8. Additional indexes on the materialized view for query performance
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_agg_school
  ON leads_pipeline_agg(school_id);

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_agg_seller
  ON leads_pipeline_agg(seller_id);
