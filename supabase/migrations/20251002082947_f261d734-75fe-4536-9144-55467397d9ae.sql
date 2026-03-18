-- Phase 1: Tire Management System Database Enhancements

-- Create tyre_configs table for technical specifications library
CREATE TABLE IF NOT EXISTS public.tyre_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  
  -- Size specifications
  width NUMERIC NOT NULL,
  aspect_ratio NUMERIC NOT NULL,
  rim_diameter NUMERIC NOT NULL,
  metric_type TEXT DEFAULT 'metric',
  construction TEXT DEFAULT 'R',
  
  -- Performance specs
  load_index INTEGER,
  speed_rating TEXT,
  
  -- Tread specifications
  factory_tread_depth NUMERIC NOT NULL,
  minimum_tread_depth NUMERIC NOT NULL,
  life_expectancy INTEGER,
  
  -- Pressure specs
  recommended_pressure NUMERIC,
  max_pressure NUMERIC,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create axle_configurations table for vehicle axle tracking
CREATE TABLE IF NOT EXISTS public.axle_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  axle_number INTEGER NOT NULL,
  axle_type TEXT NOT NULL CHECK (axle_type IN ('steer', 'drive', 'trailer')),
  position_count INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create tyre_positions_detailed table for granular position tracking
CREATE TABLE IF NOT EXISTS public.tyre_positions_detailed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  axle_config_id UUID REFERENCES public.axle_configurations(id) ON DELETE SET NULL,
  position_code TEXT NOT NULL,
  position_label TEXT NOT NULL,
  current_tyre_id UUID REFERENCES public.tyres(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vehicle_id, position_code)
);

-- Extend tyres table with new fields
ALTER TABLE public.tyres
  ADD COLUMN IF NOT EXISTS tin TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS tyre_config_id UUID REFERENCES public.tyre_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS part_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS axle_config_id UUID REFERENCES public.axle_configurations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_meter INTEGER,
  ADD COLUMN IF NOT EXISTS tread_depth_health TEXT DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS pressure_health TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS last_inspection_date DATE,
  ADD COLUMN IF NOT EXISTS rotation_due_date DATE,
  ADD COLUMN IF NOT EXISTS replacement_due_km INTEGER;

-- Extend tyre_inventory table
ALTER TABLE public.tyre_inventory
  ADD COLUMN IF NOT EXISTS tyre_config_id UUID REFERENCES public.tyre_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS part_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
  ADD COLUMN IF NOT EXISTS warranty_km INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tyres_tin ON public.tyres(tin);
CREATE INDEX IF NOT EXISTS idx_tyres_part_id ON public.tyres(part_id);
CREATE INDEX IF NOT EXISTS idx_tyres_axle_config_id ON public.tyres(axle_config_id);
CREATE INDEX IF NOT EXISTS idx_tyres_tyre_config_id ON public.tyres(tyre_config_id);
CREATE INDEX IF NOT EXISTS idx_tyres_health ON public.tyres(tread_depth_health, pressure_health);
CREATE INDEX IF NOT EXISTS idx_tyre_inventory_qr_code ON public.tyre_inventory(qr_code);
CREATE INDEX IF NOT EXISTS idx_axle_configs_vehicle ON public.axle_configurations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tyre_positions_vehicle ON public.tyre_positions_detailed(vehicle_id);

-- Create health calculation trigger function
CREATE OR REPLACE FUNCTION public.calculate_tyre_health()
RETURNS TRIGGER AS $$
BEGIN
  -- Tread depth health calculation
  IF NEW.current_tread_depth IS NOT NULL THEN
    IF NEW.current_tread_depth < 3 THEN
      NEW.tread_depth_health := 'critical';
    ELSIF NEW.current_tread_depth < 5 THEN
      NEW.tread_depth_health := 'warning';
    ELSIF NEW.current_tread_depth < 8 THEN
      NEW.tread_depth_health := 'good';
    ELSE
      NEW.tread_depth_health := 'excellent';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic health calculation
DROP TRIGGER IF EXISTS tyre_health_calculation ON public.tyres;
CREATE TRIGGER tyre_health_calculation
  BEFORE INSERT OR UPDATE ON public.tyres
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_tyre_health();

-- Enable RLS on new tables
ALTER TABLE public.tyre_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.axle_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyre_positions_detailed ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tyre_configs
CREATE POLICY "Allow authenticated users to view tyre configs"
  ON public.tyre_configs FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage tyre configs"
  ON public.tyre_configs FOR ALL
  USING (true);

-- Create RLS policies for axle_configurations
CREATE POLICY "Allow authenticated users to view axle configurations"
  ON public.axle_configurations FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage axle configurations"
  ON public.axle_configurations FOR ALL
  USING (true);

-- Create RLS policies for tyre_positions_detailed
CREATE POLICY "Allow authenticated users to view tyre positions"
  ON public.tyre_positions_detailed FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage tyre positions"
  ON public.tyre_positions_detailed FOR ALL
  USING (true);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tyre_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.axle_configurations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tyre_positions_detailed;