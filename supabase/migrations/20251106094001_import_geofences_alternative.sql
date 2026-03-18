-- Alternative: Import Geofences with NULL short_codes
-- Use this if you don't need short codes or want to set them manually later

-- Option 1: Allow NULL short codes
INSERT INTO predefined_locations (
  name,
  short_code,  -- Will be NULL
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
  NULL as short_code,  -- Skip short codes to avoid conflicts
  geofences.description as address,
  geofences.center_lat as latitude,
  geofences.center_lng as longitude,

  -- Map geofence types to location_type enum
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
    ELSE 'market'
  END::location_type as location_type,

  -- Extract country from description
  CASE
    WHEN geofences.description ILIKE '%Zimbabwe%' OR geofences.description ILIKE '%Harare%' THEN 'Zimbabwe'
    WHEN geofences.description ILIKE '%South Africa%' OR geofences.description ILIKE '%Johannesburg%' OR geofences.description ILIKE '%Cape Town%' OR geofences.description ILIKE '%Pretoria%' THEN 'South Africa'
    WHEN geofences.description ILIKE '%Zambia%' OR geofences.description ILIKE '%Lusaka%' THEN 'Zambia'
    WHEN geofences.description ILIKE '%Botswana%' THEN 'Botswana'
    WHEN geofences.description ILIKE '%Mozambique%' THEN 'Mozambique'
    ELSE 'South Africa'
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
  geofences.center_lat IS NOT NULL
  AND geofences.center_lng IS NOT NULL
  AND geofences.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM predefined_locations pl
    WHERE pl.name = geofences.name
  );

-- Verify the import
SELECT
  location_type,
  country,
  COUNT(*) as count
FROM predefined_locations
WHERE name IN (SELECT name FROM geofences)
GROUP BY location_type, country
ORDER BY country, location_type;
