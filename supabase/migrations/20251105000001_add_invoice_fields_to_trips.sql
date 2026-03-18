-- ============================================================================
-- ADD INVOICE FIELDS TO TRIPS TABLE
-- ============================================================================
-- Adds invoice-related fields to support the invoicing workflow

BEGIN;

-- Add invoice-related fields to trips table
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS invoice_date DATE,
  ADD COLUMN IF NOT EXISTS invoice_due_date DATE,
  ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS invoice_currency TEXT DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS invoice_terms_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_method TEXT,
  ADD COLUMN IF NOT EXISTS last_follow_up_date DATE;

-- Add indexes for invoice queries
CREATE INDEX IF NOT EXISTS idx_trips_invoice_date ON public.trips(invoice_date) WHERE invoice_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_invoice_due_date ON public.trips(invoice_due_date) WHERE invoice_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_payment_status ON public.trips(payment_status);
CREATE INDEX IF NOT EXISTS idx_trips_follow_up_date ON public.trips(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Add check constraint for valid currencies
ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_invoice_currency_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_invoice_currency_check
  CHECK (invoice_currency IN ('ZAR', 'USD'));

-- Add check constraint for valid follow-up methods
ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_follow_up_method_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_follow_up_method_check
  CHECK (follow_up_method IN ('email', 'phone', 'sms', 'whatsapp', NULL));

-- Add comments for documentation
COMMENT ON COLUMN public.trips.invoice_date IS 'Date when the invoice was issued';
COMMENT ON COLUMN public.trips.invoice_due_date IS 'Date when payment is due';
COMMENT ON COLUMN public.trips.invoice_amount IS 'Total invoice amount (may differ from payment_amount due to adjustments)';
COMMENT ON COLUMN public.trips.invoice_currency IS 'Currency for invoice amount (ZAR or USD)';
COMMENT ON COLUMN public.trips.invoice_terms_days IS 'Payment terms in days (default 30)';
COMMENT ON COLUMN public.trips.follow_up_date IS 'Next scheduled follow-up date';
COMMENT ON COLUMN public.trips.follow_up_notes IS 'Notes about follow-up actions';
COMMENT ON COLUMN public.trips.follow_up_method IS 'Method used for follow-up (email, phone, sms, whatsapp)';
COMMENT ON COLUMN public.trips.last_follow_up_date IS 'Date of the last follow-up action';

-- Update existing trips to set invoice_date from invoice_submitted_date
UPDATE public.trips
SET invoice_date = invoice_submitted_date
WHERE invoice_submitted_date IS NOT NULL AND invoice_date IS NULL;

-- Calculate invoice_due_date for existing trips (30 days after invoice_date)
UPDATE public.trips
SET invoice_due_date = invoice_date + INTERVAL '30 days'
WHERE invoice_date IS NOT NULL AND invoice_due_date IS NULL;

-- Set invoice_amount from payment_amount for existing trips
UPDATE public.trips
SET invoice_amount = payment_amount
WHERE payment_amount IS NOT NULL AND invoice_amount IS NULL;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Added invoice fields to trips table';
  RAISE NOTICE '📊 Fields added: invoice_date, invoice_due_date, invoice_amount, invoice_currency, invoice_terms_days';
  RAISE NOTICE '📞 Follow-up fields: follow_up_date, follow_up_notes, follow_up_method, last_follow_up_date';
  RAISE NOTICE '🔄 Migrated existing data from invoice_submitted_date and payment_amount';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Regenerate TypeScript types: npx supabase gen types typescript';
  RAISE NOTICE '2. Navigate to /invoicing in your app';
END $$;
