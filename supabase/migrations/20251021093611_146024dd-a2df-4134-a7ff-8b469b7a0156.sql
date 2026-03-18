-- Add completion validation tracking to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS 
  completion_validation JSONB DEFAULT jsonb_build_object(
    'flags_checked_at', NULL,
    'flags_resolved_count', 0,
    'unresolved_flags_at_completion', 0,
    'validated_by', NULL
  );

-- Create function to check trip completion prerequisites
CREATE OR REPLACE FUNCTION check_trip_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate when transitioning TO completed status
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Check for unresolved flags
    IF EXISTS (
      SELECT 1 FROM cost_entries 
      WHERE trip_id = NEW.id 
      AND is_flagged = true 
      AND (investigation_status IS NULL OR investigation_status != 'resolved')
    ) THEN
      RAISE EXCEPTION 'Cannot complete trip: unresolved cost flags exist. Please resolve all flagged costs before completing the trip.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce flag resolution before completion
DROP TRIGGER IF EXISTS enforce_flag_resolution_before_completion ON trips;
CREATE TRIGGER enforce_flag_resolution_before_completion
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION check_trip_completion();

-- Create invoices table for post-completion invoice management
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoices
CREATE POLICY "Allow authenticated users to view invoices"
  ON invoices FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage invoices"
  ON invoices FOR ALL
  USING (true);

-- Create index for faster invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_trip_id ON invoices(trip_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Add updated_at trigger for invoices
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();