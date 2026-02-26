-- Migration: 012_admin_rls_policies
-- Description: Grant directors and finance scoped access to school_aggregates
--              and kpi_goals. Enforce KPI category-based filtering so directors
--              cannot see payroll or sensitive finance KPI data.
-- Date: 2026-02-25
-- Depends on: 001_auth_tables (update_updated_at_column, schools)
--             002_rls_policies   (is_admin, get_current_user_role, is_director_of_school)
--             005_connectors_rls_policies (is_ops, is_exec, is_user_in_school)
--             006_kpi_tables     (kpi_definitions, kpi_goals)
--             007_kpi_rls_policies (kpi_goals_select_director — REPLACED here)
--             011_school_aggregates_rls (school_aggregates RLS already enabled)

BEGIN;

-- ============================================================================
-- 1. Add `category` column to kpi_definitions
--    Classifies each KPI by domain so policies can filter by sensitivity.
--    Allowed values (enforced at application layer):
--      'operational' — general performance metrics visible to directors/sellers
--      'finance'     — financial KPIs editable by finance, read-only to directors
--      'payroll'     — sensitive payroll KPIs; directors have NO access
--      'enrollment'  — student enrollment metrics (broadly visible)
-- ============================================================================

ALTER TABLE public.kpi_definitions
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'operational';

COMMENT ON COLUMN public.kpi_definitions.category IS
  'KPI domain category. Controls role-based visibility and edit access. '
  'Values: operational (default), finance, payroll, enrollment. '
  'Finance and payroll categories are hidden from director role.';

-- Index to support policy JOINs through kpi_definitions without seq-scans
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_category
  ON public.kpi_definitions(category);

-- ============================================================================
-- 2. Helper function: is_finance_in_school
--    Returns true if the current user has role = 'finance' in user_schools
--    for the given school. Uses user_schools (not users.school_id) so that
--    multi-school finance staff are handled correctly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_finance_in_school(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools
    WHERE user_id   = auth.uid()
      AND school_id = p_school_id
      AND role      = 'finance'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.is_finance_in_school(UUID) IS
  'Returns true if the current user has the finance role for the given school '
  'via the user_schools junction table. Used by kpi_goals and school_aggregates '
  'RLS policies to scope finance access without granting network-wide visibility.';

-- ============================================================================
-- 3. school_aggregates — finance SELECT policy
--    Finance can see aggregates for schools they belong to.
--    Uses get_current_user_role() + is_user_in_school() consistent with 007.
-- ============================================================================

CREATE POLICY school_aggregates_select_finance ON public.school_aggregates
  FOR SELECT
  USING (
    public.get_current_user_role() = 'finance'
    AND public.is_user_in_school(school_id)
  );

-- ============================================================================
-- 4. kpi_goals — finance SELECT policy
--    Finance can read all goals for schools they belong to.
--    Network-level goals (school_id IS NULL) remain admin/exec/ops only.
-- ============================================================================

CREATE POLICY kpi_goals_select_finance ON public.kpi_goals
  FOR SELECT
  USING (
    public.get_current_user_role() = 'finance'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  );

-- ============================================================================
-- 5. kpi_goals — finance UPDATE policy
--    Finance may update goal targets ONLY for:
--      a) Schools where they have the 'finance' role in user_schools
--      b) KPIs classified as category = 'finance'
--    This prevents finance from editing operational or enrollment KPI targets.
-- ============================================================================

CREATE POLICY kpi_goals_update_finance ON public.kpi_goals
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'finance'
    AND school_id IS NOT NULL
    AND public.is_finance_in_school(school_id)
    AND EXISTS (
      SELECT 1
      FROM public.kpi_definitions kd
      WHERE kd.id       = kpi_goals.kpi_id
        AND kd.category = 'finance'
    )
  )
  WITH CHECK (
    public.get_current_user_role() = 'finance'
    AND school_id IS NOT NULL
    AND public.is_finance_in_school(school_id)
    AND EXISTS (
      SELECT 1
      FROM public.kpi_definitions kd
      WHERE kd.id       = kpi_goals.kpi_id
        AND kd.category = 'finance'
    )
  );

-- ============================================================================
-- 6. kpi_goals — replace director SELECT policy
--    Migration 007 created kpi_goals_select_director without category filtering.
--    We DROP and re-CREATE it here to add the sensitivity exclusion:
--      directors CANNOT see goals for KPIs with category IN ('finance', 'payroll')
--
--    NOTE: PostgreSQL does not support ALTER POLICY's USING clause replacement
--    in all versions; DROP + CREATE is the portable, explicit approach.
-- ============================================================================

DROP POLICY IF EXISTS kpi_goals_select_director ON public.kpi_goals;

CREATE POLICY kpi_goals_select_director ON public.kpi_goals
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
    AND EXISTS (
      SELECT 1
      FROM public.kpi_definitions kd
      WHERE kd.id           = kpi_goals.kpi_id
        AND kd.category NOT IN ('finance', 'payroll')
    )
  );

COMMENT ON FUNCTION public.is_finance_in_school(UUID) IS
  'Returns true if the current user has the finance role for the given school '
  'via user_schools. Used by kpi_goals and school_aggregates RLS policies.';

-- ============================================================================
-- Design notes
-- ============================================================================
-- • Director coverage (INSERT/UPDATE/DELETE on kpi_goals) is unchanged from 007:
--   directors can still manage operational/enrollment goals for their schools.
--   The new SELECT filter is the only director-visible change.
--
-- • Finance INSERT on kpi_goals is NOT granted: finance's role is to adjust
--   targets on existing goals, not to create new goal definitions.
--   Goal creation remains admin- and director-scoped.
--
-- • Finance DELETE on kpi_goals is NOT granted: append-only discipline matches
--   the existing admin-only DELETE policy from 007.
--
-- • school_aggregates write policies (INSERT/UPDATE/DELETE) are unchanged from 011:
--   finance receives read-only access to pre-computed aggregates.
--
-- • Service role bypasses RLS and is unaffected by any policy in this file.

COMMIT;
