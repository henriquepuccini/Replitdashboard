-- Migration: 013_exec_aggregates
-- Description: Create network_aggregates and school_comparison tables for the exec dashboard.
--              These are read-optimized tables populated by a scheduled edge function (service_role).
-- Date: 2026-02-25
-- Depends on: 001_auth_tables (schools, update_updated_at_column)

-- ============================================================================
-- 1. Create network_aggregates table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.network_aggregates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE        NOT NULL,
  metrics     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_network_aggregates_date UNIQUE (date)
);

COMMENT ON TABLE public.network_aggregates IS
  'Pre-computed network-wide KPI totals/averages for exec dashboards. '
  'Populated exclusively by edge functions via service_role.';

COMMENT ON COLUMN public.network_aggregates.metrics IS
  'JSONB bag of network-level KPI aggregates, e.g. {"revenue": 5200000, "conversion_rate": 0.30}.';

-- Primary access pattern: get last X months of network averages
CREATE INDEX IF NOT EXISTS idx_network_aggregates_date ON public.network_aggregates(date DESC);

-- Trigger for updated_at
CREATE TRIGGER trg_network_aggregates_updated_at
  BEFORE UPDATE ON public.network_aggregates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. Create school_comparison table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_comparison (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE           NOT NULL,
  metric_key          VARCHAR(100)   NOT NULL,
  school_id           UUID           NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  metric_value        NUMERIC(18, 4) NOT NULL,
  rank                INTEGER        NOT NULL,
  variance_to_network NUMERIC(18, 4),
  computed_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT uq_school_comp_date_metric_school UNIQUE (date, metric_key, school_id)
);

COMMENT ON TABLE public.school_comparison IS
  'Normalized cross-school rankings and variances per metric for exec leaderboards. '
  'Populated exclusively by edge functions via service_role.';

COMMENT ON COLUMN public.school_comparison.variance_to_network IS
  'Difference (absolute or percentage) compared to the network average for this metric.';

-- Primary access pattern: leaderboard for a specific metric and date
CREATE INDEX IF NOT EXISTS idx_school_comparison_date_metric 
  ON public.school_comparison(date DESC, metric_key);

-- Secondary access pattern: all rankings for a specific school (e.g. director view)
CREATE INDEX IF NOT EXISTS idx_school_comparison_school
  ON public.school_comparison(school_id, date DESC);

-- Trigger for updated_at
CREATE TRIGGER trg_school_comparison_updated_at
  BEFORE UPDATE ON public.school_comparison
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
