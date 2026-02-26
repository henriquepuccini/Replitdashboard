-- 016_reports.sql
-- Create reports storage and scheduled execution schemas.

-- 1. scheduled_reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    format VARCHAR(10) NOT NULL DEFAULT 'csv',
    schedule_cron TEXT,
    recipients JSONB DEFAULT '[]'::jsonb,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_owner ON scheduled_reports(owner_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);

-- 2. report_exports
CREATE TABLE IF NOT EXISTS report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE SET NULL,
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    format VARCHAR(10) NOT NULL,
    file_path TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on status + created_at to quickly find stuck pending exports or successful runs
CREATE INDEX IF NOT EXISTS idx_report_exports_status ON report_exports(status, created_at);

-- 3. Triggers for updated_at
CREATE TRIGGER update_scheduled_reports_updated_at
    BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_exports_updated_at
    BEFORE UPDATE ON report_exports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
