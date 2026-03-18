-- Add zero_revenue_comment column to trips table
-- This allows users to explain why a trip has zero revenue,
-- which modifies the missing revenue alert behavior
ALTER TABLE trips ADD COLUMN IF NOT EXISTS zero_revenue_comment TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN trips.zero_revenue_comment IS 'Optional comment explaining why a trip has zero revenue (e.g., repositioning, internal transfer, warranty trip). When present, suppresses the missing revenue alert.';
