-- ============================================================================
-- ROUTE PLANNING & LOAD MANAGEMENT SYSTEM
-- Integrates with Wialon GPS tracking for intelligent load assignment
-- ============================================================================

-- Create load status enum
CREATE TYPE load_status AS ENUM (
  'pending',           -- Load created, not assigned
  'assigned',          -- Assigned to a vehicle/trip
  'in_transit',        -- Pickup completed, en route
  'delivered',         -- Successfully delivered
  'cancelled',         -- Load cancelled
  'failed_delivery'    -- Delivery attempt failed
);

-- Create waypoint type enum
CREATE TYPE waypoint_type AS ENUM (
  'pickup',            -- Load pickup point
  'delivery',          -- Load delivery point
  'rest_stop',         -- Driver rest/fuel stop
  'customs',           -- Border/customs checkpoint
  'weigh_station'      -- Weight inspection
);

-- Create priority enum
CREATE TYPE load_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- ============================================================================
-- LOADS TABLE
-- Represents cargo/freight to be transported
-- ============================================================================
CREATE TABLE public.loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_id UUID, -- Link to future customers table

  -- Locations
  origin TEXT NOT NULL,
  origin_lat NUMERIC(10, 7),
  origin_lng NUMERIC(10, 7),
  origin_address TEXT,
  destination TEXT NOT NULL,
  destination_lat NUMERIC(10, 7),
  destination_lng NUMERIC(10, 7),
  destination_address TEXT,

  -- Timing
  pickup_datetime TIMESTAMPTZ NOT NULL,
  pickup_window_start TIMESTAMPTZ,
  pickup_window_end TIMESTAMPTZ,
  delivery_datetime TIMESTAMPTZ NOT NULL,
  delivery_window_start TIMESTAMPTZ,
  delivery_window_end TIMESTAMPTZ,

  -- Load details
  cargo_type TEXT NOT NULL,
  weight_kg NUMERIC(10, 2) NOT NULL,
  volume_m3 NUMERIC(10, 2),
  value_amount NUMERIC(12, 2),
  value_currency TEXT DEFAULT 'ZAR',
  special_requirements TEXT[], -- e.g., ['refrigerated', 'fragile', 'hazmat']

  -- Assignment
  assigned_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  assigned_vehicle_id UUID, -- FK added later after wialon_vehicles table created
  assigned_at TIMESTAMPTZ,
  assigned_by TEXT,

  -- Status tracking
  status load_status DEFAULT 'pending',
  priority load_priority DEFAULT 'medium',

  -- Actual timings
  actual_pickup_datetime TIMESTAMPTZ,
  actual_delivery_datetime TIMESTAMPTZ,

  -- Financial
  quoted_price NUMERIC(12, 2),
  final_price NUMERIC(12, 2),
  currency TEXT DEFAULT 'ZAR',

  -- Notes and attachments
  notes TEXT,
  special_instructions TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancellation_reason TEXT
);

-- ============================================================================
-- ROUTE WAYPOINTS TABLE
-- Planned stops along a trip route
-- ============================================================================
CREATE TABLE public.route_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,

  -- Waypoint details
  sequence INTEGER NOT NULL, -- Order of waypoint in route
  waypoint_type waypoint_type NOT NULL,
  location_name TEXT NOT NULL,
  address TEXT,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,

  -- Timing
  planned_arrival TIMESTAMPTZ,
  planned_departure TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  estimated_duration_mins INTEGER, -- How long to spend at waypoint

  -- Status
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT false,
  skip_reason TEXT,

  -- Distance from previous waypoint
  distance_from_previous_km NUMERIC(10, 2),

  -- Notes
  notes TEXT,
  special_instructions TEXT,
  contact_person TEXT,
  contact_phone TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROUTE OPTIMIZATIONS TABLE
