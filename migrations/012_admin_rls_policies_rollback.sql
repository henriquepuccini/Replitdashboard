-- Rollback: 012_admin_rls_policies
-- Description: Reverses migration 012_admin_rls_policies.sql.
--              Restores kpi_goals_select_director to its original definition
--              from migration 007 (without category filter).
-- Date: 2026-02-25

BEGIN;

-- ============================================================================
-- 1. Drop new policies added in 012
-- ============================================================================

DROP POLICY IF EXISTS school_aggregates_select_finance ON public.school_aggregates;
DROP POLICY IF EXISTS kpi_goals_select_finance         ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_update_finance         ON public.kpi_goals;

-- ============================================================================
-- 2. Restore original director SELECT policy on kpi_goals
--    (as it existed after migration 007, without category filtering)
-- ============================================================================

DROP POLICY IF EXISTS kpi_goals_select_director ON public.kpi_goals;

CREATE POLICY kpi_goals_select_director ON public.kpi_goals
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  );

-- ============================================================================
-- 3. Drop helper function added in 012
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_finance_in_school(UUID);

-- ============================================================================
-- 4. Remove category column from kpi_definitions
--    NOTE: This will fail if any view or function depends on this column.
--    Review dependencies before running this rollback in production.
-- ============================================================================

DROP INDEX IF EXISTS idx_kpi_definitions_category;

ALTER TABLE public.kpi_definitions
  DROP COLUMN IF EXISTS category;

COMMIT;
