-- Migration: Create tools table for tools & equipment inventory
-- Date: 2026-04-21
-- Description: Tracks workshop tools and equipment with vehicle assignment, lifecycle, and purchase metadata.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Basic information
  serial_number TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  description TEXT,
  tool_type TEXT,
  manufacturer TEXT,
  model TEXT,
  year INTEGER,
  barcode TEXT,

  -- Assignment
  location TEXT,
  department TEXT,
  linked_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,

  -- Financial
  purchase_vendor TEXT,
  purchase_price NUMERIC(12, 2),
  purchase_date DATE,

  -- Maintenance lifecycle
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'maintenance', 'lost', 'retired')),
  reading TEXT,
  last_service_date DATE,
  warranty_expiry_date DATE,

  -- Media
  image_url TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_serial_number
  ON public.tools (serial_number);

CREATE INDEX IF NOT EXISTS idx_tools_linked_vehicle_id
  ON public.tools (linked_vehicle_id);

CREATE INDEX IF NOT EXISTS idx_tools_status
  ON public.tools (status);

CREATE INDEX IF NOT EXISTS idx_tools_name
  ON public.tools (name);

-- Maintain updated_at automatically
CREATE OR REPLACE FUNCTION public.tools_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tools_set_updated_at ON public.tools;
CREATE TRIGGER trg_tools_set_updated_at
  BEFORE UPDATE ON public.tools
  FOR EACH ROW
  EXECUTE FUNCTION public.tools_set_updated_at();

-- Row Level Security
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tools" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can insert tools" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can update tools" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can delete tools" ON public.tools;

CREATE POLICY "Authenticated users can view tools"
  ON public.tools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tools"
  ON public.tools FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tools"
  ON public.tools FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tools"
  ON public.tools FOR DELETE
  TO authenticated
  USING (true);

COMMIT;
