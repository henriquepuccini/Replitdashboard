-- Migration: 011_school_aggregates_rls
-- Description: Row-Level Security policies for school_aggregates table.
--              Mirrors the pattern established in 007_kpi_rls_policies.sql.
-- Date: 2026-02-25
-- Depends on: 011_school_aggregates (table), 002_rls_policies (is_admin, get_current_user_role),
--             005_connectors_rls_policies (is_ops, is_exec, is_user_in_school)

BEGIN;

-- ============================================================================
-- 1. Enable RLS
-- ============================================================================

ALTER TABLE public.school_aggregates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. SELECT policies
--    admin, ops, exec   → full visibility (all schools)
--    director           → scoped to their associated schools only
--    seller/finance     → no access (aggregates are admin-facing)
-- ============================================================================

-- SELECT: admin sees all school aggregates
CREATE POLICY school_aggregates_select_admin ON public.school_aggregates
  FOR SELECT
  USING (public.is_admin());

-- SELECT: ops sees all school aggregates (monitoring / reporting)
CREATE POLICY school_aggregates_select_ops ON public.school_aggregates
  FOR SELECT
  USING (public.is_ops());

-- SELECT: exec sees all school aggregates (network-wide visibility)
CREATE POLICY school_aggregates_select_exec ON public.school_aggregates
  FOR SELECT
  USING (public.is_exec());

-- SELECT: director sees aggregates for their own schools only
CREATE POLICY school_aggregates_select_director ON public.school_aggregates
  FOR SELECT
  USING (
    public.get_current_user_role() = 'director'
    AND public.is_user_in_school(school_id)
  );

-- ============================================================================
-- 3. INSERT policy
--    Primary INSERT path: service_role (KPI calc edge function, bypasses RLS).
--    Admin fallback: allows manual corrections / backfills via admin UI.
-- ============================================================================

CREATE POLICY school_aggregates_insert_admin ON public.school_aggregates
  FOR INSERT
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. UPDATE policy
--    Primary UPDATE path: service_role upserts (ON CONFLICT … DO UPDATE).
--    Admin fallback only — aggregates should not be hand-edited by users.
-- ============================================================================

CREATE POLICY school_aggregates_update_admin ON public.school_aggregates
  FOR UPDATE
  USING (public.is_admin());

-- ============================================================================
-- 5. DELETE policy
--    Admin can delete stale or incorrect aggregate rows.
--    service_role can also delete (bypasses RLS) for data recovery.
-- ============================================================================

CREATE POLICY school_aggregates_delete_admin ON public.school_aggregates
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- Notes
-- ============================================================================
-- • service_role (used by the KPI calc edge function) has BYPASSRLS privilege in
--   Supabase and is NOT affected by any of the policies above.
-- • The edge function should use ON CONFLICT(school_id, date) DO UPDATE to
--   perform idempotent upserts — safe to re-run for the same (school, date).
-- • Sellers and finance roles have no explicit SELECT policy on this table,
--   so they receive an implicit DENY (RLS default-deny when enabled).

COMMIT;
