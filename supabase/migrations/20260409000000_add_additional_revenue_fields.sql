-- Add additional revenue fields to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS additional_revenue NUMERIC;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS additional_revenue_reason TEXT;

COMMENT ON COLUMN trips.additional_revenue IS 'Additional revenue amount beyond base revenue (e.g. standing charges, dead leg, fines)';
COMMENT ON COLUMN trips.additional_revenue_reason IS 'Reason for additional revenue: standing_charges, dead_leg, fines, penalties, rit, clearing_costs, labour, other';
