-- Phase 1: Add columns to diesel_records table
ALTER TABLE diesel_records 
  ADD COLUMN IF NOT EXISTS linked_trailers text[],
  ADD COLUMN IF NOT EXISTS requires_debrief boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS debrief_trigger_reason text,
  ADD COLUMN IF NOT EXISTS cost_entry_ids uuid[];

-- Add columns to cost_entries table
ALTER TABLE cost_entries 
  ADD COLUMN IF NOT EXISTS diesel_record_id uuid REFERENCES diesel_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_identifier text;

-- Create function to auto-check diesel efficiency against norms
CREATE OR REPLACE FUNCTION check_diesel_efficiency_trigger()
RETURNS TRIGGER AS $$
DECLARE
  norm_record RECORD;
BEGIN
  -- Only check if we have km_per_litre calculated
  IF NEW.km_per_litre IS NOT NULL THEN
    -- Get norm for this fleet
    SELECT * INTO norm_record 
    FROM diesel_norms 
    WHERE fleet_number = NEW.fleet_number 
    LIMIT 1;
    
    IF FOUND THEN
      -- Check if outside acceptable range
      IF NEW.km_per_litre < norm_record.min_acceptable THEN
        NEW.requires_debrief := true;
        NEW.debrief_trigger_reason := 'Fuel efficiency below minimum acceptable (' || 
          norm_record.min_acceptable || ' km/L)';
      ELSIF NEW.km_per_litre > norm_record.max_acceptable THEN
        NEW.requires_debrief := true;
        NEW.debrief_trigger_reason := 'Fuel efficiency above maximum acceptable (' || 
          norm_record.max_acceptable || ' km/L)';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on diesel_records
DROP TRIGGER IF EXISTS diesel_efficiency_check ON diesel_records;
CREATE TRIGGER diesel_efficiency_check
BEFORE INSERT OR UPDATE OF km_per_litre ON diesel_records
FOR EACH ROW
EXECUTE FUNCTION check_diesel_efficiency_trigger();