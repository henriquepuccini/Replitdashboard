-- Migration: 013_exec_aggregates_rls
-- Description: Applies tightly scoped RLS policies to the executive aggregation schemas.
--              network_aggregates — admin / ops / exec only (no director; table has no school_id
--                                   so it cannot be row-scoped to a director's school).
--              school_comparison  — admin / exec see all rows;
--                                   directors see only rows for their own schools
--                                   (scoped via public.is_user_in_school(school_id)).
-- Date: 2026-02-25
-- Depends on: 013_exec_aggregates, 002_rls_policies (get_current_user_role),
--             005_connectors_rls_policies (is_user_in_school)

-- ============================================================================
-- 1. Enable RLS
-- ============================================================================

ALTER TABLE public.network_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_comparison ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. network_aggregates Policies
-- ============================================================================

-- Network-wide aggregate rows have no school_id column, so they cannot be
-- row-scoped to an individual director's school.
-- Access is therefore restricted to privileged cross-network roles only.
CREATE POLICY network_aggregates_select ON public.network_aggregates
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('admin', 'ops', 'exec')
  );

-- ============================================================================
-- 3. school_comparison Policies
-- ============================================================================

-- Admin and exec see the complete leaderboard (all schools, all metrics).
CREATE POLICY school_comparison_select_elevated ON public.school_comparison
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('admin', 'exec')
  );

-- Directors may only see ranking rows that belong to their own school(s).
-- public.is_user_in_school(school_id) checks the user_schools membership table.
CREATE POLICY school_comparison_select_director ON public.school_comparison
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND public.is_user_in_school(school_id)
  );

-- ============================================================================
-- 4. Explicit write-block (defence-in-depth)
-- ============================================================================

-- No INSERT / UPDATE / DELETE policies are created for any user role.
-- All writes are performed by the KPI calc edge function using the
-- service_role key, which bypasses RLS entirely.
-- This comment serves as an explicit reminder that the absence of write
-- policies is intentional — add none without reviewing security implications.
