-- Add urgency_level column to parts_requests for Cash Manager prioritisation
-- Values: 'urgent', '1-week', '2-weeks', or NULL (unset)
ALTER TABLE parts_requests
  ADD COLUMN IF NOT EXISTS urgency_level TEXT
  CHECK (urgency_level IN ('urgent', '1-week', '2-weeks'));

COMMENT ON COLUMN parts_requests.urgency_level IS
  'Procurement urgency set by Cash Manager. Items set to 1-week automatically escalate to urgent after 7 days.';

-- -----------------------------------------------------------------------
-- Expand check_valid_status to include all statuses the app uses.
-- The old constraint (from 20251031000001) only had:
--   pending, approved, rejected, fulfilled, cancelled
-- But the app also sets: requested, ordered, received
-- Any UPDATE on a row whose status = 'ordered' / 'received' re-triggers the
-- constraint check and raises a violation on unrelated column updates
-- (e.g., urgency_level, vendor_id).
-- -----------------------------------------------------------------------
ALTER TABLE parts_requests
  DROP CONSTRAINT IF EXISTS check_valid_status;

ALTER TABLE parts_requests
  ADD CONSTRAINT check_valid_status
  CHECK (status IN (
    'pending',
    'requested',
    'approved',
    'ordered',
    'received',
    'fulfilled',
    'rejected',
    'cancelled'
  ));

