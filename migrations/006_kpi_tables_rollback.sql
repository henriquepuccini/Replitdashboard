-- Rollback: 006_kpi_tables

DROP TABLE IF EXISTS calculation_audit CASCADE;
DROP TABLE IF EXISTS kpi_values CASCADE;
DROP TABLE IF EXISTS kpi_goals CASCADE;
DROP TABLE IF EXISTS kpi_calc_runs CASCADE;
DROP TABLE IF EXISTS kpi_definitions CASCADE;
