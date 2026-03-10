-- ============================================================================
-- Rollback 033: Structured Churn Motives & Pedagogical Retention
-- ============================================================================

-- Drop RLS policies
DROP POLICY IF EXISTS "churn_motives_delete_admin"  ON public.churn_motives;
DROP POLICY IF EXISTS "churn_motives_update_admin"  ON public.churn_motives;
DROP POLICY IF EXISTS "churn_motives_insert_admin"  ON public.churn_motives;
DROP POLICY IF EXISTS "churn_motives_select_authenticated" ON public.churn_motives;

-- Remove churn constraint before dropping FK column
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS chk_churn_fields_on_cancel,
  DROP CONSTRAINT IF EXISTS chk_enrollment_status,
  DROP COLUMN IF EXISTS ltv_lost,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS churn_notes,
  DROP COLUMN IF EXISTS churn_motive_id,
  DROP COLUMN IF EXISTS enrollment_status;

-- Drop catalog table
DROP TABLE IF EXISTS public.churn_motives;
