-- Migration: Create route_toll_costs table for managing predefined route toll fees
-- This table stores routes with their default toll costs that can be edited
-- Changes only affect future trips, historical costs remain unchanged

CREATE TABLE IF NOT EXISTS route_toll_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL UNIQUE,
  toll_fee DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'ZAR')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_route_toll_costs_route ON route_toll_costs(route);
CREATE INDEX IF NOT EXISTS idx_route_toll_costs_active ON route_toll_costs(is_active);

-- Enable RLS
ALTER TABLE route_toll_costs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users" ON route_toll_costs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON route_toll_costs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON route_toll_costs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users" ON route_toll_costs
  FOR DELETE TO authenticated USING (true);

-- Insert default route toll costs
INSERT INTO route_toll_costs (route, toll_fee, currency, description) VALUES
  ('CBC - BV', 15, 'USD', 'Chirundu Border to Beitbridge'),
  ('BV - HRE', 60, 'USD', 'Beitbridge to Harare'),
  ('CHIPINGE - HRE', 75, 'USD', 'Chipinge to Harare'),
  ('BV - BYO', 80, 'USD', 'Beitbridge to Bulawayo'),
  ('BYO - CBC', 60, 'USD', 'Bulawayo to Chirundu Border'),
  ('BYO - VICFALLS', 30, 'USD', 'Bulawayo to Victoria Falls'),
  ('BYO - BV', 75, 'USD', 'Bulawayo to Beitbridge'),
  ('CBC - BYO', 60, 'USD', 'Chirundu Border to Bulawayo'),
  ('HRE - NYANGA', 40, 'USD', 'Harare to Nyanga'),
  ('HRE - MARONDERA', 20, 'USD', 'Harare to Marondera')
ON CONFLICT (route) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_route_toll_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER route_toll_costs_updated_at
  BEFORE UPDATE ON route_toll_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_route_toll_costs_updated_at();

-- Grant necessary permissions
GRANT ALL ON route_toll_costs TO authenticated;
GRANT ALL ON route_toll_costs TO anon;
