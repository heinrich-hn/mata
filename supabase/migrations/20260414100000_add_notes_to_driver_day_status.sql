-- Add notes column to driver_day_status for location/reason when marking At Work
ALTER TABLE driver_day_status ADD COLUMN IF NOT EXISTS notes TEXT;
