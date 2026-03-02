-- Migration 028: Seed retention_rate KPI definition
INSERT INTO public.kpi_definitions (key, name, description, calc_type, config, is_active)
VALUES (
  'retention_rate',
  'Taxa de Retenção',
  '(1 - churn_rate) × 100. Derivada do motor de churn existente via network_aggregates.',
  'js',
  '{"js_snippet": "retention_rate"}'::jsonb,
  true
)
ON CONFLICT (key) DO NOTHING;
