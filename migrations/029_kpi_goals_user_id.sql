-- Add user_id to kpi_goals to support individual seller targets
ALTER TABLE kpi_goals
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add an index to speed up lookups by user
CREATE INDEX idx_kpi_goals_user_id ON kpi_goals(user_id);
