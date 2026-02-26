-- 016_reports_rollback.sql
-- Revert reports schemas

DROP TRIGGER IF EXISTS update_report_exports_updated_at ON report_exports;
DROP Trigger IF EXISTS update_scheduled_reports_updated_at ON scheduled_reports;

DROP INDEX IF EXISTS idx_report_exports_status;
DROP INDEX IF EXISTS idx_scheduled_reports_next_run;
DROP INDEX IF EXISTS idx_scheduled_reports_owner;

DROP TABLE IF EXISTS report_exports;
DROP TABLE IF EXISTS scheduled_reports;
