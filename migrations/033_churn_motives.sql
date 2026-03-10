-- ============================================================================
-- Migration 033: Structured Churn Motives & Pedagogical Retention
-- Creates churn_motives catalog, seeds 5 preset categories, extends
-- enrollments table with status / motive FK / notes / cancelled_at / ltv_lost.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. churn_motives catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.churn_motives (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(40) NOT NULL UNIQUE,   -- machine key, e.g. 'adaptation_failure'
  label       text        NOT NULL,          -- human label in PT-BR
  description text,                          -- optional extended explanation
  is_critical boolean     NOT NULL DEFAULT false,  -- flags high-priority motives
  sort_order  integer     NOT NULL DEFAULT 99,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_churn_motives_code ON public.churn_motives (code);

-- Seed the 5 predefined categories
INSERT INTO public.churn_motives (code, label, description, is_critical, sort_order)
VALUES
  ('adaptation_failure',
   'Falha de Adaptação',
   'Aluno não se adaptou à metodologia, ambiente ou ritmo pedagógico. Métrica crítica para análise de desempenho inicial.',
   true, 1),
  ('relocation',
   'Mudança de Cidade/País',
   'O aluno ou família relocalizou-se tornando inviável a continuidade.',
   false, 2),
  ('financial_issues',
   'Dificuldades Financeiras',
   'Impossibilidade de arcar com as mensalidades ou renegociação sem sucesso.',
   false, 3),
  ('transfer',
   'Transferência para Outra Escola',
   'Aluno optou por matricular-se em outra instituição de ensino.',
   false, 4),
  ('other',
   'Outro',
   'Motivo não enquadrado nas categorias disponíveis — detalhar em churn_notes.',
   false, 5)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.churn_motives IS
  'Catálogo de motivos de cancelamento de matrícula. '
  'Registros seededos (migration 033) — administradores podem adicionar novos.';

-- ---------------------------------------------------------------------------
-- 2. Extend enrollments with status and cancellation metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS enrollment_status varchar(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS churn_motive_id   uuid         REFERENCES public.churn_motives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS churn_notes       text,
  ADD COLUMN IF NOT EXISTS cancelled_at      timestamptz,
  ADD COLUMN IF NOT EXISTS ltv_lost          numeric(18, 4) DEFAULT 0;

-- Constraint: ensure valid status values
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS chk_enrollment_status;
ALTER TABLE public.enrollments
  ADD CONSTRAINT chk_enrollment_status
    CHECK (enrollment_status IN ('active', 'inactive', 'cancelled'));

-- Constraint: churn fields only meaningful when cancelled
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS chk_churn_fields_on_cancel;
ALTER TABLE public.enrollments
  ADD CONSTRAINT chk_churn_fields_on_cancel
    CHECK (
      enrollment_status = 'cancelled'
      OR (churn_motive_id IS NULL AND cancelled_at IS NULL)
    );

-- Column comments
COMMENT ON COLUMN public.enrollments.enrollment_status IS 'active | inactive | cancelled';
COMMENT ON COLUMN public.enrollments.churn_motive_id   IS 'FK to churn_motives.id — set when status = cancelled';
COMMENT ON COLUMN public.enrollments.churn_notes       IS 'Free-form notes about the cancellation process';
COMMENT ON COLUMN public.enrollments.cancelled_at      IS 'Timestamp when the cancellation was recorded';
COMMENT ON COLUMN public.enrollments.ltv_lost          IS 'Estimated LTV lost, auto-populated from student_contracts.final_value';

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_enrollments_status
  ON public.enrollments (enrollment_status);

CREATE INDEX IF NOT EXISTS idx_enrollments_cancelled_at
  ON public.enrollments (cancelled_at DESC) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_churn_motive
  ON public.enrollments (churn_motive_id) WHERE churn_motive_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. RLS for churn_motives
-- ---------------------------------------------------------------------------

ALTER TABLE public.churn_motives ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the catalog
CREATE POLICY "churn_motives_select_authenticated"
  ON public.churn_motives FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can mutate the catalog
CREATE POLICY "churn_motives_insert_admin"
  ON public.churn_motives FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "churn_motives_update_admin"
  ON public.churn_motives FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "churn_motives_delete_admin"
  ON public.churn_motives FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
