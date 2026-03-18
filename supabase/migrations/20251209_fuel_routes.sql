-- Fuel Routes Management Tables
-- For managing frequently used routes with notes and fuel station analytics

-- 1. Create fuel_routes table (frequently used routes with notes)
CREATE TABLE IF NOT EXISTS fuel_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  origin_latitude NUMERIC(10, 7),
  origin_longitude NUMERIC(10, 7),
  destination TEXT NOT NULL,
  destination_latitude NUMERIC(10, 7),
  destination_longitude NUMERIC(10, 7),
  total_distance_km NUMERIC(10, 2),
  estimated_duration_hours NUMERIC(6, 2),
  is_round_trip BOOLEAN DEFAULT false,
  notes TEXT, -- User notes for the route
  driver_tips TEXT, -- Tips for drivers on this route
  best_fuel_strategy TEXT, -- Recommended fueling strategy
  avg_fuel_consumption_per_km NUMERIC(6, 4) DEFAULT 0.35, -- Default 0.35 L/km for trucks
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create route_waypoints table (intermediate points on routes)
CREATE TABLE IF NOT EXISTS route_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES fuel_routes(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  google_maps_url TEXT,
  distance_from_origin_km NUMERIC(10, 2),
  distance_to_next_km NUMERIC(10, 2),
  is_fuel_stop BOOLEAN DEFAULT false,
  supplier_id UUID REFERENCES diesel_suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create route_fuel_recommendations table (calculated optimal fuel stops)
CREATE TABLE IF NOT EXISTS route_fuel_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES fuel_routes(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES diesel_suppliers(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  distance_from_origin_km NUMERIC(10, 2),
  distance_to_destination_km NUMERIC(10, 2),
  recommended_liters NUMERIC(10, 2),
  price_at_calculation NUMERIC(10, 4),
  estimated_cost NUMERIC(12, 2),
  savings_vs_average NUMERIC(12, 2),
  reason TEXT, -- Why this stop is recommended
  is_mandatory BOOLEAN DEFAULT false,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_id, sequence_order)
);

-- 4. Create route_notes table (user annotations for routes)
CREATE TABLE IF NOT EXISTS route_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES fuel_routes(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'fuel', 'road_condition', 'hazard', 'tip'
  title TEXT,
  content TEXT NOT NULL,
  location_description TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  distance_from_origin_km NUMERIC(10, 2),
  is_important BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create route_analytics table (track route usage and costs)
CREATE TABLE IF NOT EXISTS route_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES fuel_routes(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL,
  vehicle_id UUID,
  driver_name TEXT,
  actual_fuel_liters NUMERIC(10, 2),
  actual_fuel_cost NUMERIC(12, 2),
  fuel_stops_used JSONB, -- Array of supplier IDs used
  optimized_cost_would_be NUMERIC(12, 2), -- What it would have cost with optimal stops
  savings_achieved NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fuel_routes_name ON fuel_routes(name);
CREATE INDEX IF NOT EXISTS idx_fuel_routes_origin ON fuel_routes(origin);
CREATE INDEX IF NOT EXISTS idx_fuel_routes_destination ON fuel_routes(destination);
CREATE INDEX IF NOT EXISTS idx_fuel_routes_favorite ON fuel_routes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_fuel_routes_active ON fuel_routes(is_active);
CREATE INDEX IF NOT EXISTS idx_route_waypoints_route ON route_waypoints(route_id);
CREATE INDEX IF NOT EXISTS idx_route_waypoints_supplier ON route_waypoints(supplier_id);
CREATE INDEX IF NOT EXISTS idx_route_fuel_recommendations_route ON route_fuel_recommendations(route_id);
CREATE INDEX IF NOT EXISTS idx_route_notes_route ON route_notes(route_id);
CREATE INDEX IF NOT EXISTS idx_route_notes_type ON route_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_route_analytics_route ON route_analytics(route_id);
CREATE INDEX IF NOT EXISTS idx_route_analytics_date ON route_analytics(trip_date);

-- Enable RLS
ALTER TABLE fuel_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_fuel_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated read fuel_routes" ON fuel_routes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert fuel_routes" ON fuel_routes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update fuel_routes" ON fuel_routes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete fuel_routes" ON fuel_routes
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read route_waypoints" ON route_waypoints
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert route_waypoints" ON route_waypoints
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update route_waypoints" ON route_waypoints
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete route_waypoints" ON route_waypoints
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read route_fuel_recommendations" ON route_fuel_recommendations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert route_fuel_recommendations" ON route_fuel_recommendations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update route_fuel_recommendations" ON route_fuel_recommendations
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete route_fuel_recommendations" ON route_fuel_recommendations
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read route_notes" ON route_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert route_notes" ON route_notes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update route_notes" ON route_notes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete route_notes" ON route_notes
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read route_analytics" ON route_analytics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert route_analytics" ON route_analytics
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update route_analytics" ON route_analytics
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete route_analytics" ON route_analytics
  FOR DELETE TO authenticated USING (true);

-- Function to calculate optimal fuel stops for a route
CREATE OR REPLACE FUNCTION calculate_route_fuel_stops(
  p_route_id UUID,
  p_tank_capacity_liters NUMERIC DEFAULT 500,
  p_reserve_liters NUMERIC DEFAULT 50
)
RETURNS TABLE (
  supplier_id UUID,
  supplier_name TEXT,
  location TEXT,
  distance_from_origin_km NUMERIC,
  price_per_liter NUMERIC,
  recommended_liters NUMERIC,
  estimated_cost NUMERIC,
  savings_vs_avg NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_route RECORD;
  v_avg_price NUMERIC;
  v_consumption_rate NUMERIC;
  v_total_fuel_needed NUMERIC;
BEGIN
  -- Get route details
  SELECT * INTO v_route FROM fuel_routes WHERE id = p_route_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;

  -- Get average market price
  SELECT AVG(current_price_per_liter) INTO v_avg_price
  FROM diesel_suppliers WHERE is_active = true AND is_avoided = false;

  v_consumption_rate := COALESCE(v_route.avg_fuel_consumption_per_km, 0.35);
  v_total_fuel_needed := v_route.total_distance_km * v_consumption_rate;

  -- Return suppliers along the route ordered by price
  -- In a real implementation, this would filter by geographic proximity
  RETURN QUERY
  SELECT
    ds.id AS supplier_id,
    ds.name AS supplier_name,
    ds.location,
    COALESCE(rw.distance_from_origin_km, 0) AS distance_from_origin_km,
    ds.current_price_per_liter AS price_per_liter,
    LEAST(p_tank_capacity_liters - p_reserve_liters, v_total_fuel_needed) AS recommended_liters,
    (LEAST(p_tank_capacity_liters - p_reserve_liters, v_total_fuel_needed) * ds.current_price_per_liter) AS estimated_cost,
    (v_avg_price - ds.current_price_per_liter) * LEAST(p_tank_capacity_liters - p_reserve_liters, v_total_fuel_needed) AS savings_vs_avg
  FROM diesel_suppliers ds
  LEFT JOIN route_waypoints rw ON rw.supplier_id = ds.id AND rw.route_id = p_route_id
  WHERE ds.is_active = true AND ds.is_avoided = false
  ORDER BY ds.current_price_per_liter ASC
  LIMIT 10;
END;
$$;

-- Function to calculate distance between two coordinates (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 NUMERIC, lon1 NUMERIC,
  lat2 NUMERIC, lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  R NUMERIC := 6371; -- Earth's radius in km
  dLat NUMERIC;
  dLon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);

  a := sin(dLat/2) * sin(dLat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dLon/2) * sin(dLon/2);

  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN ROUND(R * c, 2);
END;
$$;

-- Function to find nearest suppliers to a given location
CREATE OR REPLACE FUNCTION find_nearest_suppliers(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_max_distance_km NUMERIC DEFAULT 50,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  location TEXT,
  distance_km NUMERIC,
  price_per_liter NUMERIC,
  is_preferred BOOLEAN,
  google_maps_url TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.id,
    ds.name,
    ds.location,
    calculate_distance_km(p_latitude, p_longitude, ds.latitude, ds.longitude) AS distance_km,
    ds.current_price_per_liter AS price_per_liter,
    ds.is_preferred,
    ds.google_maps_url
  FROM diesel_suppliers ds
  WHERE ds.is_active = true
    AND ds.is_avoided = false
    AND ds.latitude IS NOT NULL
    AND ds.longitude IS NOT NULL
    AND calculate_distance_km(p_latitude, p_longitude, ds.latitude, ds.longitude) <= p_max_distance_km
  ORDER BY calculate_distance_km(p_latitude, p_longitude, ds.latitude, ds.longitude) ASC
  LIMIT p_limit;
END;
$$;

-- Function to add a note to a route
CREATE OR REPLACE FUNCTION add_route_note(
  p_route_id UUID,
  p_note_type TEXT,
  p_title TEXT,
  p_content TEXT,
  p_location_description TEXT DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_is_important BOOLEAN DEFAULT false,
  p_created_by TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_note_id UUID;
  v_distance NUMERIC;
  v_route RECORD;
BEGIN
  -- Get route details
  SELECT * INTO v_route FROM fuel_routes WHERE id = p_route_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;

  -- Calculate distance from origin if coordinates provided
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL
     AND v_route.origin_latitude IS NOT NULL AND v_route.origin_longitude IS NOT NULL THEN
    v_distance := calculate_distance_km(
      v_route.origin_latitude, v_route.origin_longitude,
      p_latitude, p_longitude
    );
  END IF;

  INSERT INTO route_notes (
    route_id, note_type, title, content, location_description,
    latitude, longitude, distance_from_origin_km, is_important, created_by
  )
  VALUES (
    p_route_id, p_note_type, p_title, p_content, p_location_description,
    p_latitude, p_longitude, v_distance, p_is_important, p_created_by
  )
  RETURNING id INTO v_note_id;

  RETURN v_note_id;
END;
$$;

-- Function to get route summary with analytics
CREATE OR REPLACE FUNCTION get_route_summary(p_route_id UUID)
RETURNS TABLE (
  route_name TEXT,
  origin TEXT,
  destination TEXT,
  total_distance_km NUMERIC,
  total_fuel_needed_liters NUMERIC,
  cheapest_station_name TEXT,
  cheapest_price NUMERIC,
  cheapest_total_cost NUMERIC,
  avg_market_price NUMERIC,
  potential_savings NUMERIC,
  notes_count BIGINT,
  waypoints_count BIGINT,
  last_trip_date DATE,
  usage_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_route RECORD;
  v_fuel_needed NUMERIC;
  v_avg_price NUMERIC;
  v_cheapest RECORD;
BEGIN
  SELECT * INTO v_route FROM fuel_routes WHERE id = p_route_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;

  v_fuel_needed := v_route.total_distance_km * COALESCE(v_route.avg_fuel_consumption_per_km, 0.35);

  SELECT AVG(current_price_per_liter) INTO v_avg_price
  FROM diesel_suppliers WHERE is_active = true AND is_avoided = false;

  SELECT ds.name, ds.current_price_per_liter
  INTO v_cheapest
  FROM diesel_suppliers ds
  WHERE ds.is_active = true AND ds.is_avoided = false
  ORDER BY ds.current_price_per_liter ASC
  LIMIT 1;

  RETURN QUERY
  SELECT
    v_route.name,
    v_route.origin,
    v_route.destination,
    v_route.total_distance_km,
    v_fuel_needed,
    v_cheapest.name,
    v_cheapest.current_price_per_liter,
    v_fuel_needed * v_cheapest.current_price_per_liter,
    v_avg_price,
    (v_avg_price - v_cheapest.current_price_per_liter) * v_fuel_needed,
    (SELECT COUNT(*) FROM route_notes WHERE route_id = p_route_id),
    (SELECT COUNT(*) FROM route_waypoints WHERE route_id = p_route_id),
    (SELECT MAX(trip_date) FROM route_analytics WHERE route_id = p_route_id),
    v_route.usage_count;
END;
$$;
