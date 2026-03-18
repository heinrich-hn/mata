-- Create fuel_stations table for saving filling station details
-- This migration is idempotent (safe to re-run)

CREATE TABLE IF NOT EXISTS public.fuel_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  price_per_litre DECIMAL(10, 4),
  currency VARCHAR(3) DEFAULT 'ZAR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name)
);

COMMENT ON TABLE public.fuel_stations IS 'Saved filling station details for fuel management';

CREATE INDEX IF NOT EXISTS idx_fuel_stations_name ON public.fuel_stations(name);
CREATE INDEX IF NOT EXISTS idx_fuel_stations_active ON public.fuel_stations(is_active);

ALTER TABLE public.fuel_stations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow authenticated users to view fuel stations" ON public.fuel_stations;
DROP POLICY IF EXISTS "Allow authenticated users to insert fuel stations" ON public.fuel_stations;
DROP POLICY IF EXISTS "Allow authenticated users to update fuel stations" ON public.fuel_stations;

CREATE POLICY "Allow authenticated users to view fuel stations"
  ON public.fuel_stations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert fuel stations"
  ON public.fuel_stations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update fuel stations"
  ON public.fuel_stations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_fuel_stations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fuel_stations_updated_at ON public.fuel_stations;
CREATE TRIGGER trigger_update_fuel_stations_updated_at
  BEFORE UPDATE ON public.fuel_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_fuel_stations_updated_at();
