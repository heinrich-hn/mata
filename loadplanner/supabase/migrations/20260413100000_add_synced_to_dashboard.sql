-- Add synced_to_dashboard flag to loads table
-- When a delivered load is successfully posted to the Dashboard webhook,
-- this is set to true so it won't be posted again.
ALTER TABLE loads ADD COLUMN IF NOT EXISTS synced_to_dashboard boolean DEFAULT false;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS synced_to_dashboard_at timestamptz;
