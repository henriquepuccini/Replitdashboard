-- ============================================================================
-- Rollback 032: Financial & Discount Granularity
-- ============================================================================

-- Drop reconciliation view
DROP VIEW IF EXISTS public.vw_financial_reconciliation;

-- Drop trigger and function
DROP TRIGGER IF EXISTS trg_student_contracts_updated_at ON public.student_contracts;
DROP FUNCTION IF EXISTS public.touch_student_contracts_updated_at();

-- Remove installment metadata columns from contas_a_receber
ALTER TABLE public.contas_a_receber
  DROP COLUMN IF EXISTS installment_number,
  DROP COLUMN IF EXISTS total_installments,
  DROP COLUMN IF EXISTS original_due_date;

-- Drop student_contracts table (and its indexes cascade)
DROP TABLE IF EXISTS public.student_contracts;
