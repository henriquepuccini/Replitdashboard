-- Migration: Row-Level Security Policies for KPI & Goals Tables
-- Description: Enables RLS on kpi_definitions, kpi_goals, kpi_values,
--              kpi_calc_runs, calculation_audit with role-based access policies
-- Date: 2026-02-19
-- Requires: Migration 002 (helper functions: is_admin, get_current_user_role,
--           has_elevated_role, is_director_of_school)
--           Migration 005 (helper functions: is_ops, is_exec, is_user_in_school,
--           get_user_school_ids)
-- Note: service_role bypasses RLS by default in Supabase (BYPASSRLS privilege)

BEGIN;

-- ============================================================================
-- 1. Enable RLS on all KPI tables
-- ============================================================================

ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_calc_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Helper function: check if user is KPI owner (owner_id on kpi_definitions)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_kpi_owner(p_kpi_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kpi_definitions
    WHERE id = p_kpi_id
      AND owner_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. KPI_DEFINITIONS TABLE POLICIES
--    INSERT/UPDATE/DELETE: admin and analytics owners only
--    SELECT: admin, ops, exec (+ owner for their own definitions)
-- ============================================================================

-- SELECT: admin can read all KPI definitions
CREATE POLICY kpi_definitions_select_admin ON public.kpi_definitions
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops can read all KPI definitions
CREATE POLICY kpi_definitions_select_ops ON public.kpi_definitions
  FOR SELECT
  USING (public.is_ops());

-- SELECT: exec can read all KPI definitions
CREATE POLICY kpi_definitions_select_exec ON public.kpi_definitions
  FOR SELECT
  USING (public.is_exec());

-- SELECT: owner can read their own KPI definitions
CREATE POLICY kpi_definitions_select_owner ON public.kpi_definitions
  FOR SELECT
  USING (owner_id = auth.uid());

-- INSERT: only admin can create KPI definitions
-- Analytics owners are assigned via owner_id by admin at creation time
CREATE POLICY kpi_definitions_insert_admin ON public.kpi_definitions
  FOR INSERT
  WITH CHECK (public.is_admin());

-- UPDATE: only admin can update any KPI definition
CREATE POLICY kpi_definitions_update_admin ON public.kpi_definitions
  FOR UPDATE
  USING (public.is_admin());

-- UPDATE: owner can update their own KPI definitions (config/description only)
CREATE POLICY kpi_definitions_update_owner ON public.kpi_definitions
  FOR UPDATE
  USING (owner_id = auth.uid());

-- DELETE: only admin can delete KPI definitions
CREATE POLICY kpi_definitions_delete_admin ON public.kpi_definitions
  FOR DELETE
  USING (public.is_admin());

-- DELETE: owner can delete their own KPI definitions
CREATE POLICY kpi_definitions_delete_owner ON public.kpi_definitions
  FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================================
-- 4. KPI_GOALS TABLE POLICIES
--    Directors manage goals for their school; admins for all schools
--    Exec can view network goals (school_id IS NULL)
--    Ops can view all goals
-- ============================================================================

-- SELECT: admin can read all goals
CREATE POLICY kpi_goals_select_admin ON public.kpi_goals
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops can read all goals
CREATE POLICY kpi_goals_select_ops ON public.kpi_goals
  FOR SELECT
  USING (public.is_ops());

-- SELECT: exec can read all goals (network-wide view)
CREATE POLICY kpi_goals_select_exec ON public.kpi_goals
  FOR SELECT
  USING (public.is_exec());

-- SELECT: director can read goals scoped to their schools only
-- Network goals (school_id IS NULL) are visible to exec/admin/ops, not directors
CREATE POLICY kpi_goals_select_director ON public.kpi_goals
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  );

-- INSERT: admin can create goals for any school
CREATE POLICY kpi_goals_insert_admin ON public.kpi_goals
  FOR INSERT
  WITH CHECK (public.is_admin());

-- INSERT: director can create goals for their own schools only
CREATE POLICY kpi_goals_insert_director ON public.kpi_goals
  FOR INSERT
  WITH CHECK (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_director_of_school(school_id)
  );

-- UPDATE: admin can update any goal
CREATE POLICY kpi_goals_update_admin ON public.kpi_goals
  FOR UPDATE
  USING (public.is_admin());

-- UPDATE: director can update goals for their own schools only
CREATE POLICY kpi_goals_update_director ON public.kpi_goals
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_director_of_school(school_id)
  );

-- DELETE: admin can delete any goal
CREATE POLICY kpi_goals_delete_admin ON public.kpi_goals
  FOR DELETE
  USING (public.is_admin());

-- DELETE: director can delete goals for their own schools only
CREATE POLICY kpi_goals_delete_director ON public.kpi_goals
  FOR DELETE
  USING (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_director_of_school(school_id)
  );

-- ============================================================================
-- 5. KPI_VALUES TABLE POLICIES
--    INSERT: only service_role/edge functions (bypass RLS) or admin fallback
--    SELECT: sellers see their school values; directors see their schools;
--            exec sees all; ops sees all; admin sees all
-- ============================================================================

-- SELECT: admin can read all computed values
CREATE POLICY kpi_values_select_admin ON public.kpi_values
  FOR SELECT
  USING (public.is_admin());

