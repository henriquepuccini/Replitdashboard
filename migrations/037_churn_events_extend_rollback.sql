-- Rollback Migration 037: Remove churn_events extensions

DROP INDEX IF EXISTS idx_churn_events_churn_date;
DROP INDEX IF EXISTS idx_churn_events_motive_id;

ALTER TABLE public.churn_events
  DROP COLUMN IF EXISTS churn_date,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS motive_id;
