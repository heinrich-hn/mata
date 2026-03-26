-- ============================================================================
-- CREATE GEOFENCE EVENTS TABLE
-- Stores geofence entry/exit events from telematics providers
-- Created: 2026-03-26
-- ============================================================================

CREATE TABLE IF NOT EXISTS geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid REFERENCES loads(id) ON DELETE SET NULL,
  load_number text,
  vehicle_registration text,
  telematics_asset_id text,
  event_type text NOT NULL,
  geofence_name text,
  latitude double precision,
  longitude double precision,
  event_time timestamptz NOT NULL DEFAULT now(),
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle
  ON geofence_events (vehicle_registration, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_geofence_events_asset
  ON geofence_events (telematics_asset_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_geofence_events_load
  ON geofence_events (load_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_geofence_events_event_time
  ON geofence_events (event_time DESC);

-- Enable RLS
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read geofence_events"
  ON geofence_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert geofence_events"
  ON geofence_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role has full access to geofence_events"
  ON geofence_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE geofence_events;

COMMENT ON TABLE geofence_events IS 'Stores geofence entry/exit/dwell events from telematics providers';