-- SELECT: exec can read all computed values (network-wide)
CREATE POLICY kpi_values_select_exec ON public.kpi_values
  FOR SELECT
  USING (public.is_exec());

-- SELECT: ops can read all computed values (monitoring)
CREATE POLICY kpi_values_select_ops ON public.kpi_values
  FOR SELECT
  USING (public.is_ops());

-- SELECT: director can read values scoped to their schools + network values
CREATE POLICY kpi_values_select_director ON public.kpi_values
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND (
      school_id IS NULL
      OR public.is_user_in_school(school_id)
    )
  );

-- SELECT: seller can read values scoped to their associated schools only
CREATE POLICY kpi_values_select_seller ON public.kpi_values
  FOR SELECT
  USING (
    public.get_current_user_role() = 'seller'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  );

-- SELECT: finance can read values scoped to their schools + network values
CREATE POLICY kpi_values_select_finance ON public.kpi_values
  FOR SELECT
  USING (
    public.get_current_user_role() = 'finance'
    AND (
      school_id IS NULL
      OR public.is_user_in_school(school_id)
    )
  );

-- INSERT: admin fallback for manual corrections
-- Note: primary INSERT path is via service_role which bypasses RLS
CREATE POLICY kpi_values_insert_admin ON public.kpi_values
  FOR INSERT
  WITH CHECK (public.is_admin());

-- UPDATE: append-only — no user can update computed values
-- service_role can still update if needed for data recovery (bypasses RLS)
CREATE POLICY kpi_values_update_deny ON public.kpi_values
  FOR UPDATE
  USING (false);

-- DELETE: append-only — only admin can delete computed values
-- service_role can still delete if needed (bypasses RLS)
CREATE POLICY kpi_values_delete_admin ON public.kpi_values
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 6. KPI_CALC_RUNS TABLE POLICIES
--    SELECT: only ops and admin
--    INSERT: service_role (bypass RLS) or admin/ops fallback
--    Append-only: no UPDATE/DELETE by non-admin
-- ============================================================================

-- SELECT: admin can read all calc runs
CREATE POLICY kpi_calc_runs_select_admin ON public.kpi_calc_runs
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops can read all calc runs (monitoring)
CREATE POLICY kpi_calc_runs_select_ops ON public.kpi_calc_runs
  FOR SELECT
  USING (public.is_ops());

-- INSERT: admin/ops can insert calc run records
-- Note: primary INSERT path is via service_role which bypasses RLS
CREATE POLICY kpi_calc_runs_insert_ops ON public.kpi_calc_runs
  FOR INSERT
  WITH CHECK (public.is_ops() OR public.is_admin());

-- UPDATE: admin/ops can update status (e.g. mark finished/failed)
-- service_role can also update (bypasses RLS)
CREATE POLICY kpi_calc_runs_update_ops ON public.kpi_calc_runs
  FOR UPDATE
  USING (public.is_ops() OR public.is_admin());

-- DELETE: append-only — no user can delete calc runs
-- service_role can still delete if needed (bypasses RLS)
CREATE POLICY kpi_calc_runs_delete_deny ON public.kpi_calc_runs
  FOR DELETE
  USING (false);

-- ============================================================================
-- 7. CALCULATION_AUDIT TABLE POLICIES
--    SELECT: only ops and admin (audit trail)
--    INSERT: service_role (bypass RLS) or admin/ops fallback
--    Append-only: no UPDATE/DELETE by any user (not even admin)
-- ============================================================================

-- SELECT: admin can read all audit records
CREATE POLICY calc_audit_select_admin ON public.calculation_audit
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops can read all audit records (monitoring)
CREATE POLICY calc_audit_select_ops ON public.calculation_audit
  FOR SELECT
  USING (public.is_ops());

-- INSERT: admin/ops can insert audit records
-- Note: primary INSERT path is via service_role which bypasses RLS
CREATE POLICY calc_audit_insert_ops ON public.calculation_audit
  FOR INSERT
  WITH CHECK (public.is_ops() OR public.is_admin());

-- UPDATE: append-only — no user can update audit records
-- service_role can still update if needed (bypasses RLS)
CREATE POLICY calc_audit_update_deny ON public.calculation_audit
  FOR UPDATE
  USING (false);

-- DELETE: append-only — no user can delete audit records
-- service_role can still delete if needed (bypasses RLS)
CREATE POLICY calc_audit_delete_deny ON public.calculation_audit
  FOR DELETE
  USING (false);

-- ============================================================================
-- 8. SERVICE ROLE & EDGE FUNCTION NOTES
-- ============================================================================
-- Computed KPI values are primarily inserted by edge functions / background
-- jobs that use the service_role key (which has BYPASSRLS privilege).
--
-- The admin INSERT policies on kpi_values serve as a fallback for manual
-- corrections via the admin UI.
--
-- kpi_calc_runs and calculation_audit are append-only:
--   - calc_runs: DELETE denied to all users; UPDATE allowed for ops/admin
--     to mark status transitions (pending -> running -> success/failed)
--   - calculation_audit: both UPDATE and DELETE denied to ALL users
--     (including admin); only service_role can modify for data recovery
--
-- kpi_definitions should be treated as immutable for historical runs:
--   - When updating a KPI formula, prefer creating a new version record
--   - The version field in kpi_calc_runs tracks which formula version was used

COMMIT;
