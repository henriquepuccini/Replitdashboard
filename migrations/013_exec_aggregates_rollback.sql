-- Migration: 013_exec_aggregates_rollback
-- Description: Reverses changes made by 013_exec_aggregates and 013_exec_aggregates_rls.
-- Date: 2026-02-25

-- 1. Drop the school_comparison table (which inherently drops its triggers, indexes, and policies)
DROP TABLE IF EXISTS public.school_comparison CASCADE;

-- 2. Drop the network_aggregates table (which inherently drops its triggers, indexes, and policies)
DROP TABLE IF EXISTS public.network_aggregates CASCADE;
