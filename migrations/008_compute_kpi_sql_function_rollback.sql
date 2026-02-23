-- Rollback: 008_compute_kpi_sql_function
-- Drops compute_kpi_sql function and advisory lock helpers

BEGIN;

DROP FUNCTION IF EXISTS public.compute_kpi_sql(UUID, DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.try_kpi_lock(UUID, DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.kpi_lock_key(UUID, DATE, DATE, UUID);

COMMIT;
