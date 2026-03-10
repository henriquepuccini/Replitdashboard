-- Rollback Migration: 035_school_capacity

DROP TRIGGER IF EXISTS trg_school_capacity_updated_at ON public.school_capacity;
DROP TABLE IF EXISTS public.school_capacity CASCADE;
