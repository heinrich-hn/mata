-- Add verification ("tick") fields for third-party / additional revenue on trips.
-- When additional_revenue is recorded with a reason, ops can mark it verified.
-- Unverified additional revenue is reported as "Funny Money".

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS additional_revenue_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS additional_revenue_verified_by TEXT,
  ADD COLUMN IF NOT EXISTS additional_revenue_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN trips.additional_revenue_verified IS 'Whether the third-party / additional revenue has been verified (ticked) by ops. Unverified = "Funny Money".';
COMMENT ON COLUMN trips.additional_revenue_verified_by IS 'User who verified the additional revenue.';
COMMENT ON COLUMN trips.additional_revenue_verified_at IS 'Timestamp when additional revenue was verified.';

CREATE INDEX IF NOT EXISTS idx_trips_additional_revenue_verified
  ON trips (additional_revenue_verified)
  WHERE additional_revenue IS NOT NULL AND additional_revenue > 0;
