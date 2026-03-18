-- ============================================================================
-- PHASE 2: LIVE DELIVERY TRACKING & ROUTE MONITORING
-- Track vehicle movements during active deliveries with GPS breadcrumbs
-- ============================================================================

-- ============================================================================
-- DELIVERY TRACKING TABLE
-- Records GPS positions during active deliveries
-- ============================================================================
CREATE TABLE public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),

  -- GPS Data
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  altitude NUMERIC(8, 2), -- meters
  speed NUMERIC(6, 2), -- km/h
  heading NUMERIC(5, 2), -- degrees (0-360)
  accuracy NUMERIC(6, 2), -- meters

  -- Tracking metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Distance calculations
  distance_from_origin_km NUMERIC(10, 2),
  distance_to_destination_km NUMERIC(10, 2),
  distance_traveled_km NUMERIC(10, 2), -- Total distance since start

  -- Status
  is_moving BOOLEAN DEFAULT true,
  idle_duration_minutes INTEGER DEFAULT 0,

  -- Additional data
  battery_level INTEGER, -- percentage (for mobile app)
  signal_strength INTEGER, -- percentage
  data_source TEXT DEFAULT 'wialon', -- 'wialon', 'mobile_app', 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DELIVERY EVENTS TABLE
-- Key events during delivery lifecycle
-- ============================================================================
CREATE TABLE public.delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),

  event_type TEXT NOT NULL, -- 'started', 'arrived_origin', 'loaded', 'departed_origin', 'rest_stop', 'fuel_stop', 'arrived_destination', 'unloaded', 'completed', 'delayed', 'diverted'

  -- Location data
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location_name TEXT,

  -- Event details
  description TEXT,
  notes TEXT,

  -- Photos/proof
  photo_url TEXT,
  signature_url TEXT,

  -- Timing
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User
  recorded_by TEXT, -- driver name or system

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ETA CALCULATIONS TABLE
-- Store calculated ETAs and compare with actuals
-- ============================================================================
CREATE TABLE public.delivery_eta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,

  -- ETA calculations
  estimated_arrival TIMESTAMPTZ NOT NULL,
  actual_arrival TIMESTAMPTZ,

  -- Calculation method
  calculation_method TEXT DEFAULT 'gps_based', -- 'gps_based', 'historical', 'traffic_based', 'manual'

  -- Distance and time
  remaining_distance_km NUMERIC(10, 2),
  average_speed_kmh NUMERIC(6, 2),
  estimated_duration_minutes INTEGER,

  -- Confidence
  confidence_level NUMERIC(3, 2), -- 0.00 to 1.00

  -- Factors
  traffic_delay_minutes INTEGER DEFAULT 0,
  weather_delay_minutes INTEGER DEFAULT 0,
  rest_stop_minutes INTEGER DEFAULT 0,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  is_current BOOLEAN DEFAULT true
);

-- ============================================================================
-- GEOFENCE ZONES TABLE
-- Define zones for entry/exit alerts
-- ============================================================================
CREATE TABLE public.geofence_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT,
  zone_type TEXT NOT NULL, -- 'customer', 'border', 'depot', 'restricted', 'rest_area', 'custom'

  -- Zone definition
  center_lat NUMERIC(10, 7) NOT NULL,
  center_lng NUMERIC(10, 7) NOT NULL,
  radius_meters INTEGER NOT NULL, -- Circular zone radius

  -- Alternatively, polygon coordinates (future enhancement)
  -- polygon_coords JSONB, -- Array of lat/lng points

  -- Associated location
  location_id UUID REFERENCES public.predefined_locations(id),

  -- Alert settings
  alert_on_entry BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  alert_on_dwell BOOLEAN DEFAULT false, -- Alert if vehicle stays too long
  max_dwell_minutes INTEGER DEFAULT 30,

  -- Notifications
  notify_dispatcher BOOLEAN DEFAULT true,
  notify_customer BOOLEAN DEFAULT false,
  notification_emails TEXT[], -- Array of email addresses

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GEOFENCE EVENTS TABLE
-- Log when vehicles enter/exit zones
-- ============================================================================
CREATE TABLE public.geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  geofence_zone_id UUID NOT NULL REFERENCES public.geofence_zones(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  load_id UUID REFERENCES public.loads(id), -- Nullable: vehicle might not have active load

  event_type TEXT NOT NULL, -- 'entered', 'exited', 'dwell_exceeded'

  -- Location at time of event
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),

  -- Timing
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dwell_duration_minutes INTEGER,

  -- Notification status
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Delivery tracking
CREATE INDEX idx_delivery_tracking_load_id ON public.delivery_tracking(load_id);
CREATE INDEX idx_delivery_tracking_vehicle_id ON public.delivery_tracking(vehicle_id);
CREATE INDEX idx_delivery_tracking_recorded_at ON public.delivery_tracking(recorded_at DESC);
CREATE INDEX idx_delivery_tracking_coords ON public.delivery_tracking(latitude, longitude);

