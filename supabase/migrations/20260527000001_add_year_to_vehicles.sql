-- Add year (model year) column to vehicles table
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS year integer;

COMMENT ON COLUMN public.vehicles.year IS 'Vehicle model/manufacture year';
