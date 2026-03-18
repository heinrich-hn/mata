-- Add columns to trips table for enhanced trip management

-- Add edit history tracking
ALTER TABLE trips ADD COLUMN IF NOT EXISTS edit_history jsonb DEFAULT '[]'::jsonb;

-- Add trip timeline tracking
ALTER TABLE trips ADD COLUMN IF NOT EXISTS planned_departure_date timestamp with time zone;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS planned_arrival_date timestamp with time zone;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS actual_departure_date timestamp with time zone;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS actual_arrival_date timestamp with time zone;

-- Add revenue tracking
ALTER TABLE trips ADD COLUMN IF NOT EXISTS base_revenue numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS revenue_currency text DEFAULT 'ZAR';

-- Add trip route and description
ALTER TABLE trips ADD COLUMN IF NOT EXISTS route text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS description text;

-- Add invoice tracking
ALTER TABLE trips ADD COLUMN IF NOT EXISTS invoice_attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS validation_notes text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS final_invoice_amount numeric;

-- Create trip_deletions table for audit trail
CREATE TABLE IF NOT EXISTS trip_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  trip_number text NOT NULL,
  deleted_by text NOT NULL,
  deleted_at timestamp with time zone DEFAULT now(),
  deletion_reason text NOT NULL,
  confirmation_text text NOT NULL,
  trip_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on trip_deletions
ALTER TABLE trip_deletions ENABLE ROW LEVEL SECURITY;

-- Create policy for trip_deletions
CREATE POLICY "Allow authenticated users to manage trip deletions"
ON trip_deletions
FOR ALL
USING (true);

CREATE POLICY "Allow authenticated users to view trip deletions"
ON trip_deletions
FOR SELECT
USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_completed_at ON trips(completed_at);
CREATE INDEX IF NOT EXISTS idx_trip_deletions_trip_id ON trip_deletions(trip_id);