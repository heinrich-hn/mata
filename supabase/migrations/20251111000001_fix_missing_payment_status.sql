-- Fix missing payment_status values in existing trips
-- This addresses the issue where trips have NULL payment_status but the interface requires non-null

-- Update all trips with NULL payment_status to 'unpaid'
UPDATE public.trips
SET payment_status = 'unpaid'
WHERE payment_status IS NULL;

-- Update all trips with NULL revenue_currency to 'ZAR'
UPDATE public.trips
SET revenue_currency = 'ZAR'
WHERE revenue_currency IS NULL;

-- Update all trips with NULL status to 'active' if they don't have a status
UPDATE public.trips
SET status = 'active'
WHERE status IS NULL;

-- Add NOT NULL constraints and defaults for future records
ALTER TABLE public.trips
  ALTER COLUMN payment_status
SET
DEFAULT 'unpaid',
ALTER COLUMN revenue_currency
SET
DEFAULT 'ZAR',
ALTER COLUMN status
SET DEFAULT 'active';

-- Note: We don't add NOT NULL constraints yet to avoid breaking existing functionality
-- but we ensure all current NULL values are fixed

-- Log the changes
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
  -- Count trips that were updated
  SELECT COUNT(*)
  INTO updated_count
  FROM public.trips
  WHERE payment_status = 'unpaid' AND updated_at > NOW() - INTERVAL
  '1 minute';

RAISE NOTICE 'Updated % trips with missing payment_status', updated_count;
END $$;
