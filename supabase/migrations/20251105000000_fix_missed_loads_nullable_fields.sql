-- ============================================================================
-- FIX MISSED LOADS TABLE - MAKE REQUIRED FIELDS NULLABLE
-- ============================================================================
-- The missed_loads table had several NOT NULL constraints that don't match
-- the actual usage in the application. This migration makes these fields
-- nullable to allow flexible record creation.

BEGIN;

-- Make load_reference nullable (currently required but often not known at time of entry)
ALTER TABLE public.missed_loads 
  ALTER COLUMN load_reference DROP NOT NULL;

-- Make client_name nullable (app uses customer_name instead)
ALTER TABLE public.missed_loads 
  ALTER COLUMN client_name DROP NOT NULL;

-- Make scheduled_date nullable (app uses requested_pickup_date and requested_delivery_date)
ALTER TABLE public.missed_loads 
  ALTER COLUMN scheduled_date DROP NOT NULL;

-- Make missed_date nullable (app uses recorded_at timestamp)
ALTER TABLE public.missed_loads 
  ALTER COLUMN missed_date DROP NOT NULL;

-- Add comment explaining the schema flexibility
COMMENT ON COLUMN public.missed_loads.load_reference IS 'Optional reference number for the missed load. May not be available at time of initial entry.';
COMMENT ON COLUMN public.missed_loads.client_name IS 'Optional legacy field. New entries use customer_name field instead.';
COMMENT ON COLUMN public.missed_loads.scheduled_date IS 'Optional legacy field. New entries use requested_pickup_date and requested_delivery_date.';
COMMENT ON COLUMN public.missed_loads.missed_date IS 'Optional legacy field. New entries use recorded_at timestamp.';

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed missed_loads table constraints';
  RAISE NOTICE '📝 Made load_reference, client_name, scheduled_date, missed_date nullable';
  RAISE NOTICE '💡 This allows flexible record creation matching the application UI';
END $$;
