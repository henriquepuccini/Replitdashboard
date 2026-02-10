-- Rollback: Auth User Sync Trigger
-- Description: Removes sync trigger, function, and audit table
-- Date: 2026-02-10

-- 1. Drop trigger on auth.users (if it was created)
DROP TRIGGER IF EXISTS trg_sync_auth_user ON auth.users;

-- 2. Drop sync function
DROP FUNCTION IF EXISTS public.sync_auth_user();

-- 3. Drop audit trail indexes
DROP INDEX IF EXISTS idx_auth_sync_logs_user_id;
DROP INDEX IF EXISTS idx_auth_sync_logs_created_at;

-- 4. Drop audit trail table
DROP TABLE IF EXISTS auth_user_sync_logs;