-- Store calculated optimal routes
-- ============================================================================
CREATE TABLE public.route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,

  -- Route calculation
  waypoints JSONB NOT NULL, -- Array of {lat, lng, name}
  optimized_sequence INTEGER[] NOT NULL, -- Optimal order of waypoints
  total_distance_km NUMERIC(10, 2) NOT NULL,
  estimated_duration_mins INTEGER NOT NULL,
  estimated_fuel_litres NUMERIC(10, 2),
  estimated_fuel_cost NUMERIC(12, 2),
  currency TEXT DEFAULT 'ZAR',

  -- Route details
  route_geometry JSONB, -- GeoJSON LineString of the route
  alternate_routes JSONB, -- Alternative route options

  -- Calculation metadata
  optimization_algorithm TEXT DEFAULT 'nearest_neighbor', -- Algorithm used
  calculation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  -- Selection
  selected BOOLEAN DEFAULT false,
  selected_at TIMESTAMPTZ,
  selected_by TEXT
);

-- ============================================================================
-- LOAD ASSIGNMENT HISTORY TABLE
-- Track all load assignment changes
-- ============================================================================
CREATE TABLE public.load_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE NOT NULL,

  -- Assignment details
  from_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  to_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  from_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  to_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,

  -- Reason for change
  reason TEXT NOT NULL,
  notes TEXT,

  -- Who made the change
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- VEHICLE AVAILABILITY TABLE
-- Track vehicle availability for load assignment
-- ============================================================================
CREATE TABLE public.vehicle_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,

  -- Availability window
  available_from TIMESTAMPTZ NOT NULL,
  available_until TIMESTAMPTZ NOT NULL,

  -- Location
  current_location TEXT,
  current_lat NUMERIC(10, 7),
  current_lng NUMERIC(10, 7),

  -- Capacity
  available_capacity_kg NUMERIC(10, 2),
  available_volume_m3 NUMERIC(10, 2),

  -- Status
  is_available BOOLEAN DEFAULT true,
  unavailable_reason TEXT,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Loads indexes
CREATE INDEX idx_loads_status ON public.loads(status);
CREATE INDEX idx_loads_priority ON public.loads(priority);
CREATE INDEX idx_loads_pickup_datetime ON public.loads(pickup_datetime);
CREATE INDEX idx_loads_delivery_datetime ON public.loads(delivery_datetime);
CREATE INDEX idx_loads_assigned_trip ON public.loads(assigned_trip_id);
CREATE INDEX idx_loads_assigned_vehicle ON public.loads(assigned_vehicle_id);
CREATE INDEX idx_loads_customer ON public.loads(customer_name);
CREATE INDEX idx_loads_origin_coords ON public.loads(origin_lat, origin_lng);
CREATE INDEX idx_loads_dest_coords ON public.loads(destination_lat, destination_lng);

-- Route waypoints indexes
CREATE INDEX idx_waypoints_trip ON public.route_waypoints(trip_id);
CREATE INDEX idx_waypoints_load ON public.route_waypoints(load_id);
CREATE INDEX idx_waypoints_sequence ON public.route_waypoints(trip_id, sequence);
CREATE INDEX idx_waypoints_type ON public.route_waypoints(waypoint_type);
CREATE INDEX idx_waypoints_completed ON public.route_waypoints(completed);
CREATE INDEX idx_waypoints_coords ON public.route_waypoints(lat, lng);

-- Route optimizations indexes
CREATE INDEX idx_route_opt_trip ON public.route_optimizations(trip_id);
CREATE INDEX idx_route_opt_selected ON public.route_optimizations(selected);
CREATE INDEX idx_route_opt_created ON public.route_optimizations(created_at DESC);

-- Vehicle availability indexes
CREATE INDEX idx_vehicle_avail_vehicle ON public.vehicle_availability(vehicle_id);
CREATE INDEX idx_vehicle_avail_dates ON public.vehicle_availability(available_from, available_until);
CREATE INDEX idx_vehicle_avail_status ON public.vehicle_availability(is_available);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loads_updated_at
  BEFORE UPDATE ON public.loads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waypoints_updated_at
  BEFORE UPDATE ON public.route_waypoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_availability_updated_at
  BEFORE UPDATE ON public.vehicle_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create assignment history record when load is assigned
