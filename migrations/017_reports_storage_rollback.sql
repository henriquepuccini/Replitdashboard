-- 017_reports_storage_rollback.sql
-- Revert reports storage bucket and policies

-- Unschedule cron job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_reports_exports_daily');
  END IF;
END $$;

-- Drop cleanup function
DROP FUNCTION IF EXISTS cleanup_old_report_exports();

-- Drop RLS policies
DROP POLICY IF EXISTS "Authenticated users can view reports-exports" ON storage.objects;
DROP POLICY IF EXISTS "Service Role has full access to reports-exports" ON storage.objects;

-- Delete all objects in the bucket (required before deleting bucket)
DELETE FROM storage.objects WHERE bucket_id = 'reports-exports';

-- Drop the bucket
DELETE FROM storage.buckets WHERE id = 'reports-exports';
