-- Rollback: Remove RLS Policies
-- Description: Drops all RLS policies and disables RLS on users, schools, user_schools
-- Date: 2026-02-10

-- 0. Drop minimal schools view
DROP VIEW IF EXISTS public.schools_minimal;

-- 1. Drop user_schools policies
DROP POLICY IF EXISTS user_schools_select_own ON public.user_schools;
DROP POLICY IF EXISTS user_schools_select_admin ON public.user_schools;
DROP POLICY IF EXISTS user_schools_select_director ON public.user_schools;
DROP POLICY IF EXISTS user_schools_insert_admin ON public.user_schools;
DROP POLICY IF EXISTS user_schools_update_admin ON public.user_schools;
DROP POLICY IF EXISTS user_schools_delete_admin ON public.user_schools;

-- 2. Drop users policies
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_select_admin ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_insert_service_only ON public.users;
DROP POLICY IF EXISTS users_delete_admin ON public.users;

-- 3. Drop schools policies
DROP POLICY IF EXISTS schools_select_elevated ON public.schools;
DROP POLICY IF EXISTS schools_insert_admin ON public.schools;
DROP POLICY IF EXISTS schools_update_admin ON public.schools;
DROP POLICY IF EXISTS schools_delete_admin ON public.schools;

-- 4. Disable RLS
ALTER TABLE public.user_schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;

-- 5. Drop helper functions
DROP FUNCTION IF EXISTS public.is_director_of_school(UUID);
DROP FUNCTION IF EXISTS public.has_elevated_role();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_current_user_role();
