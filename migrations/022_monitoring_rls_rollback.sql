-- Rollback for 022_monitoring_rls

BEGIN;

-- Drop policies for alert_notifications
DROP POLICY IF EXISTS alert_notifications_select_ops_admin ON public.alert_notifications;

-- Drop policies for integration_alerts
DROP POLICY IF EXISTS integration_alerts_update_ops_admin ON public.integration_alerts;
DROP POLICY IF EXISTS integration_alerts_select_exec ON public.integration_alerts;
DROP POLICY IF EXISTS integration_alerts_select_ops_admin ON public.integration_alerts;

-- Drop policies for connector_slas
DROP POLICY IF EXISTS connector_slas_delete_ops_admin ON public.connector_slas;
DROP POLICY IF EXISTS connector_slas_insert_ops_admin ON public.connector_slas;
DROP POLICY IF EXISTS connector_slas_update_ops_admin ON public.connector_slas;
DROP POLICY IF EXISTS connector_slas_select_ops_admin ON public.connector_slas;

-- Drop policies for connector_metrics
DROP POLICY IF EXISTS connector_metrics_select_owner ON public.connector_metrics;
DROP POLICY IF EXISTS connector_metrics_select_exec ON public.connector_metrics;
DROP POLICY IF EXISTS connector_metrics_select_ops_admin ON public.connector_metrics;

-- Disable RLS
ALTER TABLE public.alert_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_slas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_metrics DISABLE ROW LEVEL SECURITY;

COMMIT;
