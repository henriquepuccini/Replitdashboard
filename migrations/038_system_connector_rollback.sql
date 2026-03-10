-- ============================================================================
-- Rollback for Migration 038: System Connector Seed
-- ============================================================================

DROP INDEX IF EXISTS public.idx_connectors_name;

DELETE FROM public.connectors WHERE name = 'Sistema' AND type = 'manual_input';
