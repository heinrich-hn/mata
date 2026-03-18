-- Migration to add revenue_type and rate_per_km columns to trips table
-- This enables tracking whether a trip uses fixed rate or per-km pricing

-- Add revenue_type column with default 'per_load'
ALTER TABLE trips ADD COLUMN
IF NOT EXISTS revenue_type TEXT DEFAULT 'per_load';

-- Add rate_per_km column for storing the rate when revenue_type is 'per_km'
ALTER TABLE trips ADD COLUMN
IF NOT EXISTS rate_per_km NUMERIC;

-- Add a check constraint to ensure valid revenue_type values
ALTER TABLE trips ADD CONSTRAINT trips_revenue_type_check
  CHECK (revenue_type IN ('per_load', 'per_km'))
NOT VALID;

-- Validate the constraint for existing rows (allows migration to succeed even with old data)
ALTER TABLE trips VALIDATE CONSTRAINT trips_revenue_type_check;

-- Update existing trips with 'per_load' if null
UPDATE trips SET revenue_type = 'per_load' WHERE revenue_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN trips.revenue_type IS 'Type of revenue calculation: per_load (fixed rate) or per_km (rate multiplied by distance)';
COMMENT ON COLUMN trips.rate_per_km IS 'Rate per kilometer used when revenue_type is per_km';
