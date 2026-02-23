-- Rollback migration 010: RLS policies for leads and leads_history

-- Drop trigger
DROP TRIGGER IF EXISTS leads_audit ON public.leads;
DROP FUNCTION IF EXISTS public.leads_audit_trigger();

-- Drop supporting indexes
DROP INDEX IF EXISTS idx_users_role_active;
DROP INDEX IF EXISTS idx_user_schools_user_school_role;

-- Drop leads_history RLS policies
DROP POLICY IF EXISTS leads_history_delete_deny ON public.leads_history;
DROP POLICY IF EXISTS leads_history_update_deny ON public.leads_history;
DROP POLICY IF EXISTS leads_history_insert_deny_direct ON public.leads_history;
DROP POLICY IF EXISTS leads_history_select_admin_exec ON public.leads_history;
DROP POLICY IF EXISTS leads_history_select_school_member ON public.leads_history;
DROP POLICY IF EXISTS leads_history_select_seller ON public.leads_history;

-- Disable RLS on leads_history and drop table
ALTER TABLE public.leads_history DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS public.leads_history;

-- Drop leads RLS policies
DROP POLICY IF EXISTS leads_delete_admin ON public.leads;
DROP POLICY IF EXISTS leads_insert_admin ON public.leads;
DROP POLICY IF EXISTS leads_update_admin_ops ON public.leads;
DROP POLICY IF EXISTS leads_update_seller ON public.leads;
DROP POLICY IF EXISTS leads_select_admin_exec ON public.leads;
DROP POLICY IF EXISTS leads_select_school_member ON public.leads;
DROP POLICY IF EXISTS leads_select_seller ON public.leads;

-- Disable RLS on leads
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.is_admin_or_ops();
DROP FUNCTION IF EXISTS public.is_admin_or_exec();
DROP FUNCTION IF EXISTS public.has_school_access(UUID);
