-- Migration 039: Add annual_revenue KPI definition
-- Faturamento anual: SUM(amount_gross) × 13 (Coluna L × 13 meses)
-- Uses ON CONFLICT (key) DO NOTHING so safe to re-run.

INSERT INTO public.kpi_definitions (key, name, description, calc_type, config, is_active)
VALUES
  (
    'annual_revenue',
    'Faturamento Anual',
    'Faturamento anual projetado: SUM(payload.amount_gross) × 13. Lê Coluna L da planilha integrada.',
    'js',
    '{"js_snippet": "annual_revenue"}'::jsonb,
    true
  )
ON CONFLICT (key) DO NOTHING;

-- Also update the description of estimated_revenue and total_discounts to reflect new sources
UPDATE public.kpi_definitions
SET
  description = 'Faturamento mensal: SUM(payload.amount_gross) da planilha integrada (Coluna L).',
  name = 'Faturamento Mensal'
WHERE key = 'estimated_revenue';

UPDATE public.kpi_definitions
SET
  description = 'Total de descontos: SUM(payload.amount_net) da planilha integrada (Coluna K).'
WHERE key = 'total_discounts';

UPDATE public.kpi_definitions
SET
  description = 'Total de alunos ativos: contagem total de linhas da planilha integrada (enrollments). Cada linha = 1 aluno.'
WHERE key = 'active_students';
