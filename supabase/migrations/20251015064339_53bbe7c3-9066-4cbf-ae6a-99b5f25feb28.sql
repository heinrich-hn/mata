-- Add webhook-specific metadata columns to trips table
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS import_source TEXT,
ADD COLUMN IF NOT EXISTS shipped_status BOOLEAN,
ADD COLUMN IF NOT EXISTS delivered_status BOOLEAN,
ADD COLUMN IF NOT EXISTS external_load_ref TEXT,
ADD COLUMN IF NOT EXISTS trip_duration_hours NUMERIC;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_external_load_ref ON public.trips(external_load_ref);
CREATE INDEX IF NOT EXISTS idx_trips_import_source ON public.trips(import_source);

-- Add comment for documentation
COMMENT ON COLUMN public.trips.import_source IS 'Source of trip import (e.g., web_book, manual, api)';
COMMENT ON COLUMN public.trips.shipped_status IS 'Boolean flag from external webhook indicating shipped status';
COMMENT ON COLUMN public.trips.delivered_status IS 'Boolean flag from external webhook indicating delivered status';
COMMENT ON COLUMN public.trips.external_load_ref IS 'Original load reference from external system';
COMMENT ON COLUMN public.trips.trip_duration_hours IS 'Calculated trip duration in hours from external system';