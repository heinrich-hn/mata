-- Create enum types
CREATE TYPE vehicle_type AS ENUM ('rigid_truck', 'horse_truck', 'refrigerated_truck');
CREATE TYPE tyre_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'replace');
CREATE TYPE tyre_position AS ENUM ('front_left', 'front_right', 'rear_left_outer', 'rear_left_inner', 'rear_right_outer', 'rear_right_inner', 'spare');
CREATE TYPE tyre_wear_pattern AS ENUM ('even', 'center', 'edge', 'cupping', 'feathering');

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  vehicle_type vehicle_type NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  engine_specs TEXT,
  tonnage INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tyre inventory (unmounted tyres in stock)
CREATE TABLE public.tyre_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  size TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 5,
  unit_price DECIMAL(10,2),
  supplier TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tyres (individual tyre records)
CREATE TABLE public.tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  size TEXT NOT NULL,
  type TEXT NOT NULL,
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  current_tread_depth DECIMAL(4,2),
  initial_tread_depth DECIMAL(4,2),
  km_travelled INTEGER DEFAULT 0,
  condition tyre_condition DEFAULT 'excellent',
  notes TEXT,
  inventory_id UUID REFERENCES public.tyre_inventory(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tyre positions (track which tyre is mounted where)
CREATE TABLE public.tyre_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  tyre_id UUID REFERENCES public.tyres(id) ON DELETE SET NULL,
  position tyre_position NOT NULL,
  mounted_at TIMESTAMPTZ DEFAULT now(),
  dismounted_at TIMESTAMPTZ,
  km_at_mount INTEGER,
  km_at_dismount INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tyre inspections
CREATE TABLE public.tyre_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  tyre_id UUID REFERENCES public.tyres(id) ON DELETE CASCADE,
  position tyre_position NOT NULL,
  inspection_date TIMESTAMPTZ DEFAULT now(),
  tread_depth DECIMAL(4,2),
  pressure DECIMAL(5,2),
  condition tyre_condition NOT NULL,
  wear_pattern tyre_wear_pattern,
  notes TEXT,
  inspector_name TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tyre performance metrics
CREATE TABLE public.tyre_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tyre_id UUID REFERENCES public.tyres(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  measurement_date DATE DEFAULT CURRENT_DATE,
  km_travelled INTEGER,
  tread_wear_rate DECIMAL(6,4),
  cost_per_km DECIMAL(8,4),
  estimated_remaining_km INTEGER,
  replacement_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyre_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyre_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyre_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyre_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all authenticated users for now - can be refined later with roles)
CREATE POLICY "Allow authenticated users to view vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage vehicles"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view tyre inventory"
  ON public.tyre_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage tyre inventory"
  ON public.tyre_inventory FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view tyres"
  ON public.tyres FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage tyres"
  ON public.tyres FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view tyre positions"
  ON public.tyre_positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage tyre positions"
  ON public.tyre_positions FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view tyre inspections"
  ON public.tyre_inspections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage tyre inspections"
  ON public.tyre_inspections FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view tyre performance"
  ON public.tyre_performance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage tyre performance"
  ON public.tyre_performance FOR ALL
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_vehicles_registration ON public.vehicles(registration_number);
CREATE INDEX idx_vehicles_type ON public.vehicles(vehicle_type);
CREATE INDEX idx_tyres_serial ON public.tyres(serial_number);
CREATE INDEX idx_tyres_condition ON public.tyres(condition);
CREATE INDEX idx_tyre_positions_vehicle ON public.tyre_positions(vehicle_id);
CREATE INDEX idx_tyre_positions_tyre ON public.tyre_positions(tyre_id);
CREATE INDEX idx_tyre_positions_active ON public.tyre_positions(active);
CREATE INDEX idx_tyre_inspections_vehicle ON public.tyre_inspections(vehicle_id);
CREATE INDEX idx_tyre_inspections_date ON public.tyre_inspections(inspection_date);
CREATE INDEX idx_tyre_performance_tyre ON public.tyre_performance(tyre_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tyre_inventory_updated_at BEFORE UPDATE ON public.tyre_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tyres_updated_at BEFORE UPDATE ON public.tyres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial fleet data
INSERT INTO public.vehicles (registration_number, vehicle_type, make, model, engine_specs, tonnage) VALUES
('1H ACO8468', 'rigid_truck', 'UD', 'UD90', '8-Ton', 8),
('6H ABJ3739', 'rigid_truck', 'Scania', 'H93', '8-Ton', 8),
('4H AGZ1286', 'rigid_truck', 'Scania', 'H93', '8-Ton', 8),
('29H AGJ3466', 'rigid_truck', 'SINOTRUK', 'HOWA', 'Rigid Truck', NULL),
('32H JFK964FS', 'horse_truck', 'Shacman', 'X3000', 'Cummins 450HP', NULL),
('31H AGZ1963', 'horse_truck', 'Shacman', 'X3000', '450HP', NULL),
('30H AGL4216', 'refrigerated_truck', 'SINOTRUK', 'HOWA', '10-Ton', 10),
('24H AFQ1325', 'horse_truck', 'Shacman', 'X3000', '420HP', NULL),
('33H JFK963FS', 'horse_truck', 'Shacman', 'X3000', '450HP', NULL),
('23H AFQ1324', 'horse_truck', 'Shacman', 'X3000', '420HP', NULL),
('26H AFQ1327', 'horse_truck', 'Shacman', 'X3000', '420HP', NULL),
('28H AFQ1329', 'horse_truck', 'Shacman', 'X3000', NULL, NULL),
('22H ADS4866', 'horse_truck', 'Scania', 'G460', NULL, NULL),
('21H ADS4865', 'horse_truck', 'Scania', 'G460', NULL, NULL);

-- Insert sample tyre inventory
INSERT INTO public.tyre_inventory (brand, model, size, type, quantity, min_quantity, unit_price, supplier) VALUES
('Michelin', 'XZA2', '315/80R22.5', 'All Position', 12, 5, 5500.00, 'Tyre City'),
('Bridgestone', 'R297', '315/80R22.5', 'Drive', 8, 5, 5200.00, 'Tyre City'),
('Continental', 'HSR2', '315/80R22.5', 'Steer', 10, 5, 4800.00, 'Continental Depot'),
('Goodyear', 'KMAX S', '385/65R22.5', 'Steer', 6, 3, 6200.00, 'Goodyear Hub'),
('Dunlop', 'SP346', '315/80R22.5', 'Drive', 5, 5, 4900.00, 'Tyre World'),
('Pirelli', 'TR01', '385/65R22.5', 'Trailer', 15, 8, 5800.00, 'Pirelli Centre'),
('Yokohama', 'TY517', '295/80R22.5', 'All Position', 4, 5, 4500.00, 'Yokohama Distributors');
