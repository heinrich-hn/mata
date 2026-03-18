-- ============================================================================
-- ADD MISSING FLEET VEHICLES TO WIALON_VEHICLES TABLE
-- Ensures 4H, 6H, and UD are available for trip creation
-- These vehicles don't have Wialon GPS tracking but need to be in the system
-- for consistency with diesel records and fleet reporting
-- ============================================================================

-- Insert missing fleet vehicles with negative wialon_unit_ids to distinguish them
-- from real Wialon-tracked vehicles. Negative IDs indicate no GPS tracking.
INSERT INTO public.wialon_vehicles (wialon_unit_id, name, fleet_number, registration, vehicle_type)
VALUES
  (-4, '4H', '4H', NULL, 'Horse'),
  (-6, '6H', '6H', NULL, 'Horse'),
  (-999, 'UD', 'UD', NULL, 'Horse')
ON CONFLICT (wialon_unit_id) DO NOTHING;

-- Add comment to clarify the negative ID convention
COMMENT ON TABLE public.wialon_vehicles IS 'GPS-tracked vehicles from Wialon system. Vehicles with negative wialon_unit_id values are fleet vehicles without GPS tracking but included for trip/diesel record consistency.';
