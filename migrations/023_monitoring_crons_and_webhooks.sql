-- Migration: 023_monitoring_crons_and_webhooks
-- Description: Schedule pg_cron to run check_integrations_health regularly, 
--              and setup a DB Webhook to trigger alert_dispatcher.
-- Date: 2026-02-25
-- Depends on: 021_monitoring_schemas and Edge Functions deployed

BEGIN;

-- ============================================================================
-- 1. Database Webhook for alert_dispatcher
-- ============================================================================
-- This trigger will call the alert_dispatcher Edge Function immediately 
-- when a new record is inserted into `integration_alerts`.

-- Drop existing if any
DROP TRIGGER IF EXISTS trg_integration_alerts_dispatcher ON public.integration_alerts;
DROP FUNCTION IF EXISTS public.invoke_alert_dispatcher();

CREATE OR REPLACE FUNCTION public.invoke_alert_dispatcher()
RETURNS TRIGGER AS $$
BEGIN
  -- We use the pg_net extension to make an async HTTP call to the Edge Function.
  -- This requires pg_net to be enabled.
  PERFORM net.http_post(
      url:='https://' || current_setting('request.headers')::json->>'x-forwarded-host' || '/functions/v1/alert_dispatcher',
      body:=json_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW)
      )::jsonb,
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'
      )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if the webhook call fails
  RAISE WARNING 'invoke_alert_dispatcher failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on INSERT only
CREATE TRIGGER trg_integration_alerts_dispatcher
  AFTER INSERT ON public.integration_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_alert_dispatcher();

-- ============================================================================
-- 2. Cron Job for check_integrations_health
-- ============================================================================
-- Schedule pg_cron to call the health check every 15 minutes.
-- We use net.http_post to invoke the edge function.

-- Schedule name: check-integrations-health-cron
SELECT cron.schedule(
  'check-integrations-health-cron',
  '*/15 * * * *', -- Every 15 minutes
  $$
    SELECT net.http_post(
      url:='https://' || current_setting('request.headers')::json->>'x-forwarded-host' || '/functions/v1/check_integrations_health',
      body:='{}'::jsonb,
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        -- This requires setting up an anon or service role key in vault or hardcoded safely.
        -- For a local migration, we assume the edge function handles it or we pass a generic auth header.
        'Authorization', current_setting('request.headers', true)::json->>'authorization'
      )
    );
  $$
);

COMMIT;
