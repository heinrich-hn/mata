-- ============================================================================
-- Fleet breakdowns table for Main App (Dashboard)
-- Receives breakdowns sent from Load Planner for inspection scheduling
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fleet_breakdowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source reference
    source_app TEXT NOT NULL DEFAULT 'loadplanner',
    source_breakdown_id UUID,
    source_breakdown_number TEXT,

    -- Vehicle info (may not match main app vehicle IDs since different DBs)
    vehicle_registration TEXT,
    vehicle_fleet_number TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,

    -- Driver info
    driver_name TEXT,

    -- Breakdown details
    breakdown_date TIMESTAMPTZ NOT NULL,
    location TEXT,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category TEXT NOT NULL DEFAULT 'mechanical' CHECK (category IN ('mechanical', 'electrical', 'tyre', 'engine', 'transmission', 'brakes', 'cooling', 'fuel_system', 'other')),

    -- Load / trip reference
    load_number TEXT,

    -- Status in main app workflow
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'scheduled_for_inspection', 'inspection_created', 'resolved', 'dismissed')),
    
    -- Linked inspection / job card
    linked_inspection_id UUID,
    linked_job_card_id UUID,

    -- Notes from workshop
    workshop_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for pending review items
CREATE INDEX IF NOT EXISTS idx_fleet_breakdowns_status ON public.fleet_breakdowns(status);

-- Index for vehicle lookup
CREATE INDEX IF NOT EXISTS idx_fleet_breakdowns_vehicle_id ON public.fleet_breakdowns(vehicle_id);

-- Index for source dedup
CREATE INDEX IF NOT EXISTS idx_fleet_breakdowns_source ON public.fleet_breakdowns(source_breakdown_id) WHERE source_breakdown_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.fleet_breakdowns ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can manage fleet breakdowns"
    ON public.fleet_breakdowns
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_fleet_breakdowns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fleet_breakdowns_updated_at
    BEFORE UPDATE ON public.fleet_breakdowns
    FOR EACH ROW
    EXECUTE FUNCTION update_fleet_breakdowns_updated_at();
