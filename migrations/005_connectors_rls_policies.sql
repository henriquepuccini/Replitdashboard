-- Migration: Row-Level Security Policies for Connectors & Sync Tables
-- Description: Enables RLS on connectors, connector_mappings, sync_runs,
--              raw_ingest_files, leads, payments, enrollments with role-based
--              access policies for Supabase Auth integration
-- Date: 2026-02-10
-- Requires: Migration 002 (helper functions: is_admin, get_current_user_role, has_elevated_role, is_director_of_school)
-- Note: service_role bypasses RLS by default in Supabase (BYPASSRLS privilege)

BEGIN;

-- ============================================================================
-- 1. Enable RLS on all connector & sync tables
-- ============================================================================

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_ingest_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Helper function: check if current user owns a connector
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_connector_owner(p_connector_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connectors
    WHERE id = p_connector_id
      AND owner_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. Helper function: check if current user has ops role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_ops()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'ops'
      AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 4. Helper function: check if current user has exec role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_exec()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'exec'
      AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 5. Helper function: get school IDs the current user is associated with
--    Returns all school_ids from user_schools for the current user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_school_ids()
RETURNS SETOF UUID AS $$
  SELECT school_id FROM public.user_schools
  WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. Helper function: check if current user is associated with a given school
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_user_in_school(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools
    WHERE user_id = auth.uid()
      AND school_id = p_school_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 7. CONNECTORS TABLE POLICIES
-- ============================================================================

-- SELECT: connector owner can read their own connectors
CREATE POLICY connectors_select_owner ON public.connectors
  FOR SELECT
  USING (owner_id = auth.uid());

-- SELECT: admin can read all connectors
CREATE POLICY connectors_select_admin ON public.connectors
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops can read all connectors (monitoring)
CREATE POLICY connectors_select_ops ON public.connectors
  FOR SELECT
  USING (public.is_ops());

-- INSERT: only admin can create connectors directly
-- (or service_role which bypasses RLS for edge functions)
CREATE POLICY connectors_insert_admin ON public.connectors
  FOR INSERT
  WITH CHECK (public.is_admin());

-- UPDATE: admin can update any connector
CREATE POLICY connectors_update_admin ON public.connectors
  FOR UPDATE
  USING (public.is_admin());

-- UPDATE: owner can update their own connectors
CREATE POLICY connectors_update_owner ON public.connectors
  FOR UPDATE
  USING (owner_id = auth.uid());

-- DELETE: only admin can delete connectors
CREATE POLICY connectors_delete_admin ON public.connectors
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 8. CONNECTOR_MAPPINGS TABLE POLICIES
-- ============================================================================

-- SELECT: connector owner or admin can read mappings
CREATE POLICY connector_mappings_select_owner ON public.connector_mappings
  FOR SELECT
  USING (public.is_connector_owner(connector_id));

CREATE POLICY connector_mappings_select_admin ON public.connector_mappings
  FOR SELECT
  USING (public.is_admin());

-- INSERT: connector owner or admin can create mappings
CREATE POLICY connector_mappings_insert_owner ON public.connector_mappings
  FOR INSERT
  WITH CHECK (public.is_connector_owner(connector_id));

CREATE POLICY connector_mappings_insert_admin ON public.connector_mappings
  FOR INSERT
  WITH CHECK (public.is_admin());

-- UPDATE: connector owner or admin can update mappings
CREATE POLICY connector_mappings_update_owner ON public.connector_mappings
  FOR UPDATE
  USING (public.is_connector_owner(connector_id));

CREATE POLICY connector_mappings_update_admin ON public.connector_mappings
  FOR UPDATE
  USING (public.is_admin());

-- DELETE: connector owner or admin can delete mappings
CREATE POLICY connector_mappings_delete_owner ON public.connector_mappings
  FOR DELETE
  USING (public.is_connector_owner(connector_id));

CREATE POLICY connector_mappings_delete_admin ON public.connector_mappings
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 9. SYNC_RUNS TABLE POLICIES
-- ============================================================================

-- SELECT: connector owner can view sync runs for their connectors
CREATE POLICY sync_runs_select_owner ON public.sync_runs
  FOR SELECT
  USING (public.is_connector_owner(connector_id));

-- SELECT: admin can view all sync runs
CREATE POLICY sync_runs_select_admin ON public.sync_runs
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops can view all sync runs (monitoring)
CREATE POLICY sync_runs_select_ops ON public.sync_runs
  FOR SELECT
  USING (public.is_ops());

-- INSERT: service_role inserts sync run logs (bypasses RLS)
-- ops role can also insert sync run logs for manual logging
CREATE POLICY sync_runs_insert_ops ON public.sync_runs
  FOR INSERT
  WITH CHECK (public.is_ops() OR public.is_admin());

-- UPDATE: service_role updates sync runs (bypasses RLS)
-- admin or ops can update status (e.g. mark failed)
CREATE POLICY sync_runs_update_ops ON public.sync_runs
  FOR UPDATE
  USING (public.is_ops() OR public.is_admin());

-- DELETE: append-only — no user can delete sync runs
-- service_role can still delete if needed (bypasses RLS)
CREATE POLICY sync_runs_delete_deny ON public.sync_runs
  FOR DELETE
  USING (false);

-- ============================================================================
-- 10. RAW_INGEST_FILES TABLE POLICIES
-- ============================================================================

-- SELECT: connector owner can view files for their connectors
CREATE POLICY raw_ingest_files_select_owner ON public.raw_ingest_files
  FOR SELECT
  USING (public.is_connector_owner(connector_id));

-- SELECT: admin can view all files
CREATE POLICY raw_ingest_files_select_admin ON public.raw_ingest_files
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops can view all files (monitoring)
CREATE POLICY raw_ingest_files_select_ops ON public.raw_ingest_files
  FOR SELECT
  USING (public.is_ops());

-- INSERT: service_role and ops can insert file records
CREATE POLICY raw_ingest_files_insert_ops ON public.raw_ingest_files
  FOR INSERT
  WITH CHECK (public.is_ops() OR public.is_admin());

-- UPDATE: admin/ops can mark files as processed
CREATE POLICY raw_ingest_files_update_ops ON public.raw_ingest_files
  FOR UPDATE
  USING (public.is_ops() OR public.is_admin());

-- DELETE: append-only — no user can delete file records
-- service_role can still delete if needed (bypasses RLS)
CREATE POLICY raw_ingest_files_delete_deny ON public.raw_ingest_files
  FOR DELETE
  USING (false);

-- ============================================================================
-- 11. LEADS TABLE POLICIES
-- ============================================================================

-- SELECT: admin/exec sees all leads
CREATE POLICY leads_select_admin ON public.leads
  FOR SELECT
  USING (public.is_admin() OR public.is_exec());

-- SELECT: director/finance see leads scoped to their schools
CREATE POLICY leads_select_school_scoped ON public.leads
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('director', 'finance')
    AND public.is_user_in_school(school_id)
  );

-- SELECT: seller sees leads for their associated schools
CREATE POLICY leads_select_seller ON public.leads
  FOR SELECT
  USING (
    public.get_current_user_role() = 'seller'
    AND public.is_user_in_school(school_id)
  );

-- SELECT: ops can see all leads (monitoring)
CREATE POLICY leads_select_ops ON public.leads
  FOR SELECT
  USING (public.is_ops());

-- INSERT/UPDATE/DELETE: only service_role (bypasses RLS) for sync operations
CREATE POLICY leads_insert_deny ON public.leads
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY leads_update_deny ON public.leads
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY leads_delete_deny ON public.leads
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 12. PAYMENTS TABLE POLICIES
-- ============================================================================

-- SELECT: admin/exec sees all payments
CREATE POLICY payments_select_admin ON public.payments
  FOR SELECT
  USING (public.is_admin() OR public.is_exec());

-- SELECT: director/finance see payments scoped to their schools
CREATE POLICY payments_select_school_scoped ON public.payments
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('director', 'finance')
    AND public.is_user_in_school(school_id)
  );

