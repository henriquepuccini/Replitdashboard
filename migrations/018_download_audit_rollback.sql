-- 018_download_audit_rollback.sql
-- Revert download audit log table

DROP INDEX IF EXISTS idx_report_download_audit_user;
DROP INDEX IF EXISTS idx_report_download_audit_export;
DROP TABLE IF EXISTS report_download_audit;
