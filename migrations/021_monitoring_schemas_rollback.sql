-- Unschedule the cron job
SELECT cron.unschedule('cleanup-connector-metrics');

-- Drop TTL function
DROP FUNCTION IF EXISTS cleanup_old_connector_metrics();

-- Drop Alert Notifications table
DROP TABLE IF EXISTS alert_notifications CASCADE;

-- Drop Integration Alerts table
DROP INDEX IF EXISTS idx_integration_alerts_status_time;
DROP TABLE IF EXISTS integration_alerts CASCADE;

-- Drop Connector SLAs table
DROP TRIGGER IF EXISTS set_connector_slas_updated_at ON connector_slas;
DROP TABLE IF EXISTS connector_slas CASCADE;

-- Drop Connector Metrics table
DROP INDEX IF EXISTS idx_connector_metrics_connector_time;
DROP TABLE IF EXISTS connector_metrics CASCADE;
