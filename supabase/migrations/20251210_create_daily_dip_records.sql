-- Daily Dip Records Table for Diesel Bunker Reconciliation
-- Tracks daily tank measurements and pump meter readings to reconcile fuel usage

CREATE TABLE IF NOT EXISTS public.daily_dip_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bunker_id UUID NOT NULL REFERENCES public.fuel_bunkers(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,

    -- Opening readings (Start of Day)
    opening_dip_cm NUMERIC(10, 2),           -- Dipstick measurement in centimeters
    opening_volume_liters NUMERIC(12, 2) NOT NULL,  -- A: Volume in liters (converted from dip or entered directly)
    opening_pump_reading NUMERIC(15, 3),     -- D: Pump totalizer reading at start

    -- Closing readings (End of Day)
    closing_dip_cm NUMERIC(10, 2),           -- Dipstick measurement in centimeters
    closing_volume_liters NUMERIC(12, 2),    -- B: Volume in liters (converted from dip or entered directly)
    closing_pump_reading NUMERIC(15, 3),     -- E: Pump totalizer reading at end

    -- Calculated values (computed when closing record)
    tank_usage_liters NUMERIC(12, 2),        -- C = A - B: Physical fuel depletion from tank
    pump_issued_liters NUMERIC(12, 2),       -- F = E - D: Fuel dispensed per pump meter
    variance_liters NUMERIC(12, 2),          -- G = C - F: Discrepancy (negative = expansion, positive = potential loss)

    -- Metadata
    recorded_by TEXT,                         -- Person who recorded the readings
    notes TEXT,                               -- Any notes or observations
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reconciled')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one record per bunker per date
    UNIQUE(bunker_id, record_date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_dip_records_bunker_id ON public.daily_dip_records(bunker_id);
CREATE INDEX IF NOT EXISTS idx_daily_dip_records_record_date ON public.daily_dip_records(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_dip_records_status ON public.daily_dip_records(status);
CREATE INDEX IF NOT EXISTS idx_daily_dip_records_variance ON public.daily_dip_records(variance_liters) WHERE variance_liters IS NOT NULL;

-- Enable RLS
ALTER TABLE public.daily_dip_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy for authenticated users
CREATE POLICY "Authenticated users can manage dip records"
    ON public.daily_dip_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dip_record_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dip_record_timestamp
    BEFORE UPDATE ON public.daily_dip_records
    FOR EACH ROW
    EXECUTE FUNCTION update_dip_record_timestamp();

-- Comment on table
COMMENT ON TABLE public.daily_dip_records IS 'Daily dip records for fuel bunker reconciliation - tracks tank levels vs pump meter readings';
COMMENT ON COLUMN public.daily_dip_records.tank_usage_liters IS 'C = A - B: Physical fuel removed from tank based on dip measurements';
COMMENT ON COLUMN public.daily_dip_records.pump_issued_liters IS 'F = E - D: Fuel dispensed according to pump meter';
COMMENT ON COLUMN public.daily_dip_records.variance_liters IS 'G = C - F: Difference between tank loss and pump records. Negative = thermal expansion, Positive = potential loss/theft';
