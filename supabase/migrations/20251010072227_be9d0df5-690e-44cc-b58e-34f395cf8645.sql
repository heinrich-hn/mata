-- Phase 3: Create tyre position history tracking table
CREATE TABLE IF NOT EXISTS public.tyre_position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tyre_id UUID REFERENCES public.tyres(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  fleet_position TEXT NOT NULL,
  action TEXT CHECK (action IN ('installed', 'removed', 'rotated')) NOT NULL,
  from_position TEXT,
  to_position TEXT,
  km_reading INTEGER NOT NULL,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add fleet position tracking to tyres table
ALTER TABLE public.tyres 
ADD COLUMN IF NOT EXISTS current_fleet_position TEXT,
ADD COLUMN IF NOT EXISTS installation_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS installation_km INTEGER,
ADD COLUMN IF NOT EXISTS installer_name TEXT;

-- Enable RLS
ALTER TABLE public.tyre_position_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view position history" 
  ON public.tyre_position_history FOR SELECT 
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage position history" 
  ON public.tyre_position_history FOR ALL 
  TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_position_history_tyre 
  ON public.tyre_position_history(tyre_id);
  
CREATE INDEX IF NOT EXISTS idx_position_history_vehicle 
  ON public.tyre_position_history(vehicle_id);
  
CREATE INDEX IF NOT EXISTS idx_position_history_position 
  ON public.tyre_position_history(fleet_position);
  
CREATE INDEX IF NOT EXISTS idx_position_history_date 
  ON public.tyre_position_history(performed_at DESC);