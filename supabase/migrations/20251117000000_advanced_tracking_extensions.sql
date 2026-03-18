-- Advanced Tracking Extensions Migration
-- This adds missing columns needed for the advanced tracking features
-- Run this AFTER the existing phase2_live_tracking migration

-- =====================================================
-- 1. Extend delivery_tracking table with vehicle telemetry
-- =====================================================
ALTER TABLE public.delivery_tracking
  ADD COLUMN IF NOT EXISTS fuel_level NUMERIC,
  ADD COLUMN IF NOT EXISTS temperature NUMERIC,
  ADD COLUMN IF NOT EXISTS odometer NUMERIC,
  ADD COLUMN IF NOT EXISTS engine_hours NUMERIC;

COMMENT ON COLUMN public.delivery_tracking.fuel_level IS 'Fuel level percentage (0-100) from Wialon';
COMMENT ON COLUMN public.delivery_tracking.temperature IS 'Vehicle temperature in Celsius from sensors';
COMMENT ON COLUMN public.delivery_tracking.odometer IS 'Total vehicle odometer reading in kilometers';
COMMENT ON COLUMN public.delivery_tracking.engine_hours IS 'Total engine running hours';

-- =====================================================
-- 2. Extend delivery_eta table for predictive analytics
-- =====================================================
-- Note: delivery_eta table already exists with confidence_level and separate delay columns
-- We add JSONB factors column for the advanced tracking service
ALTER TABLE public.delivery_eta
  ADD COLUMN IF NOT EXISTS factors JSONB,
  ADD COLUMN IF NOT EXISTS optimistic_eta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pessimistic_eta TIMESTAMPTZ;

COMMENT ON COLUMN public.delivery_eta.factors IS 'Detailed breakdown of ETA calculation factors (historicalSpeed, traffic, weather, driverBehavior, routeComplexity)';
COMMENT ON COLUMN public.delivery_eta.optimistic_eta IS 'Best case scenario arrival time';
COMMENT ON COLUMN public.delivery_eta.pessimistic_eta IS 'Worst case scenario arrival time';

-- =====================================================
-- 3. Ensure proper indexes exist
-- =====================================================
-- Check and create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_load_vehicle
  ON public.delivery_tracking(load_id, vehicle_id);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_recorded_at
  ON public.delivery_tracking(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_eta_load_id
  ON public.delivery_eta(load_id);

CREATE INDEX IF NOT EXISTS idx_geofence_events_load_id
  ON public.geofence_events(load_id);

CREATE INDEX IF NOT EXISTS idx_geofence_events_event_timestamp
  ON public.geofence_events(event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle_load
  ON public.geofence_events(vehicle_id, load_id);

CREATE INDEX IF NOT EXISTS idx_route_waypoints_load_id
  ON public.route_waypoints(load_id);

CREATE INDEX IF NOT EXISTS idx_route_waypoints_trip_sequence
  ON public.route_waypoints(trip_id, sequence);

-- =====================================================
-- 4. Add helpful view for geofence events with zone details
-- =====================================================
CREATE OR REPLACE VIEW public.geofence_events_with_details AS
SELECT
  ge.id,
  ge.geofence_zone_id,
  gz.name as geofence_name,
  gz.zone_type,
  ge.vehicle_id,
  v.registration_number as vehicle_registration,
  CONCAT(v.make, ' ', v.model) as vehicle_name,
  v.make as vehicle_make,
  v.model as vehicle_model,
  ge.load_id,
  l.load_number,
  l.status as load_status,
  ge.event_type,
  ge.latitude,
  ge.longitude,
  ge.event_timestamp,
  ge.dwell_duration_minutes,
  ge.notification_sent,
  ge.created_at
FROM public.geofence_events ge
LEFT JOIN public.geofence_zones gz ON ge.geofence_zone_id = gz.id
LEFT JOIN public.vehicles v ON ge.vehicle_id = v.id
LEFT JOIN public.loads l ON ge.load_id = l.id;

COMMENT ON VIEW public.geofence_events_with_details IS 'Enriched view of geofence events with zone, vehicle, and load details. vehicle_name is computed from make and model.';

-- =====================================================
-- 5. Grant permissions
-- =====================================================
-- Allow authenticated users to read/write tracking data
GRANT SELECT, INSERT, UPDATE ON public.delivery_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_eta TO authenticated;
GRANT SELECT ON public.geofence_events_with_details TO authenticated;

-- =====================================================
-- 6. Add RLS policies if not already exist
-- =====================================================
-- Note: Adjust these based on your existing RLS policy patterns

-- Allow authenticated users to read all delivery tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_tracking' AND policyname = 'Allow authenticated read delivery_tracking'
  ) THEN
    CREATE POLICY "Allow authenticated read delivery_tracking"
      ON public.delivery_tracking FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Allow authenticated users to insert delivery tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_tracking' AND policyname = 'Allow authenticated insert delivery_tracking'
  ) THEN
    CREATE POLICY "Allow authenticated insert delivery_tracking"
      ON public.delivery_tracking FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to update delivery tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_tracking' AND policyname = 'Allow authenticated update delivery_tracking'
  ) THEN
    CREATE POLICY "Allow authenticated update delivery_tracking"
      ON public.delivery_tracking FOR UPDATE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Allow authenticated users to manage delivery_eta
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_eta' AND policyname = 'Allow authenticated manage delivery_eta'
  ) THEN
    CREATE POLICY "Allow authenticated manage delivery_eta"
      ON public.delivery_eta FOR ALL
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- 7. Verify migration success
-- =====================================================
-- Check that new columns exist
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_tracking' AND column_name = 'fuel_level'
  ), 'delivery_tracking.fuel_level column not created';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_eta' AND column_name = 'factors'
  ), 'delivery_eta.factors column not created';

  RAISE NOTICE 'Advanced tracking extensions migration completed successfully!';
END $$;
