-- Migration: 006_kpi_tables
-- Description: Create KPI definitions, goals, values, calc runs, and calculation audit tables

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  calc_type VARCHAR(20) NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_calc_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  inputs JSONB,
  version TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value NUMERIC(18, 4) NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calc_run_id UUID REFERENCES kpi_calc_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target NUMERIC(18, 4) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calculation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calc_run_id UUID NOT NULL REFERENCES kpi_calc_runs(id) ON DELETE CASCADE,
  input_snapshot JSONB,
  result_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_key ON kpi_definitions(key);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_calc_type ON kpi_definitions(calc_type);

CREATE INDEX IF NOT EXISTS idx_kpi_calc_runs_kpi_id ON kpi_calc_runs(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_calc_runs_status ON kpi_calc_runs(status);

CREATE INDEX IF NOT EXISTS idx_kpi_values_kpi_school_period ON kpi_values(kpi_id, school_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_values_calc_run_id ON kpi_values(calc_run_id);

CREATE INDEX IF NOT EXISTS idx_kpi_goals_school_kpi_period ON kpi_goals(school_id, kpi_id, period_start);
CREATE INDEX IF NOT EXISTS idx_kpi_goals_kpi_id ON kpi_goals(kpi_id);

CREATE INDEX IF NOT EXISTS idx_calculation_audit_calc_run_id ON calculation_audit(calc_run_id);
