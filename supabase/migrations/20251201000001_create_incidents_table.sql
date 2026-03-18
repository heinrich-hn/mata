-- Create incident_status enum
DO $
$ 
BEGIN
  CREATE TYPE incident_status AS ENUM
  ('open', 'processing', 'closed', 'claimed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create incident_type enum
DO $$ 
BEGIN
  CREATE TYPE incident_type AS ENUM
  (
    'collision',
    'theft',
    'vandalism',
    'fire',
    'mechanical_failure',
    'tire_blowout',
    'cargo_damage',
    'driver_injury',
    'third_party_injury',
    'weather_related',
    'road_hazard',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create weather_condition enum
DO $$ 
BEGIN
  CREATE TYPE weather_condition AS ENUM
  (
    'clear',
    'cloudy',
    'rain',
    'heavy_rain',
    'fog',
    'snow',
    'hail',
    'windy',
    'storm',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create incidents table
CREATE TABLE
IF NOT EXISTS public.incidents
(
  id UUID NOT NULL DEFAULT gen_random_uuid
() PRIMARY KEY,

  -- Core incident information
  incident_number TEXT NOT NULL UNIQUE,
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,

  -- Vehicle reference
  vehicle_id UUID REFERENCES public.vehicles
(id),
  vehicle_number TEXT,

  -- Location information
  location_id UUID REFERENCES public.predefined_locations
(id),
  location TEXT NOT NULL,
  latitude DECIMAL
(10, 8),
  longitude DECIMAL
(11, 8),

  -- Incident details
  incident_type incident_type NOT NULL DEFAULT 'other',
  description TEXT,
  weather_condition weather_condition DEFAULT 'unknown',

  -- Personnel
  reported_by TEXT NOT NULL,
  driver_id UUID REFERENCES public.drivers
(id),
  driver_name TEXT,

  -- Status and workflow
  status incident_status NOT NULL DEFAULT 'open',

  -- Insurance and costs (for closed/claimed incidents)
  insurance_number TEXT,
  total_cost DECIMAL
(12, 2),
  insurance_claim_amount DECIMAL
(12, 2),

  -- Resolution notes
  notes TEXT,
  resolution_notes TEXT,
  closed_at TIMESTAMP
WITH TIME ZONE,
  closed_by TEXT,

  -- Image attachments (JSONB array of image objects)
  images JSONB DEFAULT '[]'::jsonb,

  -- Rating (1-5 severity/impact rating)
  severity_rating INTEGER CHECK
(severity_rating >= 1 AND severity_rating <= 5),

  -- Metadata
  created_at TIMESTAMP
WITH TIME ZONE DEFAULT now
(),
  updated_at TIMESTAMP
WITH TIME ZONE DEFAULT now
(),
  created_by UUID REFERENCES auth.users
(id)
);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view incidents"
  ON public.incidents FOR
SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage incidents"
  ON public.incidents FOR ALL
  USING
(auth.role
() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_incidents_updated_at
  BEFORE
UPDATE ON public.incidents
  FOR EACH ROW
EXECUTE FUNCTION
public.update_updated_at_column
();

-- Create indexes for better performance
CREATE INDEX
IF NOT EXISTS idx_incidents_incident_number ON public.incidents
(incident_number);
CREATE INDEX
IF NOT EXISTS idx_incidents_incident_date ON public.incidents
(incident_date DESC);
CREATE INDEX
IF NOT EXISTS idx_incidents_vehicle_id ON public.incidents
(vehicle_id);
CREATE INDEX
IF NOT EXISTS idx_incidents_status ON public.incidents
(status);
CREATE INDEX
IF NOT EXISTS idx_incidents_location_id ON public.incidents
(location_id);
CREATE INDEX
IF NOT EXISTS idx_incidents_incident_type ON public.incidents
(incident_type);
CREATE INDEX
IF NOT EXISTS idx_incidents_created_at ON public.incidents
(created_at DESC);

-- Add comment
COMMENT ON TABLE public.incidents IS 'Stores vehicle incident reports including accidents, theft, damage, etc.';

-- Enable realtime for incidents table
ALTER PUBLICATION supabase_realtime
ADD TABLE public.incidents;

-- Create function to generate incident number
CREATE OR REPLACE FUNCTION generate_incident_number
()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
BEGIN
  current_year := to_char
(CURRENT_DATE, 'YYYY');

SELECT COALESCE(MAX(
    CAST(SUBSTRING(incident_number FROM 'INC-' || current_year || '-(\d+)') AS INTEGER)
  ), 0) + 1
INTO next_seq
FROM public.incidents
WHERE incident_number LIKE 'INC-' || current_year || '-%';

RETURN 'INC-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_incident_number
() IS 'Generates sequential incident numbers in format INC-YYYY-NNNN';
