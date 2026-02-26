-- Migration: 014_exec_rls_policies_rollback
-- Description: Reverses the RLS policy changes made in 013_exec_aggregates_rls.sql.
--              Drops all policies and disables RLS on network_aggregates and school_comparison.
-- Date: 2026-02-25

-- Drop all SELECT policies from school_comparison
DROP POLICY IF EXISTS school_comparison_select_elevated ON public.school_comparison;
DROP POLICY IF EXISTS school_comparison_select_director ON public.school_comparison;

-- Drop the SELECT policy from network_aggregates
DROP POLICY IF EXISTS network_aggregates_select ON public.network_aggregates;

-- Disable RLS on both tables
ALTER TABLE public.school_comparison DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_aggregates DISABLE ROW LEVEL SECURITY;
