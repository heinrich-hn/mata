-- Migration: Create route_predefined_expenses tables
-- Stores pre-defined expenses that can be automatically added when capturing trip costs

-- Main table for route configurations
CREATE TABLE IF NOT EXISTS route_expense_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT route_expense_configs_route_unique UNIQUE (route)
);

-- Table for individual expenses within a route configuration
CREATE TABLE IF NOT EXISTS route_expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_config_id UUID NOT NULL REFERENCES route_expense_configs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'ZAR')),
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_expense_configs_route ON route_expense_configs(route);
CREATE INDEX IF NOT EXISTS idx_route_expense_configs_active ON route_expense_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_route_expense_items_config_id ON route_expense_items(route_config_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_route_expense_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_route_expense_configs_updated ON route_expense_configs;
CREATE TRIGGER trigger_route_expense_configs_updated
  BEFORE UPDATE ON route_expense_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_route_expense_timestamp();

DROP TRIGGER IF EXISTS trigger_route_expense_items_updated ON route_expense_items;
CREATE TRIGGER trigger_route_expense_items_updated
  BEFORE UPDATE ON route_expense_items
  FOR EACH ROW
  EXECUTE FUNCTION update_route_expense_timestamp();

-- Enable RLS
ALTER TABLE route_expense_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_expense_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
DROP POLICY IF EXISTS "Allow authenticated read route_expense_configs" ON route_expense_configs;
CREATE POLICY "Allow authenticated read route_expense_configs" ON route_expense_configs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert route_expense_configs" ON route_expense_configs;
CREATE POLICY "Allow authenticated insert route_expense_configs" ON route_expense_configs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update route_expense_configs" ON route_expense_configs;
CREATE POLICY "Allow authenticated update route_expense_configs" ON route_expense_configs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete route_expense_configs" ON route_expense_configs;
CREATE POLICY "Allow authenticated delete route_expense_configs" ON route_expense_configs
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read route_expense_items" ON route_expense_items;
CREATE POLICY "Allow authenticated read route_expense_items" ON route_expense_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert route_expense_items" ON route_expense_items;
CREATE POLICY "Allow authenticated insert route_expense_items" ON route_expense_items
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update route_expense_items" ON route_expense_items;
CREATE POLICY "Allow authenticated update route_expense_items" ON route_expense_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete route_expense_items" ON route_expense_items;
CREATE POLICY "Allow authenticated delete route_expense_items" ON route_expense_items
  FOR DELETE TO authenticated USING (true);

-- Insert default route configurations
INSERT INTO route_expense_configs (route, description, is_active) VALUES
  ('CBC - BV', 'Chirundu Border to Beitbridge via Harare', true),
  ('BV - HRE', 'Beitbridge to Harare', true),
  ('HRE - BV', 'Harare to Beitbridge', true),
  ('BV - BYO', 'Beitbridge to Bulawayo', true),
  ('BYO - BV', 'Bulawayo to Beitbridge', true),
  ('BYO - CBC', 'Bulawayo to Chirundu Border', true),
  ('CBC - BYO', 'Chirundu Border to Bulawayo', true),
  ('HRE - MUTARE', 'Harare to Mutare', true),
  ('MUTARE - HRE', 'Mutare to Harare', true),
  ('BYO - VICFALLS', 'Bulawayo to Victoria Falls', true)
ON CONFLICT (route) DO NOTHING;

-- Insert default expense items for each route
-- CBC - BV
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 15, 'USD', true, 1 FROM route_expense_configs WHERE route = 'CBC - BV'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Harare', 5, 'USD', false, 2 FROM route_expense_configs WHERE route = 'CBC - BV'
ON CONFLICT DO NOTHING;

-- BV - HRE
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 60, 'USD', true, 1 FROM route_expense_configs WHERE route = 'BV - HRE'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Border Costs', 'Beitbridge Border Fee', 25, 'USD', true, 2 FROM route_expense_configs WHERE route = 'BV - HRE'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Border Costs', 'Gate Pass', 10, 'USD', false, 3 FROM route_expense_configs WHERE route = 'BV - HRE'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Harare', 5, 'USD', false, 4 FROM route_expense_configs WHERE route = 'BV - HRE'
ON CONFLICT DO NOTHING;

-- HRE - BV
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 60, 'USD', true, 1 FROM route_expense_configs WHERE route = 'HRE - BV'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Beitbridge', 8, 'USD', false, 2 FROM route_expense_configs WHERE route = 'HRE - BV'
ON CONFLICT DO NOTHING;

-- BV - BYO
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 80, 'USD', true, 1 FROM route_expense_configs WHERE route = 'BV - BYO'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Border Costs', 'Beitbridge Border Fee', 25, 'USD', true, 2 FROM route_expense_configs WHERE route = 'BV - BYO'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Bulawayo', 5, 'USD', false, 3 FROM route_expense_configs WHERE route = 'BV - BYO'
ON CONFLICT DO NOTHING;

-- BYO - BV
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 75, 'USD', true, 1 FROM route_expense_configs WHERE route = 'BYO - BV'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Beitbridge', 8, 'USD', false, 2 FROM route_expense_configs WHERE route = 'BYO - BV'
ON CONFLICT DO NOTHING;

-- BYO - CBC
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 60, 'USD', true, 1 FROM route_expense_configs WHERE route = 'BYO - CBC'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Harare', 5, 'USD', false, 2 FROM route_expense_configs WHERE route = 'BYO - CBC'
ON CONFLICT DO NOTHING;

-- CBC - BYO
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 60, 'USD', true, 1 FROM route_expense_configs WHERE route = 'CBC - BYO'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Border Costs', 'Road Access', 15, 'USD', false, 2 FROM route_expense_configs WHERE route = 'CBC - BYO'
ON CONFLICT DO NOTHING;

-- HRE - MUTARE
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 35, 'USD', true, 1 FROM route_expense_configs WHERE route = 'HRE - MUTARE'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Mutare', 5, 'USD', false, 2 FROM route_expense_configs WHERE route = 'HRE - MUTARE'
ON CONFLICT DO NOTHING;

-- MUTARE - HRE
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 35, 'USD', true, 1 FROM route_expense_configs WHERE route = 'MUTARE - HRE'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Harare', 5, 'USD', false, 2 FROM route_expense_configs WHERE route = 'MUTARE - HRE'
ON CONFLICT DO NOTHING;

-- BYO - VICFALLS
INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Tolls', 'Route Toll Fee', 30, 'USD', true, 1 FROM route_expense_configs WHERE route = 'BYO - VICFALLS'
ON CONFLICT DO NOTHING;

INSERT INTO route_expense_items (route_config_id, category, sub_category, amount, currency, is_required, display_order)
SELECT id, 'Parking', 'Victoria Falls', 10, 'USD', false, 2 FROM route_expense_configs WHERE route = 'BYO - VICFALLS'
ON CONFLICT DO NOTHING;
