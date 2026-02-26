-- 019_churn_rules_rollback.sql

DROP INDEX IF EXISTS idx_churn_runs_rule;
DROP TABLE IF EXISTS churn_runs;

DROP INDEX IF EXISTS idx_churn_events_school_detected;
DROP TABLE IF EXISTS churn_events;

DROP TRIGGER IF EXISTS set_churn_rules_updated_at ON churn_rules;
DROP INDEX IF EXISTS idx_churn_rules_school;
DROP TABLE IF EXISTS churn_rules;
