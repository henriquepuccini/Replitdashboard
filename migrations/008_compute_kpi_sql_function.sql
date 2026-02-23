-- Migration: 008_compute_kpi_sql_function
-- Description: Create SQL function compute_kpi_sql and advisory lock helper
--              for executing SQL-type KPI calculations safely
-- Date: 2026-02-23
-- Requires: Migration 006 (KPI tables)

BEGIN;

-- ============================================================================
-- 1. Helper: Generate a stable advisory lock key from text inputs
--    Returns a bigint hash suitable for pg_advisory_xact_lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.kpi_lock_key(
  p_kpi_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_school_id UUID DEFAULT NULL
)
RETURNS BIGINT AS $$
  SELECT abs(hashtext(
    p_kpi_id::text || '|' ||
    p_period_start::text || '|' ||
    p_period_end::text || '|' ||
    COALESCE(p_school_id::text, '__network__')
  ))::bigint;
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================================
-- 2. Try to acquire advisory lock (non-blocking)
--    Returns true if lock acquired, false if another session holds it
-- ============================================================================

CREATE OR REPLACE FUNCTION public.try_kpi_lock(
  p_kpi_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
  SELECT pg_try_advisory_xact_lock(
    public.kpi_lock_key(p_kpi_id, p_period_start, p_period_end, p_school_id)
  );
$$ LANGUAGE sql;

-- ============================================================================
-- 3. compute_kpi_sql: Execute SQL-based KPI calculation
--
--    The SQL template is stored in kpi_definitions.config->>'sql_template'
--    and supports the following parameter placeholders:
--      :period_start  - Start of calculation period (DATE)
--      :period_end    - End of calculation period (DATE)
--      :school_id     - School UUID or NULL for network-wide
--
--    The template MUST return a single row with a single numeric column.
--    Example template:
--      SELECT COUNT(*)::NUMERIC FROM enrollments
--      WHERE school_id = :school_id
--        AND created_at >= :period_start::timestamptz
--        AND created_at < :period_end::timestamptz
--
--    Returns: The computed NUMERIC value
--    Raises:  EXCEPTION if kpi not found, calc_type != 'sql', or no template
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_kpi_sql(
  p_kpi_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_school_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_calc_type VARCHAR;
  v_sql_template TEXT;
  v_safe_sql TEXT;
  v_result NUMERIC;
BEGIN
  SELECT calc_type, config->>'sql_template'
    INTO v_calc_type, v_sql_template
    FROM public.kpi_definitions
    WHERE id = p_kpi_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KPI definition not found or inactive: %', p_kpi_id;
  END IF;

  IF v_calc_type != 'sql' THEN
    RAISE EXCEPTION 'KPI % has calc_type=%, expected sql', p_kpi_id, v_calc_type;
  END IF;

  IF v_sql_template IS NULL OR v_sql_template = '' THEN
    RAISE EXCEPTION 'KPI % has no sql_template in config', p_kpi_id;
  END IF;

  v_safe_sql := replace(
    replace(
      replace(v_sql_template, ':school_id', quote_nullable(p_school_id)),
      ':period_start', quote_literal(p_period_start::text)
    ),
    ':period_end', quote_literal(p_period_end::text)
  );

  EXECUTE v_safe_sql INTO v_result;

  IF v_result IS NULL THEN
    v_result := 0;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Grant execute to authenticated role (Supabase)
-- ============================================================================

-- These grants apply when deployed to Supabase
-- DO $$ BEGIN
--   GRANT EXECUTE ON FUNCTION public.kpi_lock_key TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.try_kpi_lock TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.compute_kpi_sql TO service_role;
-- EXCEPTION WHEN OTHERS THEN NULL;
-- END $$;

COMMIT;
