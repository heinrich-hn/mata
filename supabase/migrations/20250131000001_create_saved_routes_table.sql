-- Migration: Create saved_routes table for route planning and load management
-- Purpose: Store reusable routes with waypoints for load planning, driver assignment, and delivery tracking
-- Phase: Route Planning & Load Management Integration

-- Create saved_routes table
CREATE TABLE IF NOT EXISTS public.saved_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic route information
  name TEXT NOT NULL,
  description TEXT,

  -- Route data (JSONB array of waypoints)
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metrics
  total_distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estimated_duration_mins INTEGER NOT NULL DEFAULT 0,

  -- Template and usage tracking
  is_template BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,

  -- Audit fields
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_waypoints_array CHECK (jsonb_typeof(waypoints) = 'array'),
  CONSTRAINT positive_distance CHECK (total_distance_km >= 0),
  CONSTRAINT positive_duration CHECK (estimated_duration_mins >= 0),
  CONSTRAINT positive_usage_count CHECK (usage_count >= 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_saved_routes_created_by ON public.saved_routes(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_routes_is_template ON public.saved_routes(is_template);
CREATE INDEX IF NOT EXISTS idx_saved_routes_created_at ON public.saved_routes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_routes_usage_count ON public.saved_routes(usage_count DESC);

-- GIN index for JSONB waypoints (enables efficient querying of waypoint properties)
CREATE INDEX IF NOT EXISTS idx_saved_routes_waypoints ON public.saved_routes USING GIN (waypoints);

-- Enable Row Level Security
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view all routes (read access)
CREATE POLICY "saved_routes_select_policy" ON public.saved_routes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Users can create their own routes
CREATE POLICY "saved_routes_insert_policy" ON public.saved_routes
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
  );

-- Policy: Users can update their own routes OR templates
CREATE POLICY "saved_routes_update_policy" ON public.saved_routes
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (created_by = auth.uid() OR is_template = true)
  );

-- Policy: Users can only delete their own routes
CREATE POLICY "saved_routes_delete_policy" ON public.saved_routes
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
  );

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_saved_routes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at on row changes
CREATE TRIGGER saved_routes_updated_at_trigger
  BEFORE UPDATE ON public.saved_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_saved_routes_updated_at();

-- Function: Increment route usage count (called when route is loaded as template)
CREATE OR REPLACE FUNCTION public.increment_route_usage(route_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.saved_routes
  SET usage_count = usage_count + 1
  WHERE id = route_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION public.increment_route_usage(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON TABLE public.saved_routes IS 'Stores reusable route templates with waypoints for load planning and driver assignment';
COMMENT ON COLUMN public.saved_routes.waypoints IS 'JSONB array of waypoint objects with properties: sequence, name, address, latitude, longitude, type, geofence_id';
COMMENT ON COLUMN public.saved_routes.is_template IS 'When true, route is available as a reusable template for load planning';
COMMENT ON COLUMN public.saved_routes.usage_count IS 'Number of times this route has been loaded as a template';

-- Sample data for testing (optional - remove in production)
INSERT INTO public.saved_routes (name, description, waypoints, total_distance_km, estimated_duration_mins, is_template)
VALUES
(
  'JHB to Cape Town via N1',
  'Main highway route from Johannesburg to Cape Town via Bloemfontein and Beaufort West',
  '[
    {"sequence": 1, "name": "Johannesburg Depot", "latitude": -26.2041, "longitude": 28.0473, "type": "pickup"},
    {"sequence": 2, "name": "Bloemfontein Stop", "latitude": -29.0852, "longitude": 26.1596, "type": "stop"},
    {"sequence": 3, "name": "Beaufort West Stop", "latitude": -32.3568, "longitude": 22.5828, "type": "stop"},
    {"sequence": 4, "name": "Cape Town Delivery", "latitude": -33.9249, "longitude": 18.4241, "type": "delivery"}
  ]'::jsonb,
  1402.5,
  840,
  true
),
(
  'Durban to PE Coastal Route',
  'Coastal route from Durban to Port Elizabeth via East London',
  '[
    {"sequence": 1, "name": "Durban Depot", "latitude": -29.8587, "longitude": 31.0218, "type": "pickup"},
    {"sequence": 2, "name": "East London Stop", "latitude": -33.0153, "longitude": 27.9116, "type": "stop"},
    {"sequence": 3, "name": "Port Elizabeth Delivery", "latitude": -33.9608, "longitude": 25.6022, "type": "delivery"}
  ]'::jsonb,
  772.3,
  520,
  true
);
