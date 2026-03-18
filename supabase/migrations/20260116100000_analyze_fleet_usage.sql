-- Analysis: Find actual fleet numbers in use across the system
-- Run this first to see what needs to be migrated

-- 1. Fleet numbers from vehicles table
SELECT DISTINCT
  'vehicles' as source,
  substring(registration_number from '^(\d+[A-Z]+)') as fleet_number,
  COUNT(*) as count
FROM vehicles
WHERE registration_number
~ '^\d+[A-Z]+'
GROUP BY substring
(registration_number from '^(\d+[A-Z]+)')
ORDER BY count DESC;

-- 2. Fleet numbers from installed tyres
SELECT DISTINCT
  'tyres.current_fleet_position' as source,
  substring(current_fleet_position from '^(\d+[A-Z]+)') as fleet_number,
  COUNT(*) as count
FROM tyres
WHERE current_fleet_position IS NOT NULL
GROUP BY substring(current_fleet_position from '^(\d+[A-Z]+)')
ORDER BY count DESC;

-- 3. Check which fleet_*_tyres tables have actual data
SELECT
  table_name,
  (SELECT COUNT(*)
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name = ist.table_name)
as exists,
    CASE
        WHEN table_name = 'fleet_1h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_1h_tyres)
WHEN table_name = 'fleet_1t_tyres' THEN
(SELECT COUNT(*)
FROM fleet_1t_tyres)
WHEN table_name = 'fleet_2t_tyres' THEN
(SELECT COUNT(*)
FROM fleet_2t_tyres)
WHEN table_name = 'fleet_3t_tyres' THEN
(SELECT COUNT(*)
FROM fleet_3t_tyres)
WHEN table_name = 'fleet_4f_tyres' THEN
(SELECT COUNT(*)
FROM fleet_4f_tyres)
WHEN table_name = 'fleet_4h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_4h_tyres)
WHEN table_name = 'fleet_4t_tyres' THEN
(SELECT COUNT(*)
FROM fleet_4t_tyres)
WHEN table_name = 'fleet_5f_tyres' THEN
(SELECT COUNT(*)
FROM fleet_5f_tyres)
WHEN table_name = 'fleet_6f_tyres' THEN
(SELECT COUNT(*)
FROM fleet_6f_tyres)
WHEN table_name = 'fleet_6h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_6h_tyres)
WHEN table_name = 'fleet_7f_tyres' THEN
(SELECT COUNT(*)
FROM fleet_7f_tyres)
WHEN table_name = 'fleet_8f_tyres' THEN
(SELECT COUNT(*)
FROM fleet_8f_tyres)
WHEN table_name = 'fleet_14l_tyres' THEN
(SELECT COUNT(*)
FROM fleet_14l_tyres)
WHEN table_name = 'fleet_15l_tyres' THEN
(SELECT COUNT(*)
FROM fleet_15l_tyres)
WHEN table_name = 'fleet_21h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_21h_tyres)
WHEN table_name = 'fleet_22h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_22h_tyres)
WHEN table_name = 'fleet_23h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_23h_tyres)
WHEN table_name = 'fleet_24h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_24h_tyres)
WHEN table_name = 'fleet_26h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_26h_tyres)
WHEN table_name = 'fleet_28h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_28h_tyres)
WHEN table_name = 'fleet_29h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_29h_tyres)
WHEN table_name = 'fleet_30h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_30h_tyres)
WHEN table_name = 'fleet_31h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_31h_tyres)
WHEN table_name = 'fleet_32h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_32h_tyres)
WHEN table_name = 'fleet_33h_tyres' THEN
(SELECT COUNT(*)
FROM fleet_33h_tyres)
WHEN table_name = 'fleet_ud_tyres' THEN
(SELECT COUNT(*)
FROM fleet_ud_tyres)
ELSE 0
END as row_count
FROM information_schema.tables ist
WHERE table_schema = 'public'
  AND table_name LIKE 'fleet_%_tyres'
ORDER BY table_name;

-- 4. Summary of the situation
SELECT
  'SUMMARY' as report,
  (SELECT COUNT(DISTINCT substring(registration_number from '^(\d+[A-Z]+)'))
  FROM vehicles
  WHERE registration_number
~ '^\d+[A-Z]+') as unique_fleet_numbers_in_vehicles,
(SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'fleet_%_tyres')
as fleet_tables_exist,
(SELECT COUNT(*)
FROM tyres
WHERE current_fleet_position IS NOT NULL)
as tyres_with_fleet_position;
