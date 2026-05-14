-- Add created_by column to trips table to track which user added a trip.
-- Stored as text (display name / email) to be consistent with completed_by,
-- additional_revenue_verified_by, and verified_no_costs_by which are all text.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS created_by text;

COMMENT ON COLUMN trips.created_by IS 'Display name or email of the user who created the trip';

CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);
