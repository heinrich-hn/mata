-- Migration: Add wialon_id column to vehicles table
-- Date: 2025-11-12
-- Purpose: Link vehicle records to Wialon GPS tracking units

-- Add wialon_id column to vehicles table
ALTER TABLE vehicles
ADD COLUMN
IF NOT EXISTS wialon_id BIGINT;

-- Add index for faster lookups by wialon_id
CREATE INDEX
IF NOT EXISTS idx_vehicles_wialon_id
ON vehicles
(wialon_id)
WHERE wialon_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN vehicles.wialon_id IS 'Wialon unit ID for GPS tracking integration. Links to Wialon tracking system units.';

-- Note: This column is nullable because not all vehicles may have GPS tracking units
-- Update existing vehicles with their Wialon IDs manually or via data import
