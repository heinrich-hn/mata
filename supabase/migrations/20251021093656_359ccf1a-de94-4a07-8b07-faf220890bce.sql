-- Fix function search path for check_trip_completion
CREATE OR REPLACE FUNCTION check_trip_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate when transitioning TO completed status
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Check for unresolved flags
    IF EXISTS (
      SELECT 1 FROM cost_entries 
      WHERE trip_id = NEW.id 
      AND is_flagged = true 
      AND (investigation_status IS NULL OR investigation_status != 'resolved')
    ) THEN
      RAISE EXCEPTION 'Cannot complete trip: unresolved cost flags exist. Please resolve all flagged costs before completing the trip.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;