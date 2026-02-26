-- Migration: 022_monitoring_rls
-- Description: RLS policies for monitoring and alerts schemas
-- Date: 2026-02-25

BEGIN;

-- Enable RLS on all monitoring tables
ALTER TABLE public.connector_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. CONNECTOR_METRICS
-- ============================================================================
-- Insert: Service role only (bypasses RLS). No INSERT policy needed.

-- SELECT: ops and admin can view all
CREATE POLICY connector_metrics_select_ops_admin ON public.connector_metrics
  FOR SELECT USING (public.is_ops() OR public.is_admin());

-- SELECT: exec may view (for aggregates)
CREATE POLICY connector_metrics_select_exec ON public.connector_metrics
  FOR SELECT USING (public.is_exec());

-- SELECT: owners can view their own connector metrics
CREATE POLICY connector_metrics_select_owner ON public.connector_metrics
  FOR SELECT USING (public.is_connector_owner(connector_id));

-- ============================================================================
-- 2. CONNECTOR_SLAS
-- ============================================================================

-- SELECT: ops and admin only
CREATE POLICY connector_slas_select_ops_admin ON public.connector_slas
  FOR SELECT USING (public.is_ops() OR public.is_admin());

-- UPDATE: ops and admin only
CREATE POLICY connector_slas_update_ops_admin ON public.connector_slas
  FOR UPDATE USING (public.is_ops() OR public.is_admin());

-- INSERT/DELETE: ops and admin only (implied by ops/admin requirement for SLA management)
CREATE POLICY connector_slas_insert_ops_admin ON public.connector_slas
  FOR INSERT WITH CHECK (public.is_ops() OR public.is_admin());

CREATE POLICY connector_slas_delete_ops_admin ON public.connector_slas
  FOR DELETE USING (public.is_ops() OR public.is_admin());

-- ============================================================================
-- 3. INTEGRATION_ALERTS
-- ============================================================================

-- SELECT: ops and admin can view all alerts
CREATE POLICY integration_alerts_select_ops_admin ON public.integration_alerts
  FOR SELECT USING (public.is_ops() OR public.is_admin());

-- SELECT: exec can view high-level alerts
CREATE POLICY integration_alerts_select_exec ON public.integration_alerts
  FOR SELECT USING (public.is_exec());

-- UPDATE: ops and admin can acknowledge/resolve alerts
CREATE POLICY integration_alerts_update_ops_admin ON public.integration_alerts
  FOR UPDATE USING (public.is_ops() OR public.is_admin());

-- INSERT: monitoring service/edge functions (bypasses RLS) 
-- No INSERT policy for regular authenticated users

-- ============================================================================
-- 4. ALERT_NOTIFICATIONS
-- ============================================================================

-- SELECT: ops and admin can view notification logs
CREATE POLICY alert_notifications_select_ops_admin ON public.alert_notifications
  FOR SELECT USING (public.is_ops() OR public.is_admin());

-- INSERT by service role only (bypasses RLS)
-- No INSERT policy for regular authenticated users

COMMIT;
