-- ============================================================================
-- WIALON VEHICLES TABLE
-- Separate table for Wialon GPS-tracked vehicles
-- ============================================================================

-- Create wialon_vehicles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wialon_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wialon_unit_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  registration TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_wialon_vehicles_unit_id ON public.wialon_vehicles(wialon_unit_id);

-- Enable RLS
ALTER TABLE public.wialon_vehicles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.wialon_vehicles;
CREATE POLICY "Enable read access for authenticated users"
  ON public.wialon_vehicles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.wialon_vehicles;
CREATE POLICY "Enable insert for authenticated users"
  ON public.wialon_vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.wialon_vehicles;
CREATE POLICY "Enable update for authenticated users"
  ON public.wialon_vehicles
  FOR UPDATE
  TO authenticated
  USING (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_wialon_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wialon_vehicles_updated_at ON public.wialon_vehicles;
CREATE TRIGGER update_wialon_vehicles_updated_at
  BEFORE UPDATE ON public.wialon_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_wialon_vehicles_updated_at();

-- Fix foreign key constraint if it was manually changed
-- First, check if the constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_assigned_vehicle'
    AND table_name = 'loads'
  ) THEN
    ALTER TABLE public.loads DROP CONSTRAINT fk_assigned_vehicle;
  END IF;
END $$;

-- Add the correct foreign key to wialon_vehicles
ALTER TABLE public.loads
  ADD CONSTRAINT fk_assigned_vehicle
  FOREIGN KEY (assigned_vehicle_id)
  REFERENCES public.wialon_vehicles(id)
  ON DELETE SET NULL;

COMMENT ON TABLE public.wialon_vehicles IS 'GPS-tracked vehicles from Wialon system';
COMMENT ON COLUMN public.wialon_vehicles.wialon_unit_id IS 'Unique Wialon unit ID from GPS system';
