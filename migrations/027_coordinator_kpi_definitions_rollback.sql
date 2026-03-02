-- Rollback for migration 027
DELETE FROM public.kpi_definitions
WHERE key IN ('dso', 'nps_score', 'avg_stage_time');
