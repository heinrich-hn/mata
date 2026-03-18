-- Add odometer_reading column to job_cards table
-- This tracks the vehicle's KM at the time the job card was created
-- When created from an inspection, this auto-fills from the inspection's odometer_reading
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS odometer_reading numeric;

COMMENT ON COLUMN job_cards.odometer_reading IS 'Vehicle odometer reading (km) at time of job card creation';
