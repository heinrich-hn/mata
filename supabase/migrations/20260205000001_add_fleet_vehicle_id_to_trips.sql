-- ============================================================================
-- ADD FLEET_VEHICLE_ID TO TRIPS TABLE
-- Links trips directly to the vehicles table for consistent fleet reporting
-- This resolves the issue where mobile app couldn't load trips for vehicles
-- that don't have a matching wialon_vehicles entry
-- ============================================================================

-- Step 1: Add fleet_vehicle_id column to trips table
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS fleet_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_trips_fleet_vehicle_id ON public.trips(fleet_vehicle_id);

-- Step 3: Backfill existing trips with fleet_vehicle_id based on wialon_vehicles → vehicles mapping
-- This maps trips to vehicles by matching wialon_unit_id between wialon_vehicles and vehicles.wialon_id
UPDATE public.trips t
SET fleet_vehicle_id = v.id
FROM public.wialon_vehicles wv
INNER JOIN public.vehicles v ON v.wialon_id = wv.wialon_unit_id
WHERE t.vehicle_id = wv.id
  AND t.fleet_vehicle_id IS NULL
  AND v.wialon_id IS NOT NULL;

-- Step 4: Also try to match by fleet_number for vehicles that don't have wialon_id
UPDATE public.trips t
SET fleet_vehicle_id = v.id
FROM public.wialon_vehicles wv
INNER JOIN public.vehicles v ON UPPER(v.fleet_number) = UPPER(wv.fleet_number)
WHERE t.vehicle_id = wv.id
  AND t.fleet_vehicle_id IS NULL
  AND wv.fleet_number IS NOT NULL
  AND v.fleet_number IS NOT NULL;

-- Step 5: Create a function to auto-populate fleet_vehicle_id when vehicle_id is set
CREATE OR REPLACE FUNCTION set_trip_fleet_vehicle_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if vehicle_id is set and fleet_vehicle_id is not already set
  IF NEW.vehicle_id IS NOT NULL AND NEW.fleet_vehicle_id IS NULL THEN
    -- Try to find matching vehicle by wialon_id first
    SELECT v.id INTO NEW.fleet_vehicle_id
    FROM public.vehicles v
    INNER JOIN public.wialon_vehicles wv ON v.wialon_id = wv.wialon_unit_id
    WHERE wv.id = NEW.vehicle_id
    LIMIT 1;

    -- If no match by wialon_id, try by fleet_number
    IF NEW.fleet_vehicle_id IS NULL THEN
      SELECT v.id INTO NEW.fleet_vehicle_id
      FROM public.vehicles v
      INNER JOIN public.wialon_vehicles wv ON UPPER(v.fleet_number) = UPPER(wv.fleet_number)
      WHERE wv.id = NEW.vehicle_id
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to auto-populate on INSERT and UPDATE
DROP TRIGGER IF EXISTS set_trip_fleet_vehicle_id_trigger ON public.trips;
CREATE TRIGGER set_trip_fleet_vehicle_id_trigger
  BEFORE INSERT OR UPDATE OF vehicle_id ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION set_trip_fleet_vehicle_id();

-- Step 7: Add comments
COMMENT ON COLUMN public.trips.fleet_vehicle_id IS 'Direct link to vehicles table for fleet management. Auto-populated from vehicle_id (wialon_vehicles) when possible.';

-- ============================================================================
-- SUMMARY:
-- - trips.vehicle_id: References wialon_vehicles.id (for GPS tracking)
-- - trips.fleet_vehicle_id: References vehicles.id (for fleet management)
--
-- The mobile app can now query trips by fleet_vehicle_id directly,
-- which links to the same vehicles table used in driver_vehicle_assignments
-- ============================================================================
