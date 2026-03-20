-- ============================================================================
-- Breakdowns table for Load Planner app
-- Tracks truck breakdowns logged against trips/loads
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.breakdowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breakdown_number TEXT NOT NULL UNIQUE,
    load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
    fleet_vehicle_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,

    -- Breakdown details
    breakdown_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location TEXT,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category TEXT NOT NULL DEFAULT 'mechanical' CHECK (category IN ('mechanical', 'electrical', 'tyre', 'engine', 'transmission', 'brakes', 'cooling', 'fuel_system', 'other')),

    -- Resolution
    status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'assistance_dispatched', 'under_repair', 'resolved', 'towed')),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,

    -- Send to main app
    sent_to_main_app BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    main_app_breakdown_id UUID,

    -- Metadata
    reported_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by load
CREATE INDEX IF NOT EXISTS idx_breakdowns_load_id ON public.breakdowns(load_id);

-- Index for querying by vehicle
CREATE INDEX IF NOT EXISTS idx_breakdowns_fleet_vehicle_id ON public.breakdowns(fleet_vehicle_id);

-- Index for unsent breakdowns
CREATE INDEX IF NOT EXISTS idx_breakdowns_not_sent ON public.breakdowns(sent_to_main_app) WHERE sent_to_main_app = FALSE;

-- Enable RLS
ALTER TABLE public.breakdowns ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (matches existing loadplanner RLS pattern)
CREATE POLICY "Authenticated users can manage breakdowns"
    ON public.breakdowns
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_breakdowns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER breakdowns_updated_at
    BEFORE UPDATE ON public.breakdowns
    FOR EACH ROW
    EXECUTE FUNCTION update_breakdowns_updated_at();
