-- Migration 026: contas_a_receber + nps_surveys
-- contas_a_receber: sync target for outstanding invoices from financial connector
-- nps_surveys: NPS responses linked to enrollments

-- ── contas_a_receber ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contas_a_receber (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_connector_id  uuid        NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  source_id            text        NOT NULL,
  school_id            uuid        REFERENCES public.schools(id) ON DELETE SET NULL,
  amount_due           numeric(18, 4) NOT NULL DEFAULT 0,
  due_date             date,
  status               text        NOT NULL DEFAULT 'open', -- open | paid | overdue
  paid_at              timestamptz,
  payload              jsonb       NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_car_status CHECK (status IN ('open', 'paid', 'overdue'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_car_source
  ON public.contas_a_receber (source_connector_id, source_id);
CREATE INDEX IF NOT EXISTS idx_car_school_status
  ON public.contas_a_receber (school_id, status);
CREATE INDEX IF NOT EXISTS idx_car_due_date
  ON public.contas_a_receber (due_date);

-- ── nps_surveys ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nps_surveys (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id  uuid        REFERENCES public.enrollments(id) ON DELETE SET NULL,
  school_id      uuid        REFERENCES public.schools(id) ON DELETE SET NULL,
  score          smallint    NOT NULL,
  category       text        NOT NULL GENERATED ALWAYS AS (
    CASE
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'passive'
      ELSE 'detractor'
    END
  ) STORED,
  comment        text,
  survey_date    date        NOT NULL DEFAULT CURRENT_DATE,
  created_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_nps_score CHECK (score BETWEEN 0 AND 10)
);

CREATE INDEX IF NOT EXISTS idx_nps_school_date
  ON public.nps_surveys (school_id, survey_date DESC);
CREATE INDEX IF NOT EXISTS idx_nps_enrollment
  ON public.nps_surveys (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_nps_category
  ON public.nps_surveys (category);
