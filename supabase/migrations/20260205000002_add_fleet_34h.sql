-- ============================================================================
-- ADD FLEET 34H TO WIALON_VEHICLES TABLE
-- Vehicle exists on Vehicles page but not in Wialon (no GPS tracking)
-- ============================================================================

-- Insert 34H with negative wialon_unit_id (convention for non-GPS vehicles)
INSERT INTO public.wialon_vehicles (wialon_unit_id, name, fleet_number, registration, vehicle_type)
VALUES
  (-34, '34H - (MR86PVGP)', '34H', 'MR86PVGP', 'Horse')
ON CONFLICT (wialon_unit_id) DO NOTHING;

-- ============================================================================
-- ADD DIESEL NORM FOR 34H
-- Expected km/L: 3.1 (similar to 30H, 33H in the fleet)
-- Tolerance: 10%
-- ============================================================================

INSERT INTO public.diesel_norms (fleet_number, expected_km_per_litre, tolerance_percentage, min_acceptable, max_acceptable, updated_by)
VALUES
  ('34H', 3.1, 10, 2.79, 3.41, 'System Default')
ON CONFLICT (fleet_number) DO NOTHING;

-- ============================================================================
-- RENAME UD TO 1H IN DIESEL NORMS
-- ============================================================================

UPDATE public.diesel_norms
SET fleet_number = '1H'
WHERE fleet_number = 'UD';
