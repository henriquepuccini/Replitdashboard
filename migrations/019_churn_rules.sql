-- 019_churn_rules.sql
-- Churn detection: configurable rules, event audit log, and run tracking.

-- 1. Churn Rules
CREATE TABLE IF NOT EXISTS churn_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_rules_school ON churn_rules(school_id);

CREATE TRIGGER set_churn_rules_updated_at
  BEFORE UPDATE ON churn_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Churn Events
CREATE TABLE IF NOT EXISTS churn_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(20) NOT NULL,            -- 'lead' | 'enrollment'
    source_id TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    churn_flag BOOLEAN NOT NULL DEFAULT true,
    churn_reason TEXT,
    detected_by VARCHAR(20) NOT NULL DEFAULT 'engine', -- 'engine' | 'manual'
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_events_school_detected ON churn_events(school_id, detected_at);

-- 3. Churn Runs
CREATE TABLE IF NOT EXISTS churn_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES churn_rules(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    processed_records INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_runs_rule ON churn_runs(rule_id);
