-- Migration 036: Financial Schema Refactoring

-- 1. Add new structued columns to public.payments
ALTER TABLE public.payments
  ADD COLUMN gross_value numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN scholarship_discount numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN commercial_discount numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN net_value numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN due_date date,
  ADD COLUMN installment_number integer;

-- 2. Add structural check constraint to guarantee net_value calculation
ALTER TABLE public.payments
  ADD CONSTRAINT chk_payments_net_value 
  CHECK (net_value = gross_value - scholarship_discount - commercial_discount);

-- 3. Add an index for faster date filtering on due_date
CREATE INDEX idx_payments_due_date ON public.payments(due_date);

-- 4. Backfill legacy data from payload jsonb
UPDATE public.payments
SET
  -- Read amount as net_value based on historical behavior
  net_value = COALESCE((payload->>'amount')::numeric, 0),
  -- Commercial discount was implicitly what discount_amount meant 
  commercial_discount = COALESCE((payload->>'discount_amount')::numeric, 0),
  -- No legacy way to capture scholarship_discount in payments payload
  scholarship_discount = 0,
  -- Reconstruct gross_value based on net + discounts
  gross_value = COALESCE((payload->>'amount')::numeric, 0) + COALESCE((payload->>'discount_amount')::numeric, 0),
  -- Extract due_date if available
  due_date = (payload->>'due_date')::date,
  -- Extract installment_number if available
  installment_number = (payload->>'installment_number')::integer;
