-- ============================================================================
-- Migration 032: Financial & Discount Granularity
-- Adds student_contracts table with base_value / scholarship_discount /
-- commercial_discount / final_value, extends contas_a_receber with installment
-- metadata, creates a reconciliation view, and backfills historical discount
-- data from payments.payload->>'discount_amount' into commercial_discount.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. student_contracts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_contracts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connector_id   uuid        NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  source_id             text        NOT NULL,
  school_id             uuid        REFERENCES public.schools(id) ON DELETE SET NULL,
  enrollment_id         uuid        REFERENCES public.enrollments(id) ON DELETE SET NULL,
  student_name          text,

  -- Period covered by this contract (e.g. academic year)
  period_start          date,
  period_end            date,

  -- Financial breakdown
  base_value            numeric(18, 4) NOT NULL DEFAULT 0,   -- Receita Bruta (mensalidade cheia)
  scholarship_discount  numeric(18, 4) NOT NULL DEFAULT 0,   -- Bolsas, convênios, PROUNI
  commercial_discount   numeric(18, 4) NOT NULL DEFAULT 0,   -- Pontualidade, irmãos, negociação
  final_value           numeric(18, 4) GENERATED ALWAYS AS
                          (base_value - scholarship_discount - commercial_discount)
                          STORED,                             -- Receita Líquida (computada)

  -- Installment plan summary
  installments          integer       NOT NULL DEFAULT 1,     -- Total parcelas no contrato

  -- Raw ERP payload
  payload               jsonb         NOT NULL DEFAULT '{}',

  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate ERP imports
CREATE UNIQUE INDEX IF NOT EXISTS uniq_student_contracts_source
  ON public.student_contracts (source_connector_id, source_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_student_contracts_school_period
  ON public.student_contracts (school_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_student_contracts_enrollment
  ON public.student_contracts (enrollment_id);

CREATE INDEX IF NOT EXISTS idx_student_contracts_source_connector
  ON public.student_contracts (source_connector_id);

-- ---------------------------------------------------------------------------
-- 2. Extend contas_a_receber with installment metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.contas_a_receber
  ADD COLUMN IF NOT EXISTS installment_number   integer,   -- Número da parcela (e.g. 3)
  ADD COLUMN IF NOT EXISTS total_installments   integer,   -- Total de parcelas (e.g. 12)
  ADD COLUMN IF NOT EXISTS original_due_date    date;      -- Vencimento original ante-renegociação

COMMENT ON COLUMN public.contas_a_receber.installment_number  IS 'Parcela número (1-based)';
COMMENT ON COLUMN public.contas_a_receber.total_installments  IS 'Total de parcelas no plano';
COMMENT ON COLUMN public.contas_a_receber.original_due_date   IS 'Data de vencimento original antes de renegociação';

-- ---------------------------------------------------------------------------
-- 3. Backfill: migrate payments.payload->>'discount_amount' into
--    student_contracts.commercial_discount for any matching payment rows.
--    Historical data without type classification defaults to commercial.
-- ---------------------------------------------------------------------------

-- Insert one synthetic contract row per distinct (source_connector_id, source_id)
-- found in payments that carries a discount_amount, so we have something to
-- reference from the reconciliation view and KPI snippets.
INSERT INTO public.student_contracts (
  source_connector_id,
  source_id,
  school_id,
  base_value,
  commercial_discount,
  payload
)
SELECT
  p.source_connector_id,
  p.source_id,
  p.school_id,
  COALESCE(NULLIF(p.payload->>'amount', '')::numeric, 0)           AS base_value,
  COALESCE(NULLIF(p.payload->>'discount_amount', '')::numeric, 0)  AS commercial_discount,
  p.payload
FROM public.payments p
WHERE (p.payload->>'discount_amount') IS NOT NULL
  AND NULLIF(p.payload->>'discount_amount', '')::numeric > 0
ON CONFLICT (source_connector_id, source_id) DO UPDATE
  SET commercial_discount = EXCLUDED.commercial_discount,
      updated_at          = now();

-- ---------------------------------------------------------------------------
-- 4. Financial Reconciliation VIEW
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vw_financial_reconciliation AS
  SELECT
    sc.id                                         AS contract_id,
    sc.school_id,
    sc.source_id                                  AS erp_contract_id,
    sc.student_name,
    sc.period_start,
    sc.period_end,
    sc.base_value                                 AS gross_value,
    sc.scholarship_discount,
    sc.commercial_discount,
    sc.final_value                                AS net_value,
    sc.installments                               AS contracted_installments,

    -- Billing schedule totals from contas_a_receber
    COUNT(car.id)                                 AS billed_installments,
    COALESCE(SUM(car.amount_due), 0)              AS total_amount_billed,
    COALESCE(SUM(car.amount_due) FILTER (WHERE car.status = 'paid'), 0)    AS total_paid,
    COALESCE(SUM(car.amount_due) FILTER (WHERE car.status = 'overdue'), 0) AS total_overdue,
    COALESCE(SUM(car.amount_due) FILTER (WHERE car.status = 'open'), 0)    AS total_open,

    -- Variance: what was billed vs what was contracted (net)
    COALESCE(SUM(car.amount_due), 0) - sc.final_value                      AS billing_variance,

    -- Discount leakage breakdown
    sc.scholarship_discount + sc.commercial_discount                        AS total_discount,
    CASE
      WHEN sc.base_value > 0
      THEN ROUND(((sc.scholarship_discount + sc.commercial_discount) / sc.base_value) * 100, 2)
      ELSE 0
    END                                                                     AS discount_pct,

    sc.created_at,
    sc.updated_at
  FROM public.student_contracts sc
  LEFT JOIN public.contas_a_receber car
    ON car.school_id = sc.school_id
    AND car.source_id = sc.source_id
  GROUP BY
    sc.id, sc.school_id, sc.source_id, sc.student_name,
    sc.period_start, sc.period_end,
    sc.base_value, sc.scholarship_discount, sc.commercial_discount,
    sc.final_value, sc.installments, sc.created_at, sc.updated_at;

COMMENT ON VIEW public.vw_financial_reconciliation IS
  'Conciliação financeira: contratos de alunos vs lançamentos em contas_a_receber. '
  'Usar para auditar discrepâncias entre o dashboard e o ERP principal.';

-- ---------------------------------------------------------------------------
-- 5. Auto-update trigger for student_contracts.updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_student_contracts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_contracts_updated_at ON public.student_contracts;
CREATE TRIGGER trg_student_contracts_updated_at
  BEFORE UPDATE ON public.student_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_student_contracts_updated_at();
