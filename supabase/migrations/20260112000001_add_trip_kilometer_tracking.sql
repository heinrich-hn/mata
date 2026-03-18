-- Migration: Add kilometer tracking fields to trips table
-- This enables automatic calculation of distance traveled (ending_km - starting_km)
-- and tracking of empty kilometers with required reason

-- Add starting and ending kilometer fields
ALTER TABLE trips ADD COLUMN IF NOT EXISTS starting_km numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ending_km numeric;

-- Add empty kilometers tracking with reason (reason required when empty_km > 0)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS empty_km numeric DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS empty_km_reason text;

-- Add comments for documentation
COMMENT ON COLUMN trips.starting_km IS 'Odometer reading at the start of the trip';
COMMENT ON COLUMN trips.ending_km IS 'Odometer reading at the end of the trip';
COMMENT ON COLUMN trips.empty_km IS 'Kilometers traveled empty (without load)';
COMMENT ON COLUMN trips.empty_km_reason IS 'Required reason/explanation for empty kilometers';

-- Create a function to automatically calculate distance_km from starting and ending km
CREATE OR REPLACE FUNCTION calculate_trip_distance()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate distance_km when both starting_km and ending_km are provided
  IF NEW.starting_km IS NOT NULL AND NEW.ending_km IS NOT NULL THEN
    NEW.distance_km := NEW.ending_km - NEW.starting_km;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_calculate_trip_distance ON trips;

-- Create trigger to auto-calculate distance on insert or update
CREATE TRIGGER trigger_calculate_trip_distance
  BEFORE INSERT OR UPDATE OF starting_km, ending_km
  ON trips
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trip_distance();

-- Add a check constraint to ensure empty_km_reason is provided when empty_km > 0
-- Note: Using a function-based approach for more flexibility
CREATE OR REPLACE FUNCTION check_empty_km_reason()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.empty_km IS NOT NULL AND NEW.empty_km > 0 AND (NEW.empty_km_reason IS NULL OR TRIM(NEW.empty_km_reason) = '') THEN
    RAISE EXCEPTION 'A reason must be provided when empty kilometers are greater than 0';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_empty_km_reason ON trips;

CREATE TRIGGER trigger_check_empty_km_reason
  BEFORE INSERT OR UPDATE OF empty_km, empty_km_reason
  ON trips
  FOR EACH ROW
  EXECUTE FUNCTION check_empty_km_reason();
