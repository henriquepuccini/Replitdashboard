-- 018_download_audit.sql
-- Create an audit log table to track which users download which report exports.

CREATE TABLE IF NOT EXISTS report_download_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES report_exports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quickly finding downloads for a specific export or by a specific user
CREATE INDEX IF NOT EXISTS idx_report_download_audit_export ON report_download_audit(export_id);
CREATE INDEX IF NOT EXISTS idx_report_download_audit_user ON report_download_audit(user_id);
