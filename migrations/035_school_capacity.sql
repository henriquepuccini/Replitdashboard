-- Migration: 035_school_capacity
-- Description: Creates the school_capacity table to manage legal vs. operational capacity per school/turma.
-- Date: 2026-03-10

CREATE TABLE IF NOT EXISTS public.school_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  turma varchar(80),
  legal_capacity integer,
  operational_capacity integer,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_school_capacity_school_turma_date UNIQUE (school_id, turma, effective_from)
);

-- Index for efficient lookups by school
CREATE INDEX IF NOT EXISTS idx_school_capacity_school_id ON public.school_capacity(school_id);
-- Index for effective date range queries
CREATE INDEX IF NOT EXISTS idx_school_capacity_effective_from ON public.school_capacity(effective_from);

-- Trigger function definition (safe to replace if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trg_school_capacity_updated_at
  BEFORE UPDATE ON public.school_capacity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.school_capacity ENABLE ROW LEVEL SECURITY;

-- Read policy: Any authenticated user can read capacity for any school
-- (or restrict to their own school if multi-tenant isolation is strict; 
-- currently dashboard allows cross-school reading of aggregates)
CREATE POLICY "Users can view all school capacities" 
  ON public.school_capacity FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Write policy: Only admin and director can modify capacity
CREATE POLICY "Admins and directors can insert capacity" 
  ON public.school_capacity FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update capacity" 
  ON public.school_capacity FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins can delete capacity" 
  ON public.school_capacity FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );
