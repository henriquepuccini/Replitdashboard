-- Rollback: 005_connectors_rls_policies.sql
-- Drops all RLS policies and helper functions for connector & sync tables

BEGIN;

-- Drop enrollment policies
DROP POLICY IF EXISTS enrollments_select_admin ON public.enrollments;
DROP POLICY IF EXISTS enrollments_select_school_scoped ON public.enrollments;
DROP POLICY IF EXISTS enrollments_select_seller ON public.enrollments;
DROP POLICY IF EXISTS enrollments_select_ops ON public.enrollments;
DROP POLICY IF EXISTS enrollments_insert_deny ON public.enrollments;
DROP POLICY IF EXISTS enrollments_update_deny ON public.enrollments;
DROP POLICY IF EXISTS enrollments_delete_deny ON public.enrollments;

-- Drop payment policies
DROP POLICY IF EXISTS payments_select_admin ON public.payments;
DROP POLICY IF EXISTS payments_select_school_scoped ON public.payments;
DROP POLICY IF EXISTS payments_select_seller ON public.payments;
DROP POLICY IF EXISTS payments_select_ops ON public.payments;
DROP POLICY IF EXISTS payments_insert_deny ON public.payments;
DROP POLICY IF EXISTS payments_update_deny ON public.payments;
DROP POLICY IF EXISTS payments_delete_deny ON public.payments;

-- Drop lead policies
DROP POLICY IF EXISTS leads_select_admin ON public.leads;
DROP POLICY IF EXISTS leads_select_school_scoped ON public.leads;
DROP POLICY IF EXISTS leads_select_seller ON public.leads;
DROP POLICY IF EXISTS leads_select_ops ON public.leads;
DROP POLICY IF EXISTS leads_insert_deny ON public.leads;
DROP POLICY IF EXISTS leads_update_deny ON public.leads;
DROP POLICY IF EXISTS leads_delete_deny ON public.leads;

-- Drop raw_ingest_files policies
DROP POLICY IF EXISTS raw_ingest_files_select_owner ON public.raw_ingest_files;
DROP POLICY IF EXISTS raw_ingest_files_select_admin ON public.raw_ingest_files;
DROP POLICY IF EXISTS raw_ingest_files_select_ops ON public.raw_ingest_files;
DROP POLICY IF EXISTS raw_ingest_files_insert_ops ON public.raw_ingest_files;
DROP POLICY IF EXISTS raw_ingest_files_update_ops ON public.raw_ingest_files;
DROP POLICY IF EXISTS raw_ingest_files_delete_deny ON public.raw_ingest_files;

-- Drop sync_runs policies
DROP POLICY IF EXISTS sync_runs_select_owner ON public.sync_runs;
DROP POLICY IF EXISTS sync_runs_select_admin ON public.sync_runs;
DROP POLICY IF EXISTS sync_runs_select_ops ON public.sync_runs;
DROP POLICY IF EXISTS sync_runs_insert_ops ON public.sync_runs;
DROP POLICY IF EXISTS sync_runs_update_ops ON public.sync_runs;
DROP POLICY IF EXISTS sync_runs_delete_deny ON public.sync_runs;

-- Drop connector_mappings policies
DROP POLICY IF EXISTS connector_mappings_select_owner ON public.connector_mappings;
DROP POLICY IF EXISTS connector_mappings_select_admin ON public.connector_mappings;
DROP POLICY IF EXISTS connector_mappings_insert_owner ON public.connector_mappings;
DROP POLICY IF EXISTS connector_mappings_insert_admin ON public.connector_mappings;
DROP POLICY IF EXISTS connector_mappings_update_owner ON public.connector_mappings;
DROP POLICY IF EXISTS connector_mappings_update_admin ON public.connector_mappings;
DROP POLICY IF EXISTS connector_mappings_delete_owner ON public.connector_mappings;
DROP POLICY IF EXISTS connector_mappings_delete_admin ON public.connector_mappings;

-- Drop connector policies
DROP POLICY IF EXISTS connectors_select_owner ON public.connectors;
DROP POLICY IF EXISTS connectors_select_admin ON public.connectors;
DROP POLICY IF EXISTS connectors_select_ops ON public.connectors;
DROP POLICY IF EXISTS connectors_insert_admin ON public.connectors;
DROP POLICY IF EXISTS connectors_update_admin ON public.connectors;
DROP POLICY IF EXISTS connectors_update_owner ON public.connectors;
DROP POLICY IF EXISTS connectors_delete_admin ON public.connectors;

-- Disable RLS on all tables
ALTER TABLE public.enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_ingest_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectors DISABLE ROW LEVEL SECURITY;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.is_user_in_school(UUID);
DROP FUNCTION IF EXISTS public.get_user_school_ids();
DROP FUNCTION IF EXISTS public.is_exec();
DROP FUNCTION IF EXISTS public.is_ops();
DROP FUNCTION IF EXISTS public.is_connector_owner(UUID);

COMMIT;
