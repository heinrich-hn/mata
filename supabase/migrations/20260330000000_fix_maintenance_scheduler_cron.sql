-- Fix the maintenance-scheduler cron job to point to the correct project and function
-- The previous cron was calling 'rapid-handler' on the wrong project ref (tbermxophoxqbootntyu)
-- It should call 'maintenance-scheduler' on the correct project (wxvhkljrbcpcgpgdqhsp)

-- Remove the old incorrect cron job (if it exists)
SELECT cron.unschedule('maintenance-scheduler-hourly');

-- Re-create with the correct function URL and anon key
SELECT cron.schedule(
  'maintenance-scheduler-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
        url:='https://wxvhkljrbcpcgpgdqhsp.supabase.co/functions/v1/maintenance-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4dmhrbGpyYmNwY2dwZ2RxaHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MjYzMTEsImV4cCI6MjA3NDIwMjMxMX0.8VTE9TMQYAu2kMLpHX8EzBlCspBWddNW-FYOnDZSkHU"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
