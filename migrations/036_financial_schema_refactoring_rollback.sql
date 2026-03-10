-- Rollback Migration 036: Financial Schema Refactoring

-- 1. Drop the check constraint
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS chk_payments_net_value;

-- 2. Drop the index
DROP INDEX IF EXISTS idx_payments_due_date;

-- 3. Drop the structued columns
ALTER TABLE public.payments
  DROP COLUMN IF EXISTS gross_value,
  DROP COLUMN IF EXISTS scholarship_discount,
  DROP COLUMN IF EXISTS commercial_discount,
  DROP COLUMN IF EXISTS net_value,
  DROP COLUMN IF EXISTS due_date,
  DROP COLUMN IF EXISTS installment_number;
