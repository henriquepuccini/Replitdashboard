-- ============================================================================
-- Migration 034: Lead Source Tracking & Conversion to Enrollment
-- Adds lead_source, lead_source_detail, converted_at, converted_enrollment_id
-- to public.leads to enable CRM-to-dashboard conversion pipeline.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add new columns to leads
-- ---------------------------------------------------------------------------

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_source        varchar(80),
  ADD COLUMN IF NOT EXISTS lead_source_detail text,
  ADD COLUMN IF NOT EXISTS converted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS converted_enrollment_id uuid
    REFERENCES public.enrollments(id) ON DELETE SET NULL;

-- Check constraint: converted fields only meaningful when converted
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS chk_lead_conversion_fields;
ALTER TABLE public.leads
  ADD CONSTRAINT chk_lead_conversion_fields
    CHECK (
      converted_at IS NULL OR converted_enrollment_id IS NOT NULL
    );

-- Column comments
COMMENT ON COLUMN public.leads.lead_source        IS 'Structured acquisition channel: form | whatsapp | instagram | google_ads | referral | other';
COMMENT ON COLUMN public.leads.lead_source_detail IS 'Free-form detail: UTM params, form name, campaign ID, etc.';
COMMENT ON COLUMN public.leads.converted_at        IS 'Timestamp when lead was promoted to an active enrollment';
COMMENT ON COLUMN public.leads.converted_enrollment_id IS 'FK to the enrollment created upon promotion';

-- ---------------------------------------------------------------------------
-- 2. Indexes for common query patterns
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_leads_lead_source
  ON public.leads (lead_source) WHERE lead_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_converted_at
  ON public.leads (converted_at DESC) WHERE converted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_converted_enrollment
  ON public.leads (converted_enrollment_id) WHERE converted_enrollment_id IS NOT NULL;
