-- Migration: 011_school_aggregates
-- Description: Create school_aggregates table for fast admin dashboard queries.
--              Pre-computed school-level KPI aggregates are written exclusively by
--              the KPI calc edge function (service_role) to avoid runtime aggregation costs.
-- Date: 2026-02-25
-- Depends on: 001_auth_tables (schools table, update_updated_at_column function)
--             006_kpi_tables (kpi_values, kpi_calc_runs)

-- ============================================================================
-- 1. Create school_aggregates table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_aggregates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  metrics     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_aggregates IS
  'Pre-computed school-level KPI aggregates for admin dashboards. '
  'Populated exclusively by the KPI calc edge function via service_role. '
  'Never write to this table from user-facing application code.';

COMMENT ON COLUMN public.school_aggregates.metrics IS
  'JSONB bag of KPI aggregate values keyed by kpi_definition.key, '
  'e.g. {"enrollments": 42, "churn_rate": 0.12}. '
  'Schema is intentionally flexible to accommodate new KPIs without migrations.';

COMMENT ON COLUMN public.school_aggregates.computed_at IS
  'Timestamp when the KPI calc edge function wrote this aggregate row. '
  'Distinct from created_at to support idempotent upserts.';

-- ============================================================================
-- 2. Unique constraint: one aggregate row per (school, date)
--    Supports ON CONFLICT(school_id, date) DO UPDATE upserts from edge function
-- ============================================================================

ALTER TABLE public.school_aggregates
  ADD CONSTRAINT uq_school_aggregates_school_date UNIQUE (school_id, date);

-- ============================================================================
-- 3. Indexes
-- ============================================================================

-- Primary access pattern: admin dashboard queries for a school over a date range
-- Covers: WHERE school_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_school_aggregates_school_date
  ON public.school_aggregates(school_id, date DESC);

-- Secondary access pattern: latest aggregate for each school (ORDER BY date DESC LIMIT 1)
-- The composite index above covers this; this partial index speeds up
-- "most recent" lookups without a full range scan when date is unbounded
CREATE INDEX IF NOT EXISTS idx_school_aggregates_school_computed_at
  ON public.school_aggregates(school_id, computed_at DESC);

-- ============================================================================
-- 4. updated_at auto-trigger
--    Reuses update_updated_at_column() created in migration 001_auth_tables
-- ============================================================================

CREATE TRIGGER trg_school_aggregates_updated_at
  BEFORE UPDATE ON public.school_aggregates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Design notes
-- ============================================================================
-- kpi_values.school_id and kpi_goals.school_id remain NULLABLE:
--   - NULL school_id = network-level (cross-school) KPI value or goal
--   - NOT NULL school_id = unit-level (per-school) KPI value or goal
-- The KPI calc edge function is responsible for enforcing NOT NULL on
-- school_id when writing unit-level rows to kpi_values/kpi_goals.
-- school_aggregates.school_id is always NOT NULL because this table
-- only stores school-scoped pre-computed dashbboard summaries.
