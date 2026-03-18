-- ============================================================================
-- PREDEFINED LOCATIONS/WAYPOINTS LIBRARY
-- Store commonly used locations for route planning
-- ============================================================================

-- Create location type enum
CREATE TYPE location_type AS ENUM (
  'depot',              -- Company depot/warehouse
  'customer',           -- Customer location
  'border_post',        -- Border crossing
  'truck_stop',         -- Fuel/rest stop
  'toll_gate',          -- Toll plaza
  'market',             -- Market/distribution center
  'port',               -- Sea/air port
  'supplier',           -- Supplier location
  'service_center',     -- Service/maintenance facility
  'other'               -- Other locations
);

-- ============================================================================
-- PREDEFINED LOCATIONS TABLE
-- Library of commonly used locations for route planning
-- ============================================================================
CREATE TABLE public.predefined_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location identification
  name TEXT NOT NULL,
  short_code TEXT UNIQUE, -- e.g., "CPT", "JHB", "HTS"
  location_type location_type DEFAULT 'other',

  -- Address details
  address TEXT,
  city TEXT,
  state_province TEXT,
  country TEXT DEFAULT 'Zimbabwe',

  -- GPS coordinates
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,

  -- Additional details
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  operating_hours TEXT,
  notes TEXT,

  -- Features/amenities
  has_parking BOOLEAN DEFAULT false,
  has_fuel BOOLEAN DEFAULT false,
  has_accommodation BOOLEAN DEFAULT false,
  has_restaurant BOOLEAN DEFAULT false,
  has_weighbridge BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false, -- For frequently used locations

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_predefined_locations_name ON public.predefined_locations(name);
CREATE INDEX idx_predefined_locations_short_code ON public.predefined_locations(short_code);
CREATE INDEX idx_predefined_locations_type ON public.predefined_locations(location_type);
CREATE INDEX idx_predefined_locations_country ON public.predefined_locations(country);
CREATE INDEX idx_predefined_locations_coords ON public.predefined_locations(latitude, longitude);
CREATE INDEX idx_predefined_locations_active ON public.predefined_locations(is_active);
CREATE INDEX idx_predefined_locations_favorite ON public.predefined_locations(is_favorite);

-- Full-text search index for location names and addresses
CREATE INDEX idx_predefined_locations_search ON public.predefined_locations
  USING gin(to_tsvector('english', name || ' ' || COALESCE(address, '') || ' ' || COALESCE(city, '')));

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER update_predefined_locations_updated_at
  BEFORE UPDATE ON public.predefined_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.predefined_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view predefined locations"
  ON public.predefined_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage predefined locations"
  ON public.predefined_locations FOR ALL
  TO authenticated
  USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Search locations by name, short code, or address
CREATE OR REPLACE FUNCTION search_locations(
  search_term TEXT,
  filter_type location_type DEFAULT NULL,
  filter_country TEXT DEFAULT NULL,
  limit_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  short_code TEXT,
  location_type location_type,
  address TEXT,
  city TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.short_code,
    l.location_type,
    l.address,
    l.city,
    l.country,
    l.latitude,
    l.longitude,
    ts_rank(
      to_tsvector('english', l.name || ' ' || COALESCE(l.address, '') || ' ' || COALESCE(l.city, '')),
      plainto_tsquery('english', search_term)
    ) as relevance
  FROM public.predefined_locations l
  WHERE l.is_active = true
    AND (filter_type IS NULL OR l.location_type = filter_type)
    AND (filter_country IS NULL OR l.country = filter_country)
    AND (
      l.name ILIKE '%' || search_term || '%'
      OR l.short_code ILIKE '%' || search_term || '%'
      OR l.address ILIKE '%' || search_term || '%'
      OR l.city ILIKE '%' || search_term || '%'
    )
  ORDER BY
    l.is_favorite DESC,
    relevance DESC,
    l.name ASC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- Find locations within a radius (in km)
CREATE OR REPLACE FUNCTION find_nearby_locations(
  center_lat NUMERIC,
  center_lng NUMERIC,
  radius_km NUMERIC DEFAULT 50,
  filter_type location_type DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  short_code TEXT,
  location_type location_type,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.short_code,
    l.location_type,
    l.address,
    l.latitude,
    l.longitude,
    calculate_distance_km(center_lat, center_lng, l.latitude, l.longitude) as distance
  FROM public.predefined_locations l
  WHERE l.is_active = true
    AND (filter_type IS NULL OR l.location_type = filter_type)
    AND calculate_distance_km(center_lat, center_lng, l.latitude, l.longitude) <= radius_km
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.predefined_locations IS 'Library of predefined locations/waypoints for route planning and load management';
COMMENT ON FUNCTION search_locations IS 'Full-text search for locations by name, code, address, or city';
COMMENT ON FUNCTION find_nearby_locations IS 'Find locations within a specified radius using GPS coordinates';
