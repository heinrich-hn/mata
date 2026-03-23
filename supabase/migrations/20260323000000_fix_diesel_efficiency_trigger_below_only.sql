-- Fix: Only flag records requiring debrief when fuel efficiency is BELOW minimum acceptable.
-- Above-maximum efficiency is good performance and should not trigger debrief.

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
      -- Only flag poor efficiency (below minimum) for debrief
      IF vehicle_km_per_litre < norm_record.min_acceptable THEN
        NEW.requires_debrief := true;
        NEW.debrief_trigger_reason := 'Vehicle fuel efficiency below minimum acceptable (' || 
          norm_record.min_acceptable || ' km/L). Actual: ' || ROUND(vehicle_km_per_litre, 2) || ' km/L';
      END IF;
    END IF;
    
    -- Store vehicle km/L separately for reporting
    NEW.km_per_litre := vehicle_km_per_litre;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also clear any existing above-max debriefs that were incorrectly flagged
UPDATE diesel_records
SET requires_debrief = false,
    debrief_trigger_reason = NULL
WHERE requires_debrief = true
  AND debrief_signed = false
  AND debrief_trigger_reason LIKE '%above maximum%';
