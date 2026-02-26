-- Rollback for 023_monitoring_crons_and_webhooks

BEGIN;

-- Remove cron schedule
SELECT cron.unschedule('check-integrations-health-cron');

-- Drop trigger
DROP TRIGGER IF EXISTS trg_integration_alerts_dispatcher ON public.integration_alerts;

-- Drop trigger function
DROP FUNCTION IF EXISTS public.invoke_alert_dispatcher();

COMMIT;
