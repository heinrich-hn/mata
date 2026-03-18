-- Migration to enhance tyre bay management
-- Adds index on position field and ensures position history tracking works for bay movements

-- Add index on position field for better query performance on bay filtering
CREATE INDEX IF NOT EXISTS idx_tyres_position ON tyres(position);

-- Add index on current_fleet_position for installed tyres queries
CREATE INDEX IF NOT EXISTS idx_tyres_current_fleet_position ON tyres(current_fleet_position);

-- Add comment for documentation
COMMENT ON COLUMN tyres.position IS 'Location/bay of the tyre when not installed on a vehicle. Values: holding-bay, retread-bay, scrap, sold, main-warehouse. NULL when installed on a vehicle.';

-- Add comment for current_fleet_position
COMMENT ON COLUMN tyres.current_fleet_position IS 'Full position string when installed on a vehicle (e.g., "33H JFK963FS-V3"). NULL when in a storage bay.';

-- Ensure tyre_position_history can handle bay movements (vehicle_id is nullable)
-- The existing schema already allows NULL vehicle_id which supports bay-to-bay movements, but let's add documentation
COMMENT ON COLUMN tyre_position_history.vehicle_id IS 'Vehicle ID for vehicle installations. NULL for bay-to-bay movements.';
COMMENT ON COLUMN tyre_position_history.fleet_position IS 'Full fleet position string for vehicle installations, or bay name for bay movements.';
COMMENT ON COLUMN tyre_position_history.from_position IS 'Previous position - can be vehicle position string or bay name.';
COMMENT ON COLUMN tyre_position_history.to_position IS 'New position - can be vehicle position string or bay name.';
COMMENT ON COLUMN tyre_position_history.action IS 'Action type: installed, removed, rotated, moved_to_bay, added_to_bay, scrapped, sold';

-- Add km_at_removal tracking if tyre was previously on a vehicle
ALTER TABLE tyres ADD COLUMN IF NOT EXISTS km_at_removal INTEGER;
COMMENT ON COLUMN tyres.km_at_removal IS 'Odometer reading when tyre was last removed from a vehicle. Used for cost/performance tracking.';

-- Add removed_from_vehicle field to track which vehicle the tyre came from
ALTER TABLE tyres ADD COLUMN IF NOT EXISTS removed_from_vehicle TEXT;
COMMENT ON COLUMN tyres.removed_from_vehicle IS 'Registration/fleet number of the vehicle the tyre was last removed from.';

-- Add removal_date field
ALTER TABLE tyres ADD COLUMN IF NOT EXISTS removal_date DATE;
COMMENT ON COLUMN tyres.removal_date IS 'Date when tyre was last removed from a vehicle.';

-- Add removal_reason field
ALTER TABLE tyres ADD COLUMN IF NOT EXISTS removal_reason TEXT;
COMMENT ON COLUMN tyres.removal_reason IS 'Reason for removal: wear, damage, rotation, puncture, scheduled_replacement, etc.';
