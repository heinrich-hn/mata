-- Create geofences table for storing location-based zones and boundaries
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('circle', 'polygon', 'line')),
  groups TEXT, -- Comma-separated groups this geofence belongs to

  -- For circle geofences
  center_lat NUMERIC(10, 8),
  center_lng NUMERIC(11, 8),
  radius NUMERIC, -- in meters

  -- For polygon/line geofences (store as JSON array of coordinates)
  coordinates JSONB,

  -- Additional metadata
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB, -- Store any additional data (city, province, country, etc.)

  -- Wialon integration (if syncing with Wialon)
  wialon_zone_id INTEGER,
  wialon_resource_id INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view geofences"
  ON public.geofences FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage geofences"
  ON public.geofences FOR ALL
  USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_geofences_updated_at
  BEFORE UPDATE ON public.geofences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_geofences_name ON public.geofences(name);
CREATE INDEX IF NOT EXISTS idx_geofences_type ON public.geofences(type);
CREATE INDEX IF NOT EXISTS idx_geofences_is_active ON public.geofences(is_active);
CREATE INDEX IF NOT EXISTS idx_geofences_wialon_zone_id ON public.geofences(wialon_zone_id);

-- Add comments
COMMENT ON TABLE public.geofences IS 'Stores geofence zones for vehicle tracking and route planning';
COMMENT ON COLUMN public.geofences.type IS 'Type of geofence: circle, polygon, or line';
COMMENT ON COLUMN public.geofences.coordinates IS 'JSON array of [lng, lat] pairs for polygon/line geofences';
COMMENT ON COLUMN public.geofences.metadata IS 'Additional data like city, province, country, distance info, etc.';
