-- Migration: Auth User Sync Trigger
-- Description: Creates audit trail table, sync function, and trigger to mirror
--              auth.users into public.users on INSERT/UPDATE/DELETE.
--              Provides both direct DB trigger (if auth schema is accessible)
--              and documents the edge function webhook approach as alternative.
-- Date: 2026-02-10

-- ============================================================================
-- 1. AUDIT TRAIL TABLE
-- ============================================================================
-- Logs every sync operation for debugging, compliance, and retry capabilities.

CREATE TABLE IF NOT EXISTS auth_user_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sync_logs_user_id ON auth_user_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sync_logs_created_at ON auth_user_sync_logs(created_at);

-- ============================================================================
-- 2. SYNC FUNCTION: sync_auth_user()
-- ============================================================================
-- Runs AFTER INSERT OR UPDATE OR DELETE on auth.users.
-- - INSERT: creates a new public.users row with id, email, metadata fields
-- - UPDATE: upserts mutable fields (email, full_name, avatar_url) + updated_at
-- - DELETE: soft-deletes by setting is_active = false + updated_at
--
-- SECURITY DEFINER: runs with the privileges of the function owner (postgres),
-- allowing it to write to public.users regardless of RLS policies.
--
-- Race condition handling:
-- - Uses ON CONFLICT (id) DO UPDATE for INSERT to handle concurrent creates
-- - UPDATE uses WHERE id = to target specific row (atomic)
-- - DELETE (soft) uses WHERE id = (atomic row-level operation)
-- - All operations are within the same transaction as the auth.users change

CREATE OR REPLACE FUNCTION public.sync_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Mirror new auth user into public.users
    INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
      updated_at = NOW();

    -- Log the sync operation (payload stored as JSON text)
    INSERT INTO public.auth_user_sync_logs (user_id, operation, payload)
    VALUES (
      NEW.id,
      'INSERT',
      jsonb_build_object(
        'email', NEW.email,
        'full_name', NEW.raw_user_meta_data->>'full_name',
        'avatar_url', NEW.raw_user_meta_data->>'avatar_url'
      )::text
    );

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Upsert mutable fields from auth.users into public.users
    INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
      updated_at = NOW();

    -- Log the sync operation (payload stored as JSON text)
    INSERT INTO public.auth_user_sync_logs (user_id, operation, payload)
    VALUES (
      NEW.id,
      'UPDATE',
      jsonb_build_object(
        'email', NEW.email,
        'full_name', NEW.raw_user_meta_data->>'full_name',
        'avatar_url', NEW.raw_user_meta_data->>'avatar_url',
        'old_email', OLD.email
      )::text
    );

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Soft delete: mark user as inactive instead of deleting
    UPDATE public.users
    SET is_active = false, updated_at = NOW()
    WHERE id = OLD.id;

    -- Log the sync operation (payload stored as JSON text)
    INSERT INTO public.auth_user_sync_logs (user_id, operation, payload)
    VALUES (
      OLD.id,
      'DELETE',
      jsonb_build_object(
        'email', OLD.email,
        'soft_deleted', true
      )::text
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. TRIGGER ON auth.users
-- ============================================================================
-- NOTE: Supabase may restrict direct trigger creation on auth.users.
-- If direct access is available, uncomment and run this:
--
-- DROP TRIGGER IF EXISTS trg_sync_auth_user ON auth.users;
-- CREATE TRIGGER trg_sync_auth_user
--   AFTER INSERT OR UPDATE OR DELETE ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user();
--
-- If Supabase restricts this, use the edge function webhook approach:
-- See section 4 below and the Express webhook endpoint at POST /api/auth/sync.

-- ============================================================================
-- 4. EDGE FUNCTION WEBHOOK APPROACH (PREFERRED FOR SUPABASE)
-- ============================================================================
-- Supabase Auth provides webhooks that fire on user events.
-- Configure a Supabase Edge Function or use the Express endpoint:
--
-- Supabase Dashboard → Authentication → Hooks:
--   - Event: user.created   → POST https://<your-domain>/api/auth/sync
--   - Event: user.updated   → POST https://<your-domain>/api/auth/sync
--   - Event: user.deleted   → POST https://<your-domain>/api/auth/sync
--
-- The webhook payload from Supabase Auth looks like:
-- {
--   "type": "INSERT" | "UPDATE" | "DELETE",
--   "table": "users",
--   "schema": "auth",
--   "record": { "id": "uuid", "email": "...", "raw_user_meta_data": {...} },
--   "old_record": { ... }  // only on UPDATE/DELETE
-- }
--
-- The Express endpoint at POST /api/auth/sync handles this payload,
-- performs the same operations as sync_auth_user(), and writes to
-- auth_user_sync_logs for audit trail.
--
-- SECURITY: The webhook endpoint validates the request using either:
-- a) Supabase webhook secret (X-Supabase-Webhook-Secret header)
-- b) Service role key (Authorization: Bearer <service_role_key>)
-- Keep these secrets server-side only.

-- ============================================================================
-- 5. RETENTION POLICY NOTE
-- ============================================================================
-- auth_user_sync_logs will grow over time. Consider:
-- - Adding a pg_cron job to purge logs older than 90 days
-- - Or archiving to an external store (S3, etc.)
-- Example (requires pg_cron extension):
--
-- SELECT cron.schedule('purge_sync_logs', '0 3 * * 0',
--   $$DELETE FROM public.auth_user_sync_logs WHERE created_at < NOW() - INTERVAL '90 days'$$
-- );
