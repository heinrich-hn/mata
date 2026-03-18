-- Add missing fields to diesel_records table
ALTER TABLE diesel_records
ADD COLUMN IF NOT EXISTS probe_reading NUMERIC,
ADD COLUMN IF NOT EXISTS probe_discrepancy NUMERIC,
ADD COLUMN IF NOT EXISTS probe_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS probe_verification_notes TEXT,
ADD COLUMN IF NOT EXISTS probe_verified_by TEXT,
ADD COLUMN IF NOT EXISTS probe_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS probe_action_taken TEXT,
ADD COLUMN IF NOT EXISTS probe_attachments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS previous_km_reading INTEGER,
ADD COLUMN IF NOT EXISTS distance_travelled INTEGER,
ADD COLUMN IF NOT EXISTS km_per_litre NUMERIC,
ADD COLUMN IF NOT EXISTS debrief_signed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS signed_by TEXT,
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;

-- Create diesel_norms table for fleet efficiency standards
CREATE TABLE IF NOT EXISTS diesel_norms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_number TEXT NOT NULL UNIQUE,
  expected_km_per_litre NUMERIC NOT NULL,
  tolerance_percentage NUMERIC NOT NULL DEFAULT 10,
  min_acceptable NUMERIC NOT NULL,
  max_acceptable NUMERIC NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on diesel_norms
ALTER TABLE diesel_norms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for diesel_norms
CREATE POLICY "Allow authenticated users to view diesel norms"
  ON diesel_norms FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage diesel norms"
  ON diesel_norms FOR ALL
  USING (true);

-- Create trigger for diesel_norms updated_at
CREATE TRIGGER update_diesel_norms_updated_at
  BEFORE UPDATE ON diesel_norms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default norms for common fleet numbers
INSERT INTO diesel_norms (fleet_number, expected_km_per_litre, tolerance_percentage, min_acceptable, max_acceptable, updated_by)
VALUES 
  ('4H', 3.5, 10, 3.15, 3.85, 'System Default'),
  ('6H', 3.2, 10, 2.88, 3.52, 'System Default'),
  ('21H', 3.0, 10, 2.7, 3.3, 'System Default'),
  ('22H', 3.0, 10, 2.7, 3.3, 'System Default'),
  ('23H', 3.0, 10, 2.7, 3.3, 'System Default'),
  ('24H', 2.9, 10, 2.61, 3.19, 'System Default'),
  ('26H', 3.5, 10, 3.15, 3.85, 'System Default'),
  ('28H', 3.3, 10, 2.97, 3.63, 'System Default'),
  ('29H', 3.2, 10, 2.88, 3.52, 'System Default'),
  ('30H', 3.1, 10, 2.79, 3.41, 'System Default'),
  ('31H', 3.0, 10, 2.7, 3.3, 'System Default'),
  ('32H', 3.2, 10, 2.88, 3.52, 'System Default'),
  ('33H', 3.1, 10, 2.79, 3.41, 'System Default'),
  ('UD', 2.8, 15, 2.38, 3.22, 'System Default')
ON CONFLICT (fleet_number) DO NOTHING;