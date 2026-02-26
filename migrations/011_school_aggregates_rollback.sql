-- Rollback: 011_school_aggregates
-- Description: Reverses migration 011_school_aggregates.sql and
--              011_school_aggregates_rls.sql in a single transaction.
-- Date: 2026-02-25

BEGIN;

-- 1. Drop RLS policies first (must precede disabling RLS or dropping table)
DROP POLICY IF EXISTS school_aggregates_select_admin    ON public.school_aggregates;
DROP POLICY IF EXISTS school_aggregates_select_ops      ON public.school_aggregates;
DROP POLICY IF EXISTS school_aggregates_select_exec     ON public.school_aggregates;
DROP POLICY IF EXISTS school_aggregates_select_director ON public.school_aggregates;
DROP POLICY IF EXISTS school_aggregates_insert_admin    ON public.school_aggregates;
DROP POLICY IF EXISTS school_aggregates_update_admin    ON public.school_aggregates;
DROP POLICY IF EXISTS school_aggregates_delete_admin    ON public.school_aggregates;

-- 2. Disable RLS (defensive — table is about to be dropped anyway)
ALTER TABLE IF EXISTS public.school_aggregates DISABLE ROW LEVEL SECURITY;

-- 3. Drop trigger (dropped automatically when table is dropped, but explicit for clarity)
DROP TRIGGER IF EXISTS trg_school_aggregates_updated_at ON public.school_aggregates;

-- 4. Drop the table (indexes and unique constraint are dropped automatically)
DROP TABLE IF EXISTS public.school_aggregates;

COMMIT;
