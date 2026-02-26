-- Migration: 015_filter_helpers
-- Description: Reusable SQL filter helper functions for period, school, and seller scoping.
--              These are server-side helper functions called from the Express query builder.
--              They DO NOT accept raw user input — parameters are always bound by the caller.
-- Date: 2026-02-25
-- Depends on: 001_auth_tables (schools, users), 006_kpi_tables (kpi_values)

-- ============================================================================
-- 1. filter_kpi_values
-- Returns kpi_values rows matching the supplied filter set.
-- All parameters are nullable; NULL means "no filter on that dimension".
-- ============================================================================

CREATE OR REPLACE FUNCTION public.filter_kpi_values(
  p_kpi_id       UUID        DEFAULT NULL,
  p_school_id    UUID        DEFAULT NULL,
  p_period_start DATE        DEFAULT NULL,
  p_period_end   DATE        DEFAULT NULL
)
RETURNS SETOF public.kpi_values
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT kv.*
  FROM   public.kpi_values kv
  WHERE  (p_kpi_id       IS NULL OR kv.kpi_id    = p_kpi_id)
    AND  (p_school_id    IS NULL OR kv.school_id  = p_school_id)
    AND  (p_period_start IS NULL OR kv.period_start >= p_period_start)
    AND  (p_period_end   IS NULL OR kv.period_end   <= p_period_end);
$$;

COMMENT ON FUNCTION public.filter_kpi_values IS
  'Reusable filter helper for kpi_values. '
  'All parameters are nullable; omit any dimension to skip that filter. '
  'RLS is evaluated at the caller''s privilege level (SECURITY INVOKER).';

-- ============================================================================
-- 2. filter_kpi_goals
-- Returns kpi_goals rows matching the supplied filter set.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.filter_kpi_goals(
  p_kpi_id       UUID DEFAULT NULL,
  p_school_id    UUID DEFAULT NULL,
  p_period_start DATE DEFAULT NULL,
  p_period_end   DATE DEFAULT NULL
)
RETURNS SETOF public.kpi_goals
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT kg.*
  FROM   public.kpi_goals kg
  WHERE  (p_kpi_id       IS NULL OR kg.kpi_id    = p_kpi_id)
    AND  (p_school_id    IS NULL OR kg.school_id  = p_school_id)
    AND  (p_period_start IS NULL OR kg.period_start >= p_period_start)
    AND  (p_period_end   IS NULL OR kg.period_end   <= p_period_end);
$$;

COMMENT ON FUNCTION public.filter_kpi_goals IS
  'Reusable filter helper for kpi_goals. '
  'All parameters are nullable; omit any dimension to skip that filter.';

-- ============================================================================
-- 3. filter_school_aggregates
-- Returns school_aggregates rows for a school within an optional date range.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.filter_school_aggregates(
  p_school_id    UUID DEFAULT NULL,
  p_date_from    DATE DEFAULT NULL,
  p_date_to      DATE DEFAULT NULL
)
RETURNS SETOF public.school_aggregates
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT sa.*
  FROM   public.school_aggregates sa
  WHERE  (p_school_id IS NULL OR sa.school_id = p_school_id)
    AND  (p_date_from IS NULL OR sa.date >= p_date_from)
    AND  (p_date_to   IS NULL OR sa.date <= p_date_to);
$$;

COMMENT ON FUNCTION public.filter_school_aggregates IS
  'Reusable filter helper for school_aggregates.';

-- ============================================================================
-- 4. filter_school_comparison
-- Returns school_comparison rows matching metric_key, school, and period.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.filter_school_comparison(
  p_metric_key   VARCHAR(100) DEFAULT NULL,
  p_school_id    UUID         DEFAULT NULL,
  p_date_from    DATE         DEFAULT NULL,
  p_date_to      DATE         DEFAULT NULL
)
RETURNS SETOF public.school_comparison
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT sc.*
  FROM   public.school_comparison sc
  WHERE  (p_metric_key IS NULL OR sc.metric_key = p_metric_key)
    AND  (p_school_id  IS NULL OR sc.school_id  = p_school_id)
    AND  (p_date_from  IS NULL OR sc.date >= p_date_from)
    AND  (p_date_to    IS NULL OR sc.date <= p_date_to);
$$;

COMMENT ON FUNCTION public.filter_school_comparison IS
  'Reusable filter helper for school_comparison.';

-- ============================================================================
-- 5. filter_network_aggregates
-- Returns network_aggregates rows within a date range.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.filter_network_aggregates(
  p_date_from DATE DEFAULT NULL,
  p_date_to   DATE DEFAULT NULL
)
RETURNS SETOF public.network_aggregates
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT na.*
  FROM   public.network_aggregates na
  WHERE  (p_date_from IS NULL OR na.date >= p_date_from)
    AND  (p_date_to   IS NULL OR na.date <= p_date_to);
$$;

COMMENT ON FUNCTION public.filter_network_aggregates IS
  'Reusable filter helper for network_aggregates.';

-- ============================================================================
-- Design notes
-- ============================================================================
-- All functions are SECURITY INVOKER — they run with the calling role's privileges.
-- This ensures RLS policies on the underlying tables are always enforced.
-- The Express query-builder (server/query-builder.ts) calls these functions via
-- parameterized pg queries to prevent SQL injection from client input.
