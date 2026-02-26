-- Migration: 015_filter_helpers_rollback
-- Description: Drops all filter helper functions created in 015_filter_helpers.sql.
-- Date: 2026-02-25

DROP FUNCTION IF EXISTS public.filter_network_aggregates(DATE, DATE);
DROP FUNCTION IF EXISTS public.filter_school_comparison(VARCHAR, UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.filter_school_aggregates(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.filter_kpi_goals(UUID, UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.filter_kpi_values(UUID, UUID, DATE, DATE);
