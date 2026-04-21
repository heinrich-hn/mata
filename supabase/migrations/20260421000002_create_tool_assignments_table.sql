-- Migration: Per-vehicle tool assignments
-- Date: 2026-04-21
-- Description: Allow allocating portions of a tool's total quantity to specific vehicles.
--              Replaces the simpler tools.linked_vehicle_id field (kept for backward compat).

BEGIN;

CREATE TABLE IF NOT EXISTS public.tool_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tool_id, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_assignments_tool_id
  ON public.tool_assignments (tool_id);

CREATE INDEX IF NOT EXISTS idx_tool_assignments_vehicle_id
  ON public.tool_assignments (vehicle_id);

-- Maintain updated_at automatically
CREATE OR REPLACE FUNCTION public.tool_assignments_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tool_assignments_set_updated_at ON public.tool_assignments;
CREATE TRIGGER trg_tool_assignments_set_updated_at
  BEFORE UPDATE ON public.tool_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.tool_assignments_set_updated_at();

-- Row Level Security
ALTER TABLE public.tool_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tool assignments" ON public.tool_assignments;
DROP POLICY IF EXISTS "Authenticated users can insert tool assignments" ON public.tool_assignments;
DROP POLICY IF EXISTS "Authenticated users can update tool assignments" ON public.tool_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete tool assignments" ON public.tool_assignments;

CREATE POLICY "Authenticated users can view tool assignments"
  ON public.tool_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tool assignments"
  ON public.tool_assignments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tool assignments"
  ON public.tool_assignments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tool assignments"
  ON public.tool_assignments FOR DELETE
  TO authenticated
  USING (true);

COMMIT;
