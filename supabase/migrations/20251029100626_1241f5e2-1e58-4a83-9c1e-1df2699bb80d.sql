-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the maintenance-scheduler edge function to run every hour
-- This will check for overdue maintenance, generate alerts, and auto-create job cards
SELECT cron.schedule(
  'maintenance-scheduler-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
        url:='https://tbermxophoxqbootntyu.supabase.co/functions/v1/rapid-handler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXJteG9waG94cWJvb3RudHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MDY0NDIsImV4cCI6MjA3NDE4MjQ0Mn0.7MogOK9syXjAKnbh2bM0-ArK-R9XZyYB6h6rVJddkfU"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next_due_date 
  ON maintenance_schedules(next_due_date) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_vehicle_active 
  ON maintenance_schedules(vehicle_id, is_active);

CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_delivery_status 
  ON maintenance_alerts(delivery_status, alert_time) WHERE delivery_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_history_schedule 
  ON maintenance_schedule_history(schedule_id, completed_date DESC);

-- Create a view for easy maintenance dashboard queries
CREATE OR REPLACE VIEW maintenance_dashboard_stats AS
SELECT
  COUNT(*) FILTER (WHERE is_active = true) as total_active_schedules,
  COUNT(*) FILTER (WHERE next_due_date = CURRENT_DATE AND is_active = true) as due_today,
  COUNT(*) FILTER (WHERE next_due_date < CURRENT_DATE AND is_active = true) as overdue,
  COUNT(DISTINCT msh.id) FILTER (
    WHERE msh.completed_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND msh.status = 'completed'
  ) as completed_this_month,
  COALESCE(SUM(msh.total_cost) FILTER (
    WHERE msh.completed_date >= DATE_TRUNC('month', CURRENT_DATE)
  ), 0) as total_cost_this_month
FROM maintenance_schedules ms
LEFT JOIN maintenance_schedule_history msh ON ms.id = msh.schedule_id;

-- Grant permissions on the view
GRANT SELECT ON maintenance_dashboard_stats TO authenticated;

COMMENT ON VIEW maintenance_dashboard_stats IS 'Real-time statistics for the maintenance dashboard';