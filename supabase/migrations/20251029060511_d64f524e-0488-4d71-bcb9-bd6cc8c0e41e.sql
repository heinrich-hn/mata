-- Add trailer-specific fuel tracking fields to diesel_records
ALTER TABLE diesel_records
ADD COLUMN IF NOT EXISTS trailer_fuel_data jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS vehicle_litres_only numeric,
ADD COLUMN IF NOT EXISTS trailer_litres_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vehicle_fuel_cost numeric,
ADD COLUMN IF NOT EXISTS trailer_fuel_cost numeric DEFAULT 0;

COMMENT ON COLUMN diesel_records.trailer_fuel_data IS 'Array of {trailer_id, operating_hours, litres_per_hour, total_litres, fuel_cost} for each linked trailer';
COMMENT ON COLUMN diesel_records.vehicle_litres_only IS 'Litres consumed by vehicle only (total - trailer litres)';
COMMENT ON COLUMN diesel_records.trailer_litres_total IS 'Total litres consumed by all trailers';
COMMENT ON COLUMN diesel_records.vehicle_fuel_cost IS 'Cost of fuel for vehicle only';
COMMENT ON COLUMN diesel_records.trailer_fuel_cost IS 'Total cost of fuel for all trailers';

-- Update the efficiency check trigger to use vehicle-only fuel for km/L calculation
CREATE OR REPLACE FUNCTION check_diesel_efficiency_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  norm_record RECORD;
  vehicle_km_per_litre numeric;
BEGIN
  -- Calculate km/L using vehicle fuel only (excluding trailer fuel)
  IF NEW.vehicle_litres_only IS NOT NULL AND NEW.vehicle_litres_only > 0 AND NEW.distance_travelled IS NOT NULL THEN
    vehicle_km_per_litre := NEW.distance_travelled / NEW.vehicle_litres_only;
    
    -- Get norm for this fleet
    SELECT * INTO norm_record 
    FROM diesel_norms 
    WHERE fleet_number = NEW.fleet_number 
    LIMIT 1;
    
    IF FOUND THEN
      -- Check if outside acceptable range (vehicle efficiency only)
      IF vehicle_km_per_litre < norm_record.min_acceptable THEN
        NEW.requires_debrief := true;
        NEW.debrief_trigger_reason := 'Vehicle fuel efficiency below minimum acceptable (' || 
          norm_record.min_acceptable || ' km/L). Actual: ' || ROUND(vehicle_km_per_litre, 2) || ' km/L';
      ELSIF vehicle_km_per_litre > norm_record.max_acceptable THEN
        NEW.requires_debrief := true;
        NEW.debrief_trigger_reason := 'Vehicle fuel efficiency above maximum acceptable (' || 
          norm_record.max_acceptable || ' km/L). Actual: ' || ROUND(vehicle_km_per_litre, 2) || ' km/L';
      END IF;
    END IF;
    
    -- Store vehicle km/L separately for reporting
    NEW.km_per_litre := vehicle_km_per_litre;
  END IF;
  
  RETURN NEW;
END;
$$;