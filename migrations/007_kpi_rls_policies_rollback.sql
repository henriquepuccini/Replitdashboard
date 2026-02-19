-- Rollback: 007_kpi_rls_policies.sql
-- Drops all RLS policies and helper functions for KPI tables

BEGIN;

-- Drop calculation_audit policies
DROP POLICY IF EXISTS calc_audit_select_admin ON public.calculation_audit;
DROP POLICY IF EXISTS calc_audit_select_ops ON public.calculation_audit;
DROP POLICY IF EXISTS calc_audit_insert_ops ON public.calculation_audit;
DROP POLICY IF EXISTS calc_audit_update_deny ON public.calculation_audit;
DROP POLICY IF EXISTS calc_audit_delete_deny ON public.calculation_audit;

-- Drop kpi_calc_runs policies
DROP POLICY IF EXISTS kpi_calc_runs_select_admin ON public.kpi_calc_runs;
DROP POLICY IF EXISTS kpi_calc_runs_select_ops ON public.kpi_calc_runs;
DROP POLICY IF EXISTS kpi_calc_runs_insert_ops ON public.kpi_calc_runs;
DROP POLICY IF EXISTS kpi_calc_runs_update_ops ON public.kpi_calc_runs;
DROP POLICY IF EXISTS kpi_calc_runs_delete_deny ON public.kpi_calc_runs;

-- Drop kpi_values policies
DROP POLICY IF EXISTS kpi_values_select_admin ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_select_exec ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_select_ops ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_select_director ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_select_seller ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_select_finance ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_insert_admin ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_update_deny ON public.kpi_values;
DROP POLICY IF EXISTS kpi_values_delete_admin ON public.kpi_values;

-- Drop kpi_goals policies
DROP POLICY IF EXISTS kpi_goals_select_admin ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_select_ops ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_select_exec ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_select_director ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_insert_admin ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_insert_director ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_update_admin ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_update_director ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_delete_admin ON public.kpi_goals;
DROP POLICY IF EXISTS kpi_goals_delete_director ON public.kpi_goals;

-- Drop kpi_definitions policies
DROP POLICY IF EXISTS kpi_definitions_select_admin ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_select_ops ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_select_exec ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_select_owner ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_insert_admin ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_update_admin ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_update_owner ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_delete_admin ON public.kpi_definitions;
DROP POLICY IF EXISTS kpi_definitions_delete_owner ON public.kpi_definitions;

-- Disable RLS on all KPI tables
ALTER TABLE public.calculation_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_calc_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_values DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definitions DISABLE ROW LEVEL SECURITY;

-- Drop helper function
DROP FUNCTION IF EXISTS public.is_kpi_owner(UUID);

COMMIT;
