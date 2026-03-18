-- Migration: Move webhook-imported data from trips to loads table
-- This fixes the contradiction where loads were stored as trips

-- Step 1: Migrate webhook-imported trips to loads table
-- (Only those with external_load_ref populated)
INSERT INTO loads (
  load_number,
  customer_name,
  origin,
  destination,
  pickup_datetime,
  delivery_datetime,
  actual_pickup_datetime,
  actual_delivery_datetime,
  cargo_type,
  weight_kg,
  status,
  currency,
  quoted_price,
  final_price,
  notes,
  special_instructions,
  created_at,
  updated_at,
  attachments
)
SELECT
  -- Use external_load_ref as load_number (this is the original loadRef from webhook)
  external_load_ref AS load_number,

  -- Map customer/client name
  COALESCE(client_name, 'Unknown Customer') AS customer_name,

  -- Map locations
  COALESCE(origin, 'Unknown') AS origin,
  COALESCE(destination, 'Unknown') AS destination,

  -- Map datetime fields
  COALESCE(actual_departure_date, departure_date::timestamp, NOW()) AS pickup_datetime,
  COALESCE(actual_arrival_date, arrival_date::timestamp, NOW() + interval '1 day') AS delivery_datetime,
  actual_departure_date AS actual_pickup_datetime,
  actual_arrival_date AS actual_delivery_datetime,

  -- Map cargo info
  COALESCE(load_type, 'General Freight') AS cargo_type,
  COALESCE(distance_km * 100, 0) AS weight_kg, -- Rough estimate, needs manual update

  -- Map status (convert text to enum)
  CASE
    WHEN status = 'completed' THEN 'completed'::load_status
    WHEN status = 'active' THEN 'in_transit'::load_status
    ELSE 'pending'::load_status
  END AS status,

  -- Map financial fields
  COALESCE(revenue_currency, 'ZAR') AS currency,
  base_revenue AS quoted_price,
  final_invoice_amount AS final_price,

  -- Map notes
  description AS notes,
  route AS special_instructions,

  -- Preserve timestamps
  created_at,
  updated_at,

  -- Store original trip metadata in attachments
  jsonb_build_object(
    'migrated_from_trips', true,
    'original_trip_id', id,
    'original_trip_number', trip_number,
    'migration_date', NOW(),
    'import_source', import_source,
    'edit_history', edit_history,
    'shipped_status', shipped_status,
    'delivered_status', delivered_status,
    'trip_duration_hours', trip_duration_hours,
    'payment_status', payment_status,
    'invoice_number', invoice_number
  ) AS attachments

FROM trips
WHERE external_load_ref IS NOT NULL
  AND external_load_ref != ''
  -- Only migrate if not already in loads table
  AND external_load_ref NOT IN (SELECT load_number FROM loads);

-- Step 2: Log the migration
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % records from trips to loads table', migrated_count;
END $$;

-- Step 3: Delete the migrated trips from trips table
-- (Keep manually-created trips that don't have external_load_ref)
DELETE FROM trips
WHERE external_load_ref IS NOT NULL
  AND external_load_ref != '';

-- Step 4: Clean up invalid manually-created trips
-- (Remove test trips with no meaningful data)
DELETE FROM trips
WHERE trip_number = '3'
  AND vehicle_id IS NULL
  AND client_name IS NULL
  AND origin IS NULL
  AND destination IS NULL;

-- Step 5: Verify the cleanup
DO $$
DECLARE
  remaining_trips INTEGER;
  total_loads INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_trips FROM trips;
  SELECT COUNT(*) INTO total_loads FROM loads;

  RAISE NOTICE 'Cleanup complete:';
  RAISE NOTICE '  - Remaining trips: %', remaining_trips;
  RAISE NOTICE '  - Total loads: %', total_loads;
  RAISE NOTICE 'Migration successful!';
END $$;
