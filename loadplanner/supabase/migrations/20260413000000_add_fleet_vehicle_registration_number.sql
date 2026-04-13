-- Add registration_number column to fleet_vehicles table
-- Separate from vehicle_id which is the fleet identifier used across apps
ALTER TABLE public.fleet_vehicles ADD COLUMN
IF NOT EXISTS registration_number TEXT;
