-- Add verified_no_costs columns to trips table
-- For marking trips that intentionally have no expenses

ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS verified_no_costs BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_no_costs_by TEXT,
ADD COLUMN IF NOT EXISTS verified_no_costs_at TIMESTAMPTZ;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_trips_verified_no_costs ON trips(verified_no_costs) WHERE verified_no_costs = FALSE;

COMMENT ON COLUMN trips.verified_no_costs IS 'True if trip has been verified as intentionally having no costs';
COMMENT ON COLUMN trips.verified_no_costs_by IS 'Email of user who verified no costs';
COMMENT ON COLUMN trips.verified_no_costs_at IS 'Timestamp when no costs was verified';
