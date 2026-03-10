-- ============================================================================
-- Rollback 034: Lead Source Tracking & Conversion
-- ============================================================================

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS chk_lead_conversion_fields;

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS converted_enrollment_id,
  DROP COLUMN IF EXISTS converted_at,
  DROP COLUMN IF EXISTS lead_source_detail,
  DROP COLUMN IF EXISTS lead_source;
