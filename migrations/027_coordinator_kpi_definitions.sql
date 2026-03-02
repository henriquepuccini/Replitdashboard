-- Migration 027: Seed kpi_definitions for Coordinator & Seller KPIs
INSERT INTO public.kpi_definitions (key, name, description, calc_type, config, is_active)
VALUES
  (
    'dso',
    'Taxa de Inadimplência (DSO)',
    'Total de contas a receber em aberto / faturamento total × dias no período. Requer contas_a_receber populado pelo conector financeiro.',
    'js',
    '{"js_snippet": "dso"}'::jsonb,
    true
  ),
  (
    'nps_score',
    'NPS (Net Promoter Score)',
    '% Promotores (score ≥ 9) - % Detratores (score ≤ 6). Baseado em nps_surveys.',
    'js',
    '{"js_snippet": "nps_score"}'::jsonb,
    true
  ),
  (
    'avg_stage_time',
    'Tempo Médio por Estágio',
    'Média de horas entre mudanças de estágio dos leads, calculada via leads_history.',
    'js',
    '{"js_snippet": "avg_stage_time"}'::jsonb,
    true
  )
ON CONFLICT (key) DO NOTHING;
