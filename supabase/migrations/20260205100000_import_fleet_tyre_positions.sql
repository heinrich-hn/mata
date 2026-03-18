-- Migration: Import Fleet Tyre Positions for 22H, 23H, 24H, 26H, 28H, 29H
-- Date: 2026-02-05
-- Description: Bulk import of tyre position data from fleet tracking spreadsheet

-- First, let's get the vehicle registration numbers for each fleet
-- 22H = AGZ 3812, 23H = AFQ 1324, 24H = AFQ 1325, 26H = AFQ 1327, 28H = AFQ 1329, 29H = AGJ 3466

-- Helper function to format tyre type based on position
-- V1, V2 = Steer, V3-V10 = Drive

-- First, remove any duplicate serial_number entries (keep most recent by id)
DELETE FROM tyres t1
WHERE EXISTS (
  SELECT 1 FROM tyres t2
  WHERE t2.serial_number = t1.serial_number
  AND t2.id > t1.id
);

-- Now ensure serial_number has a unique constraint (may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tyres_serial_number_key'
    AND conrelid = 'tyres'::regclass
  ) THEN
    -- Add unique constraint if it doesn't exist
    ALTER TABLE tyres ADD CONSTRAINT tyres_serial_number_key UNIQUE (serial_number);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Constraint already exists
END $$;

