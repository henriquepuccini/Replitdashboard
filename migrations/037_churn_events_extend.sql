-- ============================================================================
-- Migration 037: Extend churn_events with motive, notes, churn_date
-- ============================================================================

-- 1. Add motive_id FK — RESTRICT prevents deleting a motive that has events
ALTER TABLE public.churn_events
  ADD COLUMN IF NOT EXISTS motive_id uuid
    REFERENCES public.churn_motives(id) ON DELETE RESTRICT;

-- 2. Add notes for coordination annotations
ALTER TABLE public.churn_events
  ADD COLUMN IF NOT EXISTS notes text;

-- 3. Add churn_date: exact date of loss (may differ from detected_at)
ALTER TABLE public.churn_events
  ADD COLUMN IF NOT EXISTS churn_date date;

-- 4. Index to speed up motive-based queries
CREATE INDEX IF NOT EXISTS idx_churn_events_motive_id
  ON public.churn_events(motive_id)
  WHERE motive_id IS NOT NULL;

-- 5. Index for churn_date-based range queries
CREATE INDEX IF NOT EXISTS idx_churn_events_churn_date
  ON public.churn_events(school_id, churn_date DESC)
  WHERE churn_date IS NOT NULL;

-- Column comments
COMMENT ON COLUMN public.churn_events.motive_id   IS 'FK to churn_motives.id — RESTRICT prevents deletion of motives with linked events';
COMMENT ON COLUMN public.churn_events.notes       IS 'Free-form notes from coordination about this specific churn event';
COMMENT ON COLUMN public.churn_events.churn_date  IS 'Exact date the student was lost — may differ from detected_at (engine detection)';
