-- Add missing columns to tyres table
ALTER TABLE tyres 
ADD COLUMN IF NOT EXISTS installation_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS installation_km INTEGER,
ADD COLUMN IF NOT EXISTS installer_name TEXT,
ADD COLUMN IF NOT EXISTS tread_depth_health TEXT CHECK (tread_depth_health IN ('excellent', 'good', 'warning', 'critical')),
ADD COLUMN IF NOT EXISTS pressure_health TEXT CHECK (pressure_health IN ('excellent', 'good', 'warning', 'critical')),
ADD COLUMN IF NOT EXISTS last_inspection_date DATE,
ADD COLUMN IF NOT EXISTS purchase_cost_zar NUMERIC;

-- Create tyre_inspections table
CREATE TABLE IF NOT EXISTS tyre_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
  inspector_name TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  km_reading INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on tyre_inspections
ALTER TABLE tyre_inspections ENABLE ROW LEVEL SECURITY;

-- Create policies for tyre_inspections
CREATE POLICY "Authenticated users can view tyre inspections" 
  ON tyre_inspections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tyre inspections" 
  ON tyre_inspections FOR ALL TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tyre_inspections_vehicle ON tyre_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tyre_inspections_date ON tyre_inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_tyres_health ON tyres(tread_depth_health, pressure_health);
CREATE INDEX IF NOT EXISTS idx_tyres_installation ON tyres(installation_date);

-- Add trigger for updated_at on tyre_inspections
CREATE TRIGGER update_tyre_inspections_updated_at
  BEFORE UPDATE ON tyre_inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();