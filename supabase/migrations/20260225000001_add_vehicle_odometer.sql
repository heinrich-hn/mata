-- Add current_odometer column to vehicles table for KM-based maintenance scheduling
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_odometer BIGINT DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN vehicles.current_odometer IS 'Current vehicle odometer reading in km. Auto-updated when trips are completed.';
