-- Rollback for migration 028
DELETE FROM public.kpi_definitions WHERE key = 'retention_rate';