-- ============================================================================
-- 22H Fleet Tyres (Registration: AGZ 3812)
-- ============================================================================
INSERT INTO tyres (serial_number, brand, model, size, type, current_fleet_position, position, current_tread_depth, installation_date, installation_km, km_travelled)
VALUES
  ('MAT0538', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Steer', '22H AGZ 3812-V1', 'V1', 15, '2026-01-27', 1084393, 4127),
  ('MAT0539', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Steer', '22H AGZ 3812-V2', 'V2', 15, '2026-01-27', 1084393, 4127),
  ('MAT0503', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V3', 'V3', 8, '2025-03-21', 980272, 108248),
  ('MAT0504', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V4', 'V4', 8, '2025-03-21', 980272, 108248),
  ('MAT0501', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V5', 'V5', 8, '2025-03-21', 980272, 108248),
  ('MAT0502', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V6', 'V6', 8, '2025-03-21', 980272, 108248),
  ('MAT0497', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V7', 'V7', 8, '2025-03-21', 980272, 108248),
  ('MAT0498', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V8', 'V8', 8, '2025-03-21', 980272, 108248),
  ('MAT0499', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V9', 'V9', 8, '2025-03-21', 980272, 108248),
  ('MAT0500', 'TECHSHHIELD', 'VIGOROUS TM901', '385/65R22.5', 'Drive', '22H AGZ 3812-V10', 'V10', 8, '2025-03-21', 980272, 108248)
ON CONFLICT (serial_number) DO UPDATE SET
  current_fleet_position = EXCLUDED.current_fleet_position,
  position = EXCLUDED.position,
  current_tread_depth = EXCLUDED.current_tread_depth,
  installation_date = EXCLUDED.installation_date,
  installation_km = EXCLUDED.installation_km,
  km_travelled = EXCLUDED.km_travelled,
  updated_at = NOW();

-- ============================================================================
-- 23H Fleet Tyres (Registration: AFQ 1324)
-- ============================================================================
INSERT INTO tyres (serial_number, brand, model, size, type, current_fleet_position, position, current_tread_depth, installation_date, installation_km, km_travelled)
VALUES
  ('MAT0527', 'FIREMAX', 'FM166', '315/80R22.5', 'Steer', '23H AFQ 1324-V1', 'V1', 13, '2025-08-20', 407714, 63506),
  ('MAT0528', 'FIREMAX', 'FM166', '315/80R22.5', 'Steer', '23H AFQ 1324-V2', 'V2', 13, '2025-08-20', 407714, 63506),
  ('MAT0564', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V3', 'V3', 15, '2025-11-14', 447533, 23687),
  ('MAT0565', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V4', 'V4', 15, '2025-11-14', 447533, 23687),
  ('MAT0566', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V5', 'V5', 15, '2025-11-14', 447533, 23687),
  ('MAT0567', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V6', 'V6', 15, '2025-11-14', 447533, 23687),
  ('MAT0568', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V7', 'V7', 15, '2025-11-14', 447533, 23687),
  ('MAT0569', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V8', 'V8', 15, '2025-11-14', 447533, 23687),
  ('MAT0570', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V9', 'V9', 15, '2025-11-14', 447533, 23687),
  ('MAT0571', 'TECHSHHIELD', 'VIGOROUS TD700', '315/80R22.5', 'Drive', '23H AFQ 1324-V10', 'V10', 15, '2025-11-14', 447533, 23687)
ON CONFLICT (serial_number) DO UPDATE SET
  current_fleet_position = EXCLUDED.current_fleet_position,
  position = EXCLUDED.position,
  current_tread_depth = EXCLUDED.current_tread_depth,
  installation_date = EXCLUDED.installation_date,
  installation_km = EXCLUDED.installation_km,
  km_travelled = EXCLUDED.km_travelled,
  updated_at = NOW();

-- ============================================================================
-- 24H Fleet Tyres (Registration: AFQ 1325)
-- ============================================================================
INSERT INTO tyres (serial_number, brand, model, size, type, current_fleet_position, position, current_tread_depth, installation_date, installation_km, km_travelled)
VALUES
  ('MAT0576', 'WINDFORCE', 'WH1020', '315/80R22.5', 'Steer', '24H AFQ 1325-V1', 'V1', 15, '2025-12-03', 422692, 20099),
  ('MAT0577', 'WINDFORCE', 'WH1020', '315/80R22.5', 'Steer', '24H AFQ 1325-V2', 'V2', 15, '2025-12-03', 422692, 20099),
  ('MAT0406', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '24H AFQ 1325-V3', 'V3', 7, '2024-12-19', 351285, 91506),
  ('MAT0407', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '24H AFQ 1325-V4', 'V4', 7, '2024-12-19', 351285, 91506),
  ('MAT0408', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '24H AFQ 1325-V5', 'V5', 7, '2024-12-19', 351285, 91506),
  ('MAT0409', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '24H AFQ 1325-V6', 'V6', 7, '2024-12-19', 351285, 91506),
  ('MAT0410', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '24H AFQ 1325-V7', 'V7', 7, '2024-12-19', 351285, 91506),
  ('MAT0411', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '24H AFQ 1325-V8', 'V8', 7, '2024-12-19', 351285, 91506),
  ('MAT0412', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '24H AFQ 1325-V9', 'V9', 7, '2024-12-19', 351285, 91506),
  ('MAT0537', 'FIREMAX', 'FM07', '315/80R22.5', 'Drive', '24H AFQ 1325-V10', 'V10', 7, '2024-12-19', 351285, 91506)
ON CONFLICT (serial_number) DO UPDATE SET
  current_fleet_position = EXCLUDED.current_fleet_position,
  position = EXCLUDED.position,
  current_tread_depth = EXCLUDED.current_tread_depth,
  installation_date = EXCLUDED.installation_date,
  installation_km = EXCLUDED.installation_km,
  km_travelled = EXCLUDED.km_travelled,
  updated_at = NOW();

-- ============================================================================
-- 26H Fleet Tyres (Registration: AFQ 1327)
-- ============================================================================
INSERT INTO tyres (serial_number, brand, model, size, type, current_fleet_position, position, current_tread_depth, installation_date, installation_km, km_travelled)
VALUES
  ('MAT0572', 'TECHSHIELD', 'VIGOROUS TA800', '315/80R22.5', 'Steer', '26H AFQ 1327-V1', 'V1', 15, '2025-12-11', 443659, 22233),
  ('MAT0573', 'TECHSHIELD', 'VIGOROUS TA800', '315/80R22.5', 'Steer', '26H AFQ 1327-V2', 'V2', 15, '2025-12-11', 443659, 22233),
  ('MAT0578', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V3', 'V3', 15, '2025-12-18', 456363, 9529),
  ('MAT0579', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V4', 'V4', 15, '2025-12-18', 456363, 9529),
  ('MAT0580', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V5', 'V5', 15, '2025-12-18', 456363, 9529),
  ('MAT0581', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V6', 'V6', 15, '2025-12-18', 456363, 9529),
  ('MAT0582', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V7', 'V7', 15, '2025-12-18', 456363, 9529),
  ('MAT0583', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V8', 'V8', 15, '2025-12-18', 456363, 9529),
  ('MAT0584', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V9', 'V9', 15, '2025-12-18', 456363, 9529),
  ('MAT0585', 'FIREMAX', 'FM08', '315/80R22.5', 'Drive', '26H AFQ 1327-V10', 'V10', 15, '2025-12-18', 456363, 9529)
ON CONFLICT (serial_number) DO UPDATE SET
  current_fleet_position = EXCLUDED.current_fleet_position,
  position = EXCLUDED.position,
  current_tread_depth = EXCLUDED.current_tread_depth,
  installation_date = EXCLUDED.installation_date,
  installation_km = EXCLUDED.installation_km,
  km_travelled = EXCLUDED.km_travelled,
  updated_at = NOW();

-- ============================================================================
-- 28H Fleet Tyres (Registration: AFQ 1329)
-- ============================================================================
INSERT INTO tyres (serial_number, brand, model, size, type, current_fleet_position, position, current_tread_depth, installation_date, installation_km, km_travelled)
VALUES
  ('MAT0526', 'FIREMAX', 'FM166', '315/80R22.5', 'Steer', '28H AFQ 1329-V1', 'V1', 14, '2025-11-18', 353691, 30566),
  ('MAT0574', 'WINDFORCE', 'WH1020', '315/80R22.5', 'Steer', '28H AFQ 1329-V2', 'V2', 14, '2025-11-18', 353691, 30566),
  ('MAT0546', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V3', 'V3', 13, '2025-10-17', 345108, 39149),
  ('MAT0547', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V4', 'V4', 13, '2025-10-17', 345108, 39149),
  ('MAT0548', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V5', 'V5', 13, '2025-10-17', 345108, 39149),
  ('MAT0549', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V6', 'V6', 13, '2025-10-17', 345108, 39149),
  ('MAT0560', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V7', 'V7', 13, '2025-10-17', 345108, 39149),
  ('MAT0561', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V8', 'V8', 13, '2025-10-17', 345108, 39149),
  ('MAT0562', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V9', 'V9', 13, '2025-10-17', 345108, 39149),
  ('MAT0563', 'WELLPLUS POWER', 'WDM916', '315/80R22.5', 'Drive', '28H AFQ 1329-V10', 'V10', 13, '2025-10-17', 345108, 39149)
ON CONFLICT (serial_number) DO UPDATE SET
  current_fleet_position = EXCLUDED.current_fleet_position,
  position = EXCLUDED.position,
  current_tread_depth = EXCLUDED.current_tread_depth,
  installation_date = EXCLUDED.installation_date,
  installation_km = EXCLUDED.installation_km,
  km_travelled = EXCLUDED.km_travelled,
  updated_at = NOW();

-- ============================================================================
-- 29H Fleet Tyres (Registration: AGJ 3466)
-- ============================================================================
INSERT INTO tyres (serial_number, brand, model, size, type, current_fleet_position, position, current_tread_depth, installation_date, installation_km, km_travelled)
VALUES
  ('MAT0481', 'FIREMAX', 'FM188', '315/80R22.5', 'Steer', '29H AGJ 3466-V1', 'V1', 7, '2025-02-20', 95526, 86706),
  ('MAT0482', 'FIREMAX', 'FM188', '315/80R22.5', 'Steer', '29H AGJ 3466-V2', 'V2', 7, '2025-02-20', 95526, 86706),
  ('MAT0483', 'FIREMAX', 'FM188', '315/80R22.5', 'Drive', '29H AGJ 3466-V3', 'V3', 7, '2025-02-20', 95526, 86706),
  ('MAT0484', 'FIREMAX', 'FM188', '315/80R22.5', 'Drive', '29H AGJ 3466-V4', 'V4', 7, '2025-02-20', 95526, 86706),
  ('MAT0485', 'FIREMAX', 'FM188', '315/80R22.5', 'Drive', '29H AGJ 3466-V5', 'V5', 7, '2025-02-20', 95526, 86706),
  ('MAT0486', 'FIREMAX', 'FM188', '315/80R22.5', 'Drive', '29H AGJ 3466-V6', 'V6', 7, '2025-02-20', 95526, 86706),
  ('MAT0541', 'WINDFORCE', 'WD2060', '315/80R22.5', 'Drive', '29H AGJ 3466-V7', 'V7', 10, '2025-10-22', 158598, 23634),
  ('MAT0543', 'WINDFORCE', 'WD2020', '315/80R22.5', 'Drive', '29H AGJ 3466-V8', 'V8', 10, '2025-10-22', 158598, 23634),
  ('MAT0544', 'WINDFORCE', 'WD2020', '315/80R22.5', 'Drive', '29H AGJ 3466-V9', 'V9', 10, '2025-10-22', 158598, 23634),
  ('MAT0545', 'WINDFORCE', 'WD2020', '315/80R22.5', 'Drive', '29H AGJ 3466-V10', 'V10', 10, '2025-10-22', 158598, 23634)
ON CONFLICT (serial_number) DO UPDATE SET
  current_fleet_position = EXCLUDED.current_fleet_position,
  position = EXCLUDED.position,
  current_tread_depth = EXCLUDED.current_tread_depth,
  installation_date = EXCLUDED.installation_date,
  installation_km = EXCLUDED.installation_km,
  km_travelled = EXCLUDED.km_travelled,
  updated_at = NOW();

-- ============================================================================
-- Sync fleet_tyre_positions table from tyres data
-- This links the tyres to their positions so they show in Vehicle Store
-- ============================================================================

-- Insert or update fleet_tyre_positions for each imported tyre
INSERT INTO fleet_tyre_positions (fleet_number, vehicle_id, registration_no, position, tyre_code, updated_at)
SELECT
  split_part(t.current_fleet_position, ' ', 1) as fleet_number,
  v.id as vehicle_id,
  split_part(split_part(t.current_fleet_position, '-', 1), ' ', 2) || ' ' || split_part(split_part(t.current_fleet_position, '-', 1), ' ', 3) as registration_no,
  t.position,
  t.id as tyre_code,
  NOW() as updated_at
FROM tyres t
JOIN vehicles v ON v.fleet_number = split_part(t.current_fleet_position, ' ', 1)
WHERE t.current_fleet_position LIKE '22H%'
   OR t.current_fleet_position LIKE '23H%'
   OR t.current_fleet_position LIKE '24H%'
   OR t.current_fleet_position LIKE '26H%'
   OR t.current_fleet_position LIKE '28H%'
   OR t.current_fleet_position LIKE '29H%'
ON CONFLICT (fleet_number, registration_no, position) DO UPDATE SET
  tyre_code = EXCLUDED.tyre_code,
  vehicle_id = EXCLUDED.vehicle_id,
  updated_at = NOW();

-- ============================================================================
-- Summary
-- ============================================================================
DO $$
DECLARE
  tyre_count INTEGER;
  position_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tyre_count FROM tyres WHERE current_fleet_position LIKE '22H%' OR current_fleet_position LIKE '23H%' OR current_fleet_position LIKE '24H%' OR current_fleet_position LIKE '26H%' OR current_fleet_position LIKE '28H%' OR current_fleet_position LIKE '29H%';
  SELECT COUNT(*) INTO position_count FROM fleet_tyre_positions WHERE fleet_number IN ('22H', '23H', '24H', '26H', '28H', '29H');
  RAISE NOTICE 'Total tyres imported/updated: %', tyre_count;
  RAISE NOTICE 'Total fleet positions linked: %', position_count;
END $$;