-- SELECT: seller sees payments for their associated schools
CREATE POLICY payments_select_seller ON public.payments
  FOR SELECT
  USING (
    public.get_current_user_role() = 'seller'
    AND public.is_user_in_school(school_id)
  );

-- SELECT: ops can see all payments (monitoring)
CREATE POLICY payments_select_ops ON public.payments
  FOR SELECT
  USING (public.is_ops());

-- INSERT/UPDATE/DELETE: only service_role or admin
CREATE POLICY payments_insert_deny ON public.payments
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY payments_update_deny ON public.payments
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY payments_delete_deny ON public.payments
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 13. ENROLLMENTS TABLE POLICIES
-- ============================================================================

-- SELECT: admin/exec sees all enrollments
CREATE POLICY enrollments_select_admin ON public.enrollments
  FOR SELECT
  USING (public.is_admin() OR public.is_exec());

-- SELECT: director/finance see enrollments scoped to their schools
CREATE POLICY enrollments_select_school_scoped ON public.enrollments
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('director', 'finance')
    AND public.is_user_in_school(school_id)
  );

-- SELECT: seller sees enrollments for their associated schools
CREATE POLICY enrollments_select_seller ON public.enrollments
  FOR SELECT
  USING (
    public.get_current_user_role() = 'seller'
    AND public.is_user_in_school(school_id)
  );

-- SELECT: ops can see all enrollments (monitoring)
CREATE POLICY enrollments_select_ops ON public.enrollments
  FOR SELECT
  USING (public.is_ops());

-- INSERT/UPDATE/DELETE: only service_role or admin
CREATE POLICY enrollments_insert_deny ON public.enrollments
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY enrollments_update_deny ON public.enrollments
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY enrollments_delete_deny ON public.enrollments
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 14. SERVICE ROLE NOTES
-- ============================================================================
-- Edge functions performing sync MUST use service_role key to bypass RLS.
-- service_role has BYPASSRLS privilege in Supabase, so all INSERT/UPDATE
-- operations from edge functions will succeed without hitting these policies.
--
-- Logging tables (sync_runs, raw_ingest_files) are append-only:
-- - DELETE policies deny all non-service-role deletes
-- - This preserves audit trail integrity
--
-- Normalized data tables (leads, payments, enrollments):
-- - Writes only via service_role (sync edge functions)
-- - Admin fallback INSERT/UPDATE/DELETE for manual corrections

COMMIT;