CREATE OR REPLACE FUNCTION log_load_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND (
    OLD.assigned_trip_id IS DISTINCT FROM NEW.assigned_trip_id OR
    OLD.assigned_vehicle_id IS DISTINCT FROM NEW.assigned_vehicle_id
  )) THEN
    INSERT INTO public.load_assignment_history (
      load_id,
      from_trip_id,
      to_trip_id,
      from_vehicle_id,
      to_vehicle_id,
      reason,
      assigned_by
    ) VALUES (
      NEW.id,
      OLD.assigned_trip_id,
      NEW.assigned_trip_id,
      OLD.assigned_vehicle_id,
      NEW.assigned_vehicle_id,
      'Assignment updated',
      COALESCE(NEW.assigned_by, 'system')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_load_assignment_trigger
  AFTER UPDATE ON public.loads
  FOR EACH ROW EXECUTE FUNCTION log_load_assignment();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_availability ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all loads
CREATE POLICY "Allow authenticated users to view loads"
  ON public.loads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage loads"
  ON public.loads FOR ALL
  TO authenticated
  USING (true);

-- Similar policies for other tables
CREATE POLICY "Allow authenticated users to view waypoints"
  ON public.route_waypoints FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage waypoints"
  ON public.route_waypoints FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view optimizations"
  ON public.route_optimizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage optimizations"
  ON public.route_optimizations FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view assignment history"
  ON public.load_assignment_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view vehicle availability"
  ON public.vehicle_availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage vehicle availability"
  ON public.vehicle_availability FOR ALL
  TO authenticated
  USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate distance between two coordinates (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 NUMERIC,
  lng1 NUMERIC,
  lat2 NUMERIC,
  lng2 NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  earth_radius NUMERIC := 6371; -- Earth's radius in km
  dlat NUMERIC;
  dlng NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);

  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlng/2) * sin(dlng/2);

  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Find nearest available vehicles to a load
CREATE OR REPLACE FUNCTION find_nearest_vehicles(
  p_load_id UUID,
  p_max_distance_km NUMERIC DEFAULT 500,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  vehicle_id UUID,
  registration_number TEXT,
  distance_km NUMERIC,
  available_capacity_kg NUMERIC,
  current_location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.registration_number,
    calculate_distance_km(l.origin_lat, l.origin_lng, va.current_lat, va.current_lng) as distance,
    va.available_capacity_kg,
    va.current_location
  FROM public.loads l
  CROSS JOIN public.vehicle_availability va
  JOIN public.vehicles v ON v.id = va.vehicle_id
  WHERE l.id = p_load_id
    AND va.is_available = true
    AND va.current_lat IS NOT NULL
    AND va.current_lng IS NOT NULL
    AND l.origin_lat IS NOT NULL
    AND l.origin_lng IS NOT NULL
    AND va.available_capacity_kg >= l.weight_kg
    AND calculate_distance_km(l.origin_lat, l.origin_lng, va.current_lat, va.current_lng) <= p_max_distance_km
  ORDER BY distance ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.loads IS 'Cargo/freight management - tracks shipments to be transported';
COMMENT ON TABLE public.route_waypoints IS 'Planned stops along trip routes with pickup/delivery/rest points';
COMMENT ON TABLE public.route_optimizations IS 'Calculated optimal routes with distance and cost estimates';
COMMENT ON TABLE public.load_assignment_history IS 'Audit trail of all load assignment changes';
COMMENT ON TABLE public.vehicle_availability IS 'Real-time vehicle availability for smart load assignment';

COMMENT ON FUNCTION calculate_distance_km IS 'Calculate great-circle distance between two GPS coordinates';
COMMENT ON FUNCTION find_nearest_vehicles IS 'Find available vehicles near a load pickup location';
