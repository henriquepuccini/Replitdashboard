-- Rollback migration for 029_kpi_goals_user_id
DROP INDEX IF EXISTS idx_kpi_goals_user_id;

ALTER TABLE kpi_goals
DROP COLUMN user_id;