-- Delivery events
CREATE INDEX idx_delivery_events_load_id ON public.delivery_events(load_id);
CREATE INDEX idx_delivery_events_type ON public.delivery_events(event_type);
CREATE INDEX idx_delivery_events_timestamp ON public.delivery_events(event_timestamp DESC);

-- ETA
CREATE INDEX idx_delivery_eta_load_id ON public.delivery_eta(load_id);
CREATE INDEX idx_delivery_eta_current ON public.delivery_eta(is_current) WHERE is_current = true;

-- Geofences
CREATE INDEX idx_geofence_zones_active ON public.geofence_zones(is_active) WHERE is_active = true;
CREATE INDEX idx_geofence_zones_type ON public.geofence_zones(zone_type);
CREATE INDEX idx_geofence_events_zone ON public.geofence_events(geofence_zone_id);
CREATE INDEX idx_geofence_events_vehicle ON public.geofence_events(vehicle_id);
CREATE INDEX idx_geofence_events_timestamp ON public.geofence_events(event_timestamp DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_eta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

-- Delivery tracking
CREATE POLICY "Allow authenticated users to manage delivery tracking"
  ON public.delivery_tracking FOR ALL
  TO authenticated
  USING (true);

-- Delivery events
CREATE POLICY "Allow authenticated users to manage delivery events"
  ON public.delivery_events FOR ALL
  TO authenticated
  USING (true);

-- ETA
CREATE POLICY "Allow authenticated users to manage delivery eta"
  ON public.delivery_eta FOR ALL
  TO authenticated
  USING (true);

-- Geofence zones
CREATE POLICY "Allow authenticated users to manage geofence zones"
  ON public.geofence_zones FOR ALL
  TO authenticated
  USING (true);

-- Geofence events
CREATE POLICY "Allow authenticated users to manage geofence events"
  ON public.geofence_events FOR ALL
  TO authenticated
  USING (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate ETA based on current position and average speed
CREATE OR REPLACE FUNCTION calculate_delivery_eta(
  p_load_id UUID
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_current_lat NUMERIC;
  v_current_lng NUMERIC;
  v_dest_lat NUMERIC;
  v_dest_lng NUMERIC;
  v_avg_speed NUMERIC;
  v_distance_km NUMERIC;
  v_duration_hours NUMERIC;
  v_eta TIMESTAMPTZ;
BEGIN
  -- Get latest tracking position
  SELECT latitude, longitude INTO v_current_lat, v_current_lng
  FROM public.delivery_tracking
  WHERE load_id = p_load_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Get destination
  SELECT destination_lat, destination_lng INTO v_dest_lat, v_dest_lng
  FROM public.loads
  WHERE id = p_load_id;

  -- Calculate remaining distance
  v_distance_km := calculate_distance_km(v_current_lat, v_current_lng, v_dest_lat, v_dest_lng);

  -- Get average speed from last 30 minutes
  SELECT AVG(speed) INTO v_avg_speed
  FROM public.delivery_tracking
  WHERE load_id = p_load_id
    AND recorded_at >= NOW() - INTERVAL '30 minutes'
    AND speed > 0;

  -- Default to 60 km/h if no data
  v_avg_speed := COALESCE(v_avg_speed, 60);

  -- Calculate ETA
  v_duration_hours := v_distance_km / v_avg_speed;
  v_eta := NOW() + (v_duration_hours || ' hours')::INTERVAL;

  -- Store calculation
  INSERT INTO public.delivery_eta (
    load_id,
    estimated_arrival,
    remaining_distance_km,
    average_speed_kmh,
    estimated_duration_minutes,
    confidence_level
  ) VALUES (
    p_load_id,
    v_eta,
    v_distance_km,
    v_avg_speed,
    (v_duration_hours * 60)::INTEGER,
    0.75 -- Medium confidence
  );

  RETURN v_eta;
END;
$$ LANGUAGE plpgsql;

-- Check if vehicle is within geofence
CREATE OR REPLACE FUNCTION check_geofence_entry(
  p_vehicle_id UUID,
  p_latitude NUMERIC,
  p_longitude NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_zone RECORD;
  v_distance_meters NUMERIC;
  v_load_id UUID;
BEGIN
  -- Get active load for vehicle
  SELECT id INTO v_load_id
  FROM public.loads
  WHERE assigned_vehicle_id = p_vehicle_id
    AND status IN ('assigned', 'in_transit')
  LIMIT 1;

  -- Check each active geofence
  FOR v_zone IN
    SELECT * FROM public.geofence_zones WHERE is_active = true
  LOOP
    v_distance_meters := calculate_distance_km(
      p_latitude, p_longitude,
      v_zone.center_lat, v_zone.center_lng
    ) * 1000;

    IF v_distance_meters <= v_zone.radius_meters THEN
      -- Vehicle is inside zone - check if this is a new entry
      IF NOT EXISTS (
        SELECT 1 FROM public.geofence_events
        WHERE geofence_zone_id = v_zone.id
          AND vehicle_id = p_vehicle_id
          AND event_type = 'entered'
          AND event_timestamp >= NOW() - INTERVAL '1 hour'
      ) THEN
        -- Log entry event
        INSERT INTO public.geofence_events (
          geofence_zone_id,
          vehicle_id,
          load_id,
          event_type,
          latitude,
          longitude
        ) VALUES (
          v_zone.id,
          p_vehicle_id,
          v_load_id,
          'entered',
          p_latitude,
          p_longitude
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO AUTO-CALCULATE ETA ON NEW TRACKING POINT
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_update_eta()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate ETA every 5 tracking points
  IF (SELECT COUNT(*) FROM delivery_tracking WHERE load_id = NEW.load_id) % 5 = 0 THEN
    PERFORM calculate_delivery_eta(NEW.load_id);
  END IF;

  -- Check geofence entry
  PERFORM check_geofence_entry(NEW.vehicle_id, NEW.latitude, NEW.longitude);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_eta_on_tracking
  AFTER INSERT ON public.delivery_tracking
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_eta();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.delivery_tracking IS 'GPS breadcrumb trail during active deliveries';
COMMENT ON TABLE public.delivery_events IS 'Key lifecycle events during delivery (started, arrived, completed, etc.)';
COMMENT ON TABLE public.delivery_eta IS 'Calculated ETAs vs actual arrival times for performance analysis';
COMMENT ON TABLE public.geofence_zones IS 'Geographic zones for entry/exit alerts (customers, borders, depots)';
COMMENT ON TABLE public.geofence_events IS 'Log of vehicles entering/exiting geofenced zones';

COMMENT ON FUNCTION calculate_delivery_eta IS 'Calculate estimated arrival time based on current position and speed';
COMMENT ON FUNCTION check_geofence_entry IS 'Check if vehicle entered any geofence zones and log event';
