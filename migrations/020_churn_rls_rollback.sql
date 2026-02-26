-- 020_churn_rls_rollback.sql

BEGIN;

-- churn_runs policies
DROP POLICY IF EXISTS churn_runs_delete_admin    ON public.churn_runs;
DROP POLICY IF EXISTS churn_runs_update_admin    ON public.churn_runs;
DROP POLICY IF EXISTS churn_runs_insert_admin    ON public.churn_runs;
DROP POLICY IF EXISTS churn_runs_select_elevated ON public.churn_runs;

-- churn_events policies
DROP POLICY IF EXISTS churn_events_delete_admin    ON public.churn_events;
DROP POLICY IF EXISTS churn_events_update_admin    ON public.churn_events;
DROP POLICY IF EXISTS churn_events_select_director ON public.churn_events;
DROP POLICY IF EXISTS churn_events_select_elevated ON public.churn_events;

-- churn_rules policies
DROP POLICY IF EXISTS churn_rules_delete_admin     ON public.churn_rules;
DROP POLICY IF EXISTS churn_rules_update_director  ON public.churn_rules;
DROP POLICY IF EXISTS churn_rules_update_admin     ON public.churn_rules;
DROP POLICY IF EXISTS churn_rules_insert_director  ON public.churn_rules;
DROP POLICY IF EXISTS churn_rules_insert_admin     ON public.churn_rules;
DROP POLICY IF EXISTS churn_rules_select_director  ON public.churn_rules;
DROP POLICY IF EXISTS churn_rules_select_elevated  ON public.churn_rules;

-- Disable RLS
ALTER TABLE public.churn_runs   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.churn_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.churn_rules  DISABLE ROW LEVEL SECURITY;

COMMIT;
