-- Rollback for migration 025: Remove CEO KPI definitions
DELETE FROM public.kpi_definitions
WHERE key IN (
  'active_students',
  'total_discounts',
  'estimated_revenue',
  'occupancy_rate',
  'contribution_margin',
  'ltv_cac_ratio'
);
