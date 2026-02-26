-- Create metrics table for tracking connector execution performance
CREATE TABLE IF NOT EXISTS connector_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    records_in INTEGER NOT NULL DEFAULT 0,
    records_out INTEGER NOT NULL DEFAULT 0,
    error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for searching metrics by connector, ordered by time
CREATE INDEX IF NOT EXISTS idx_connector_metrics_connector_time ON connector_metrics(connector_id, created_at DESC);

-- Create SLAs table defining thresholds for each connector
CREATE TABLE IF NOT EXISTS connector_slas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE UNIQUE,
    max_latency_ms INTEGER NOT NULL DEFAULT 5000,
    success_rate_threshold NUMERIC(5,2) NOT NULL DEFAULT 95.00,
    escalation_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at on SLAs
CREATE TRIGGER set_connector_slas_updated_at
  BEFORE UPDATE ON connector_slas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create integration alerts for stateful tracking of SLA/metric breaches
CREATE TABLE IF NOT EXISTS integration_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_alerts_status_time ON integration_alerts(status, created_at DESC);

-- Create alert notifications ledger for tracking dispatch (Slack, Email)
CREATE TABLE IF NOT EXISTS alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES integration_alerts(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'webhook')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Establish TTL Cleanup function using pg_cron for metrics older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_connector_metrics()
RETURNS void AS $$
BEGIN
  -- Delete all telemetry data older than 30 days securely to prevent table bloat
  DELETE FROM connector_metrics WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cleanup function to run daily at midnight
SELECT cron.schedule('cleanup-connector-metrics', '0 0 * * *', 'SELECT cleanup_old_connector_metrics()');
