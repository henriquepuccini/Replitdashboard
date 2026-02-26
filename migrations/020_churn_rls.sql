-- Migration: 020_churn_rls
-- Description: RLS policies for churn_rules, churn_events, and churn_runs.
-- Depends on: 002_rls_policies (is_admin, get_current_user_role, is_user_in_school)
--             005_connectors_rls_policies (is_ops, is_exec)
--             019_churn_rules (tables)

BEGIN;

-- ============================================================================
-- 1. Enable RLS on all churn tables
-- ============================================================================

ALTER TABLE public.churn_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churn_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churn_runs   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. churn_rules policies
--    SELECT: admin, ops, exec, analytics can read all; directors see their school's rules
--    INSERT: admin only (network-wide) or directors for their school
--    UPDATE: admin or directors for their school
--    DELETE: admin only
-- ============================================================================

-- SELECT: elevated roles see all rules
CREATE POLICY churn_rules_select_elevated ON public.churn_rules
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('admin', 'ops', 'exec', 'analytics')
  );

-- SELECT: directors see their school's rules
CREATE POLICY churn_rules_select_director ON public.churn_rules
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  );

-- INSERT: admin can create any rule
CREATE POLICY churn_rules_insert_admin ON public.churn_rules
  FOR INSERT
  WITH CHECK (
    public.is_admin()
  );

-- INSERT: directors can create rules for their school
CREATE POLICY churn_rules_insert_director ON public.churn_rules
  FOR INSERT
  WITH CHECK (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  );

-- UPDATE: admin can update any rule
CREATE POLICY churn_rules_update_admin ON public.churn_rules
  FOR UPDATE
  USING  ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- UPDATE: directors can update their school's rules
CREATE POLICY churn_rules_update_director ON public.churn_rules
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  )
  WITH CHECK (
    public.get_current_user_role() = 'director'
    AND school_id IS NOT NULL
    AND public.is_user_in_school(school_id)
  );

-- DELETE: admin only
CREATE POLICY churn_rules_delete_admin ON public.churn_rules
  FOR DELETE
  USING ( public.is_admin() );

-- ============================================================================
-- 3. churn_events policies
--    Append-only audit trail.
--    INSERT: service_role (engine) bypasses RLS. No authenticated INSERT needed.
--    SELECT: admin, ops, exec, analytics see all; directors see their school's events
--    UPDATE: admin only (corrections)
--    DELETE: admin only (purge)
-- ============================================================================

-- SELECT: elevated roles see all events
CREATE POLICY churn_events_select_elevated ON public.churn_events
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('admin', 'ops', 'exec', 'analytics')
  );

-- SELECT: directors see their school's events
CREATE POLICY churn_events_select_director ON public.churn_events
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND public.is_user_in_school(school_id)
  );

-- UPDATE: admin only (rare corrections to audit entries)
CREATE POLICY churn_events_update_admin ON public.churn_events
  FOR UPDATE
  USING  ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- DELETE: admin only (regulatory purge)
CREATE POLICY churn_events_delete_admin ON public.churn_events
  FOR DELETE
  USING ( public.is_admin() );

-- NOTE: No INSERT policy for authenticated roles.
-- The churn detection engine uses the service_role key which bypasses RLS,
-- avoiding per-row policy evaluation overhead on high-volume bulk inserts.

-- ============================================================================
-- 4. churn_runs policies
--    SELECT: admin, ops, exec, analytics
--    INSERT/UPDATE/DELETE: admin only (service_role engine bypasses RLS)
-- ============================================================================

-- SELECT: elevated roles
CREATE POLICY churn_runs_select_elevated ON public.churn_runs
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('admin', 'ops', 'exec', 'analytics')
  );

-- INSERT: admin (manual runs)
CREATE POLICY churn_runs_insert_admin ON public.churn_runs
  FOR INSERT
  WITH CHECK ( public.is_admin() );

-- UPDATE: admin (mark finished_at, processed_records)
CREATE POLICY churn_runs_update_admin ON public.churn_runs
  FOR UPDATE
  USING  ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- DELETE: admin only
CREATE POLICY churn_runs_delete_admin ON public.churn_runs
  FOR DELETE
  USING ( public.is_admin() );

-- ============================================================================
-- Design notes
-- ============================================================================
-- • service_role bypasses RLS entirely — the churn detection engine (edge
--   function) runs under service_role and can INSERT into churn_events and
--   churn_runs at full throughput without per-row policy checks.
--
-- • churn_events is designed as append-only for audit integrity. Only admin
--   can UPDATE or DELETE records, and only for regulatory/correction purposes.
--
-- • analytics role is granted read access across all three tables so BI tools
--   and dashboards can query churn data freely.

COMMIT;
