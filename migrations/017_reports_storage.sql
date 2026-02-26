-- 017_reports_storage.sql
-- Create Supabase storage bucket for scheduled report exports, adding size, mime, and RLS constraints.

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports-exports',
  'reports-exports',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'text/csv']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS Policies
-- Allow users who initiated an export to read it via signed URLs.
-- Assuming the backend paths objects as '[scheduled_report_id]/YYYY/MM/DD/[filename]'
-- For a stricter approach, the user's ID could be included in the path or we rely exclusively on the backend
-- generating signed URLs via the Service Role.
-- Here, we enforce that Authenticated users can only SELECT (to view via signed URL) if they have access.
-- We will keep it minimal and assume the backend ensures they only get URLs they are permitted to see.
-- Thus, we just allow the service role full access and authenticated users read access.

CREATE POLICY "Service Role has full access to reports-exports"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'reports-exports')
WITH CHECK (bucket_id = 'reports-exports');

CREATE POLICY "Authenticated users can view reports-exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'reports-exports');

-- Enable RLS on storage objects if not already enabled (Supabase does this by default usually, but just in case)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Cleanup Policy
-- Function to delete files older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_report_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We delete object metadata from storage.objects.
  -- Supabase storage handles the physical S3 deletion under the hood asynchronously when the object row is deleted.
  DELETE FROM storage.objects
  WHERE bucket_id = 'reports-exports'
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Schedule the cleanup function to run daily at midnight
-- Note: Requires pg_cron extension to be active. If it's not active on the managed instance, this step will fail or be skipped.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup_reports_exports_daily', '0 0 * * *', 'SELECT cleanup_old_report_exports()');
  END IF;
END $$;
