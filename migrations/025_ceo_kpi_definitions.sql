-- Migration 025: Seed kpi_definitions for CEO Dashboard KPIs
-- Uses ON CONFLICT (key) DO NOTHING so safe to re-run.

INSERT INTO public.kpi_definitions (key, name, description, calc_type, config, is_active)
VALUES
  (
    'active_students',
    'Total de Alunos Ativos',
    'Contagem de alunos ativos (status = ativo) no período, agrupável por escola.',
    'js',
    '{"js_snippet": "active_students"}'::jsonb,
    true
  ),
  (
    'total_discounts',
    'Total de Descontos Vigentes',
    'Soma dos descontos aplicados nos pagamentos do período (payments.payload->>discount_amount).',
    'js',
    '{"js_snippet": "total_discounts"}'::jsonb,
    true
  ),
  (
    'estimated_revenue',
    'Faturamento Estimado',
    'Ticket médio de alunos ativos × total de alunos ativos no período.',
    'js',
    '{"js_snippet": "estimated_revenue"}'::jsonb,
    true
  ),
  (
    'occupancy_rate',
    'Taxa de Ocupação',
    'Alunos ativos / capacidade total (manual_inputs.capacidade_turma) × 100.',
    'js',
    '{"js_snippet": "occupancy_rate"}'::jsonb,
    true
  ),
  (
    'contribution_margin',
    'Margem de Contribuição',
    '(Faturamento - Custo de Marketing) / Faturamento × 100. Custos via manual_inputs.',
    'js',
    '{"js_snippet": "contribution_margin"}'::jsonb,
    true
  ),
  (
    'ltv_cac_ratio',
    'LTV / CAC',
    'Relação entre LTV e CAC pré-computados. Requer KPIs ltv e cac calculados para o período.',
    'js',
    '{"js_snippet": "ltv_cac_ratio"}'::jsonb,
    true
  )
ON CONFLICT (key) DO NOTHING;
