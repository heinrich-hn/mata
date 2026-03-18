-- Import Geofences as Predefined Locations
-- Run this in Supabase SQL Editor to make geofences available in LocationSelector

-- Step 1: Add geofences to predefined_locations table
INSERT INTO predefined_locations (
  name,
  short_code,
  address,
  latitude,
  longitude,
  location_type,
  country,
  is_active,
  is_favorite
)
SELECT
  geofences.name,
  -- Generate unique short codes by appending row number
  UPPER(LEFT(geofences.name, 3)) || LPAD(ROW_NUMBER() OVER (PARTITION BY UPPER(LEFT(geofences.name, 3)) ORDER BY geofences.name)::text, 2, '0') as short_code,
  geofences.description as address,
  geofences.center_lat as latitude,
  geofences.center_lng as longitude,  -- Map geofence types to location_type enum
  CASE
    WHEN geofences.type = 'circle' AND geofences.description ILIKE '%hospital%' THEN 'customer'
    WHEN geofences.type = 'circle' AND geofences.description ILIKE '%toll%' THEN 'toll_gate'
    WHEN geofences.type = 'polygon' AND geofences.description ILIKE '%warehouse%' THEN 'depot'
    WHEN geofences.type = 'polygon' AND geofences.description ILIKE '%depot%' THEN 'depot'
    WHEN geofences.description ILIKE '%border%' THEN 'border_post'
    WHEN geofences.description ILIKE '%truck stop%' THEN 'truck_stop'
    WHEN geofences.description ILIKE '%market%' THEN 'market'
    WHEN geofences.description ILIKE '%port%' THEN 'port'
    WHEN geofences.description ILIKE '%supplier%' THEN 'supplier'
    ELSE 'market'  -- Default fallback
  END::location_type as location_type,

  -- Extract country from description
  CASE
    WHEN geofences.description ILIKE '%Zimbabwe%' OR geofences.description ILIKE '%Harare%' THEN 'Zimbabwe'
    WHEN geofences.description ILIKE '%South Africa%' OR geofences.description ILIKE '%Johannesburg%' OR geofences.description ILIKE '%Cape Town%' OR geofences.description ILIKE '%Pretoria%' THEN 'South Africa'
    WHEN geofences.description ILIKE '%Zambia%' OR geofences.description ILIKE '%Lusaka%' THEN 'Zambia'
    WHEN geofences.description ILIKE '%Botswana%' THEN 'Botswana'
    WHEN geofences.description ILIKE '%Mozambique%' THEN 'Mozambique'
    ELSE 'South Africa'  -- Default to South Africa
  END as country,

  true as is_active,

  -- Mark major cities/hubs as favorites
  (
    geofences.description ILIKE '%Harare%' OR
    geofences.description ILIKE '%Johannesburg%' OR
    geofences.description ILIKE '%Cape Town%' OR
    geofences.description ILIKE '%Lusaka%' OR
    geofences.description ILIKE '%Bulawayo%' OR
    geofences.name ILIKE '%Main%' OR
    geofences.name ILIKE '%Central%'
  ) as is_favorite

FROM geofences
WHERE
  -- Only include geofences with valid coordinates
  geofences.center_lat IS NOT NULL
  AND geofences.center_lng IS NOT NULL
  AND geofences.is_active = true

  -- Avoid duplicates (check if name doesn't already exist)
  AND NOT EXISTS (
    SELECT 1
    FROM predefined_locations pl
    WHERE pl.name = geofences.name
  );

-- Step 2: Verify the import
SELECT
  location_type,
  country,
  COUNT(*) as count
FROM predefined_locations
WHERE name IN (SELECT name FROM geofences)
GROUP BY location_type, country
ORDER BY country, location_type;

-- Step 3: Show sample results
SELECT
  name,
  short_code,
  location_type,
  country,
  is_favorite,
  CONCAT(ROUND(latitude::numeric, 4), ', ', ROUND(longitude::numeric, 4)) as coordinates
FROM predefined_locations
WHERE name IN (SELECT name FROM geofences WHERE center_lat IS NOT NULL)
ORDER BY country, is_favorite DESC, name
LIMIT 20;

-- Expected output:
-- ~131 new locations added
-- Categories: depot, toll_gate, border_post, market, customer, etc.
-- Countries: Zimbabwe, South Africa, Zambia, Botswana
