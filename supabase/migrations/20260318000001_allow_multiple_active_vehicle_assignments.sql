-- ============================================================================
-- Allow multiple active vehicle assignments per driver (truck + reefer/trailer)
-- ============================================================================
-- Previously: UNIQUE ON (driver_id) WHERE is_active = true
--   → Only one active assignment per driver (no reefer support)
-- Now: UNIQUE ON (driver_id, vehicle_id) WHERE is_active = true
--   → Multiple active assignments per driver, but no duplicate vehicle
-- ============================================================================

-- Drop the old constraint that only allowed one active assignment per driver
DROP INDEX IF EXISTS idx_driver_vehicle_assignments_unique_active_driver;

-- New constraint: one active assignment per driver-vehicle pair
-- This allows a driver to have both a truck AND a reefer/trailer assigned
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_vehicle_assignments_unique_active_driver_vehicle
    ON public.driver_vehicle_assignments(driver_id, vehicle_id)
    WHERE is_active = true;
