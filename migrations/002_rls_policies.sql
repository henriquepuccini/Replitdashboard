-- Migration: Row-Level Security Policies
-- Description: Enables RLS on users, schools, user_schools and creates
--              role-based access policies for Supabase Auth integration
-- Date: 2026-02-10
-- Requires: Supabase Auth with auth.uid() and auth.jwt() available
-- Note: service_role bypasses RLS by default in Supabase (BYPASSRLS privilege)

-- ============================================================================
-- 1. Enable RLS on all tables
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schools ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Helper function: get current user's role from public.users
--    Uses auth.uid() to look up the role in public.users table.
--    This is more reliable than JWT claims which may be stale.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. Helper function: check if current user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 4. Helper function: check if current user is director of a given school
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_director_of_school(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools
    WHERE user_id = auth.uid()
      AND school_id = p_school_id
      AND role = 'director'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 5. Helper function: check if current user has elevated role
--    (admin, director, finance, ops, exec)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_elevated_role()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'director', 'finance', 'ops', 'exec')
      AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. USERS TABLE POLICIES
-- ============================================================================

-- SELECT: user can read own row
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- SELECT: admin can read all users
CREATE POLICY users_select_admin ON public.users
  FOR SELECT
  USING (public.is_admin());

-- UPDATE: user can update own mutable fields only
-- Note: Policy allows the UPDATE, but the application layer should restrict
-- which fields are actually writable (full_name, avatar_url, preferred_language)
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
  );

-- UPDATE: admin can update any user (role, is_active, and other fields)
CREATE POLICY users_update_admin ON public.users
  FOR UPDATE
  USING (public.is_admin());

-- INSERT: only service_role can insert users directly
-- Regular users are created via Supabase Auth sync trigger
-- service_role bypasses RLS entirely, so this policy blocks anon/authenticated
CREATE POLICY users_insert_service_only ON public.users
  FOR INSERT
  WITH CHECK (false);

-- DELETE: only admin can delete users
CREATE POLICY users_delete_admin ON public.users
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 7. SCHOOLS TABLE POLICIES
-- ============================================================================

-- NOTE ON COLUMN-LEVEL RESTRICTION:
-- PostgreSQL RLS controls row access, not column access. To enforce that
-- non-elevated users only see (id, name, code), we:
-- a) Create a "schools_minimal" view with only those columns
-- b) Restrict direct table SELECT to elevated roles only
-- c) Grant all authenticated users SELECT on the view
-- The application layer also enforces this (returns minimal fields for sellers).

-- SELECT on full table: only elevated roles (admin, director, finance, ops, exec)
CREATE POLICY schools_select_elevated ON public.schools
  FOR SELECT
  USING (public.has_elevated_role());

-- INSERT: only admin can create schools
CREATE POLICY schools_insert_admin ON public.schools
  FOR INSERT
  WITH CHECK (public.is_admin());

-- UPDATE: only admin can update schools
CREATE POLICY schools_update_admin ON public.schools
  FOR UPDATE
  USING (public.is_admin());

-- DELETE: only admin can delete schools
CREATE POLICY schools_delete_admin ON public.schools
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 8. USER_SCHOOLS TABLE POLICIES
-- ============================================================================

-- SELECT: user can see their own rows
CREATE POLICY user_schools_select_own ON public.user_schools
  FOR SELECT
  USING (auth.uid() = user_id);

-- SELECT: admin can see all rows
CREATE POLICY user_schools_select_admin ON public.user_schools
  FOR SELECT
  USING (public.is_admin());

-- SELECT: director can see rows for schools they direct
CREATE POLICY user_schools_select_director ON public.user_schools
  FOR SELECT
  USING (public.is_director_of_school(school_id));

-- INSERT: only admin can assign users to schools
CREATE POLICY user_schools_insert_admin ON public.user_schools
  FOR INSERT
  WITH CHECK (public.is_admin());

-- UPDATE: only admin can update user-school mappings
CREATE POLICY user_schools_update_admin ON public.user_schools
  FOR UPDATE
  USING (public.is_admin());

-- DELETE: only admin can remove user-school mappings
CREATE POLICY user_schools_delete_admin ON public.user_schools
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 9. SERVICE ROLE NOTES
-- ============================================================================
-- In Supabase, the service_role key has BYPASSRLS privilege by default.
-- This means edge functions using the service_role key will bypass all
-- policies above. This is intentional for:
--   - Auth sync trigger (inserting users from auth.users)
--   - Bulk data imports
--   - Admin operations from edge functions
--
-- IMPORTANT: Never expose the service_role key to the client.
-- Client-side code should use the anon key which respects RLS.
--
-- For audit safety with edge functions:
--   - Log all service_role operations in an audit table
--   - Use supabase.auth.admin methods only from server-side code
--   - Consider using auth.jwt()->>'role' = 'service_role' checks in
--     custom functions if you need to distinguish service_role calls

-- ============================================================================
-- 10. JWT CUSTOM CLAIMS NOTES
-- ============================================================================
-- For optimal performance, consider adding the user's role to JWT claims
-- at sign-in time. This avoids the join to public.users on every policy check.
--
-- To add custom claims in Supabase:
-- 1. Create a function that returns claims based on user ID
-- 2. Set up a hook in Supabase Auth config to call it at token generation
--
-- Example hook function (uncomment when ready):
--
-- CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
-- RETURNS JSONB AS $$
-- DECLARE
--   user_role TEXT;
-- BEGIN
--   SELECT role INTO user_role FROM public.users WHERE id = (event->>'user_id')::UUID;
--   IF user_role IS NOT NULL THEN
--     event := jsonb_set(event, '{claims,app_role}', to_jsonb(user_role));
--   END IF;
--   RETURN event;
-- END;
-- $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 11. MINIMAL SCHOOLS VIEW
-- ============================================================================
-- This view exposes only id, name, code for non-elevated authenticated users.
-- Grant SELECT on this view to the authenticated role in Supabase.
-- Direct table access is restricted to elevated roles via schools_select_elevated.

CREATE OR REPLACE VIEW public.schools_minimal AS
  SELECT id, name, code
  FROM public.schools;

-- In Supabase, grant access:
-- GRANT SELECT ON public.schools_minimal TO authenticated;
