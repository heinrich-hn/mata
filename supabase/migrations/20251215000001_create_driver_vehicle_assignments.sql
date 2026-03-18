-- ============================================================================
-- DRIVER VEHICLE ASSIGNMENTS
-- ============================================================================
-- Links drivers to specific vehicles for:
--   • Load pushing to driver devices
--   • Diesel logging per vehicle
--   • Vehicle-specific reporting
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: driver_vehicle_assignments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_vehicle_assignments (
    -- Primary Key
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    driver_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vehicle_id      UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,

    -- Assignment Details
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at   TIMESTAMPTZ,
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    notes           TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

-- Fast lookup: Find active assignment for a driver
CREATE INDEX IF NOT EXISTS idx_driver_vehicle_assignments_driver_active
    ON public.driver_vehicle_assignments(driver_id, is_active)
    WHERE is_active = true;

-- Fast lookup: Find active assignment for a vehicle
CREATE INDEX IF NOT EXISTS idx_driver_vehicle_assignments_vehicle_active
    ON public.driver_vehicle_assignments(vehicle_id, is_active)
    WHERE is_active = true;

-- Constraint: Only one active assignment per driver
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_vehicle_assignments_unique_active_driver
    ON public.driver_vehicle_assignments(driver_id)
    WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own assignments
CREATE POLICY "Users can view their own vehicle assignments"
    ON public.driver_vehicle_assignments
    FOR SELECT
    TO authenticated
    USING (driver_id = auth.uid());

-- Policy: Users can create their own assignments
CREATE POLICY "Users can create their own vehicle assignments"
    ON public.driver_vehicle_assignments
    FOR INSERT
    TO authenticated
    WITH CHECK (driver_id = auth.uid());

-- Policy: Users can update their own assignments (for unassigning)
CREATE POLICY "Users can update their own vehicle assignments"
    ON public.driver_vehicle_assignments
    FOR UPDATE
    TO authenticated
    USING (driver_id = auth.uid())
    WITH CHECK (driver_id = auth.uid());

-- ----------------------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------------------

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_vehicle_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_vehicle_assignments_updated_at
    BEFORE UPDATE ON public.driver_vehicle_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_vehicle_assignments_updated_at();

-- ----------------------------------------------------------------------------
-- REALTIME
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_vehicle_assignments;

-- ----------------------------------------------------------------------------
-- DOCUMENTATION
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.driver_vehicle_assignments
    IS 'Links drivers to their assigned vehicles for load management and diesel tracking';

COMMENT ON COLUMN public.driver_vehicle_assignments.driver_id
    IS 'The driver (auth.users) assigned to the vehicle';

COMMENT ON COLUMN public.driver_vehicle_assignments.vehicle_id
    IS 'The vehicle assigned to the driver';

COMMENT ON COLUMN public.driver_vehicle_assignments.is_active
    IS 'Whether this assignment is currently active';

COMMENT ON COLUMN public.driver_vehicle_assignments.unassigned_at
    IS 'When the assignment was deactivated';
