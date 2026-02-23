-- Migration 010: RLS policies for leads and leads_history tables
-- Restricts lead visibility by role: sellers see their own leads,
-- directors/finance/ops see their school's leads, admin/exec see all.
-- Date: 2026-02-23
--
-- NOTE: RLS policies use auth.uid() and are designed for Supabase deployment.
-- In the Express session layer, equivalent RBAC is enforced via server/rbac.ts.
-- The audit trigger uses current_setting('app.current_user_id') set by the
-- application before each query transaction.

-- ============================================================================
-- 1. Ensure prerequisite helper functions exist (from migration 002)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 2. Helper functions for leads-specific access checks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_school_access(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools us
    JOIN public.users u ON u.id = us.user_id
    WHERE us.user_id = auth.uid()
      AND us.school_id = p_school_id
      AND us.role IN ('director', 'finance', 'ops')
      AND u.is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_exec()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'exec')
      AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'ops')
      AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. Enable RLS on leads
-- ============================================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. leads SELECT policies
-- ============================================================================

-- Sellers can see leads assigned to them (must be active seller)
CREATE POLICY leads_select_seller ON public.leads
  FOR SELECT
  USING (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'seller' AND is_active = true
    )
  );

-- Directors, finance, and ops can see leads belonging to their schools
-- has_school_access() includes is_active check via join to users
CREATE POLICY leads_select_school_member ON public.leads
  FOR SELECT
  USING (
    public.has_school_access(school_id)
  );

-- Admin and exec can see all leads
CREATE POLICY leads_select_admin_exec ON public.leads
  FOR SELECT
  USING (
    public.is_admin_or_exec()
  );

-- ============================================================================
-- 5. leads UPDATE policies
-- ============================================================================

-- Sellers can update leads assigned to them (must be active seller)
CREATE POLICY leads_update_seller ON public.leads
  FOR UPDATE
  USING (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'seller' AND is_active = true
    )
  )
  WITH CHECK (
    seller_id = auth.uid()
  );

-- Admin and ops can update any lead
CREATE POLICY leads_update_admin_ops ON public.leads
  FOR UPDATE
  USING (
    public.is_admin_or_ops()
  );

-- ============================================================================
-- 6. leads INSERT policies
-- ============================================================================

-- Service role bypasses RLS by default in Supabase (for connector edge functions).
-- Admin can insert leads via UI.
CREATE POLICY leads_insert_admin ON public.leads
  FOR INSERT
  WITH CHECK (
    public.is_admin()
  );

-- ============================================================================
-- 7. leads DELETE policies
-- ============================================================================

-- Only admin can delete leads (prefer soft delete via status='deleted')
CREATE POLICY leads_delete_admin ON public.leads
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ============================================================================
-- 8. leads_history audit table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leads_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  change_type VARCHAR(10) NOT NULL CHECK (change_type IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_history_lead_id ON public.leads_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_history_changed_by ON public.leads_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_leads_history_created_at ON public.leads_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_history_change_type ON public.leads_history(change_type);

-- ============================================================================
-- 9. Enable RLS on leads_history
-- ============================================================================

ALTER TABLE public.leads_history ENABLE ROW LEVEL SECURITY;

-- History follows same visibility as leads: seller must be active with seller role
CREATE POLICY leads_history_select_seller ON public.leads_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      JOIN public.users u ON u.id = auth.uid()
      WHERE leads.id = leads_history.lead_id
        AND leads.seller_id = auth.uid()
        AND u.role = 'seller'
        AND u.is_active = true
    )
  );

CREATE POLICY leads_history_select_school_member ON public.leads_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = leads_history.lead_id
        AND public.has_school_access(leads.school_id)
    )
  );

CREATE POLICY leads_history_select_admin_exec ON public.leads_history
  FOR SELECT
  USING (
    public.is_admin_or_exec()
  );

-- Trigger function runs as SECURITY DEFINER and bypasses RLS.
-- Block direct inserts from regular authenticated users.
-- Service role (edge functions, triggers) bypasses RLS entirely in Supabase.
CREATE POLICY leads_history_insert_deny_direct ON public.leads_history
  FOR INSERT
  WITH CHECK (false);

-- No updates or deletes on history (immutable audit log)
CREATE POLICY leads_history_update_deny ON public.leads_history
  FOR UPDATE
  USING (false);

CREATE POLICY leads_history_delete_deny ON public.leads_history
  FOR DELETE
  USING (false);

-- ============================================================================
-- 10. Audit trigger for leads_history
-- ============================================================================
-- The trigger function uses SECURITY DEFINER which bypasses RLS,
-- allowing it to insert into leads_history even when RLS blocks
-- direct inserts. This ensures audit records are always created.
-- changed_by is populated from app.current_user_id session variable
-- set by the Express middleware before each transaction.

CREATE OR REPLACE FUNCTION public.leads_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields TEXT[] := '{}';
  v_key TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW))
    LOOP
      IF to_jsonb(NEW) -> v_key IS DISTINCT FROM to_jsonb(OLD) -> v_key THEN
        v_changed_fields := array_append(v_changed_fields, v_key);
      END IF;
    END LOOP;

    INSERT INTO public.leads_history (lead_id, changed_by, change_type, old_data, new_data, changed_fields)
    VALUES (NEW.id, NULLIF(current_setting('app.current_user_id', true), '')::UUID, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_changed_fields);

    NEW.updated_at := now();
    RETURN NEW;

  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.leads_history (lead_id, changed_by, change_type, new_data)
    VALUES (NEW.id, NULLIF(current_setting('app.current_user_id', true), '')::UUID, 'INSERT', to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.leads_history (lead_id, changed_by, change_type, old_data)
    VALUES (OLD.id, NULLIF(current_setting('app.current_user_id', true), '')::UUID, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leads_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_audit_trigger();

-- ============================================================================
-- 11. Supporting indexes for RLS policy join performance
-- ============================================================================

-- user_schools lookups for has_school_access(): covers (user_id, school_id, role) join
CREATE INDEX IF NOT EXISTS idx_user_schools_user_school_role
  ON public.user_schools(user_id, school_id, role);

-- users role+active lookups for seller/admin/exec checks in policies
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON public.users(id, role) WHERE is_active = true;
