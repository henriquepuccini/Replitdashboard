-- Migration 024: manual_inputs table
-- Stores manually entered metric values (e.g. marketing costs, class capacities)
-- that are used by the KPI compute engine for hybrid KPIs like CAC and occupancy rate.

CREATE TABLE IF NOT EXISTS public.manual_inputs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid        REFERENCES public.schools(id) ON DELETE SET NULL,
  data_referencia date        NOT NULL,
  chave_metrica   text        NOT NULL,
  valor           numeric(18, 4) NOT NULL,
  notas           text,
  created_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one value per metric / school / date
CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_inputs_key_school_date
  ON public.manual_inputs (chave_metrica, COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid), data_referencia);

CREATE INDEX IF NOT EXISTS idx_manual_inputs_school_date
  ON public.manual_inputs (school_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_manual_inputs_chave
  ON public.manual_inputs (chave_metrica);

CREATE INDEX IF NOT EXISTS idx_manual_inputs_created_by
  ON public.manual_inputs (created_by);
