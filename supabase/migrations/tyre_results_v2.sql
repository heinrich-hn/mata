-- Tyres that were inspected in mobile but not updated in tyres table
WITH mobile_inspections AS (
  SELECT DISTINCT
    vi.inspection_date,
    vi.vehicle_registration,
    ii.notes,
    substring(ii.notes FROM 'Brand: ([^\|]+)') as brand,
    substring(ii.notes FROM 'Tread: (\d+)mm') as tread_depth,
    substring(ii.notes FROM 'Condition: ([^\|]+)') as condition_status
  FROM inspection_items ii
  JOIN vehicle_inspections vi ON vi.id = ii.inspection_id
  WHERE ii.category = 'tyre'
    AND vi.inspection_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  mi.inspection_date,
  mi.vehicle_registration,
  mi.brand,
  mi.tread_depth,
  mi.condition_status,
  t.id as tyre_id,
  t.serial_number,
  t.brand as db_brand,
  t.current_tread_depth as db_tread_depth,
  t.condition as db_condition,
  t.last_inspection_date,
  'MOBILE_INSPECTION_NOT_SYNCED' as issue
FROM mobile_inspections mi
LEFT JOIN tyres t ON t.brand ILIKE mi.brand 
  AND t.current_tread_depth::text = mi.tread_depth
WHERE t.id IS NULL
  AND mi.tread_depth IS NOT NULL
ORDER BY mi.inspection_date DESC
LIMIT 50;


[
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "brand": "GENERAL ",
    "tread_depth": "7",
    "condition_status": "good ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "brand": "DOUBLESTAR ",
    "tread_depth": "7",
    "condition_status": "good ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "brand": "POWERTRAC ",
    "tread_depth": "6",
    "condition_status": "fair ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "brand": "COMPASAL ",
    "tread_depth": "8",
    "condition_status": "good ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "brand": "GENERAL ",
    "tread_depth": "5",
    "condition_status": "fair ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "brand": "GENERAL ",
    "tread_depth": "5",
    "condition_status": "fair ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  }
]




-- Compare lifecycle events with tyres table updates
SELECT 
  tle.id as event_id,
  tle.event_date,
  tle.tyre_id,
  tle.tread_depth_at_event,
  tle.km_reading,
  tle.notes,
  t.serial_number,
  t.brand,
  t.current_tread_depth as tyre_current_tread,
  t.km_travelled as tyre_km,
  t.last_inspection_date,
  CASE 
    WHEN t.current_tread_depth != tle.tread_depth_at_event THEN 'TREAD_MISMATCH'
    WHEN t.last_inspection_date::date != tle.event_date::date THEN 'DATE_MISMATCH'
    ELSE 'SYNCED'
  END as sync_status
FROM tyre_lifecycle_events tle
LEFT JOIN tyres t ON t.id = tle.tyre_id
WHERE tle.event_type = 'inspected'
  AND tle.event_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY tle.event_date DESC
LIMIT 50;

[
  {
    "event_id": "fefc0e8a-5e55-4f9a-b2c0-2a4b215749b1",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "f3b76310-286c-4003-a547-c886c3df30d0",
    "tread_depth_at_event": "8",
    "km_reading": 131077,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0306",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "30d06208-c9ce-4fc5-8c39-af67c5315fb6",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "193521ae-9e22-42a8-9a38-800af7bb78f6",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0178",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "3887316e-c1d3-4750-b947-2b2a2bc3a6e2",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "60b50c74-9d26-4a61-9ffa-d1c3ff64664a",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0179",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "79d1f4a2-bad6-4492-a7be-51c68a6150ae",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "71adecc7-11fc-47ac-ad3c-af37f9fef4ff",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0181",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "30f9f27f-c083-4ca8-adaf-af86f277a5f9",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "5118fd90-063b-425b-83f8-b53aa9462912",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0180",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "2d77a328-739b-452e-bb20-60f2368df47f",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "43723fc3-944c-4e28-a5e8-1995e2f17e5e",
    "tread_depth_at_event": "8",
    "km_reading": 131077,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0307",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "f3bd5c30-46af-4952-841f-fcdad75511ac",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "8210a33e-f44b-40da-bb6a-641639e87237",
    "tread_depth_at_event": "5",
    "km_reading": 124743,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0621",
    "brand": "GENERAL",
    "tyre_current_tread": "5",
    "tyre_km": 19305,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "3700d6e4-ca24-40fe-9551-e20f6bcc1dad",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "7dc0e39a-21cc-4ea9-9479-831d93b06535",
    "tread_depth_at_event": "7",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0622",
    "brand": "GENERAL",
    "tyre_current_tread": "7",
    "tyre_km": 15000,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "683a88f6-1fdf-4436-a3b1-3b0d23fd4aca",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "71247006-ce19-4c5a-b0c9-0e7af26f0dc5",
    "tread_depth_at_event": "7",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0623",
    "brand": "GENERAL",
    "tyre_current_tread": "7",
    "tyre_km": 15000,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "adf4be76-82b9-4408-a964-62563adefe7a",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "12b36a2a-6eed-4c2f-a68d-a46be93a13fd",
    "tread_depth_at_event": "7",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0624",
    "brand": "GENERAL",
    "tyre_current_tread": "7",
    "tyre_km": 15000,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "0465de01-d6be-49e2-b0b9-87b4c2cf4473",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "5d8af00d-185f-42d6-945e-e18727a50fc6",
    "tread_depth_at_event": "5",
    "km_reading": 124743,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0625",
    "brand": "GENERAL",
    "tyre_current_tread": "5",
    "tyre_km": null,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "138c6e53-83b1-4a86-8692-57539d96a2c4",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "8f9b87e7-c6ff-42ef-8836-d9bb14c61e37",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0472",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "b300c263-3a47-41ca-8425-b88bc80212ef",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "fb5fe069-fd42-4396-abd1-c97d677305a1",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0473",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "1a21b8a3-7663-446e-bc50-82a2b2f3b091",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "87d3203c-5d5a-4d3a-903e-8d6e929be6d4",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0474",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "600d62f2-c249-4ff8-b8dc-207a1402e3f6",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "ef9eb332-b61d-4a67-a344-f384fe6573f9",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0471",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "827f5840-f546-4e06-b050-053da88ae7aa",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "193521ae-9e22-42a8-9a38-800af7bb78f6",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0178",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "b18668d5-533c-443d-8b65-b07bbc9a7fc2",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "60b50c74-9d26-4a61-9ffa-d1c3ff64664a",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0179",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "b03765da-d15b-4b4e-8201-0bfc07ecbb3c",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "f3b76310-286c-4003-a547-c886c3df30d0",
    "tread_depth_at_event": "8",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0306",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "15d6d85e-25a8-4544-88eb-66c2b9ad32e2",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "71adecc7-11fc-47ac-ad3c-af37f9fef4ff",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0181",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "019b8127-cbdb-402e-a70d-b9d86bb3e601",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "5118fd90-063b-425b-83f8-b53aa9462912",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0180",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "dedeeb4a-2f9c-442a-bb83-888a754224e9",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "43723fc3-944c-4e28-a5e8-1995e2f17e5e",
    "tread_depth_at_event": "8",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0307",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  }
]

-- Overall data quality summary
WITH inspection_stats AS (
  SELECT 
    COUNT(DISTINCT vi.id) as total_inspections,
    COUNT(DISTINCT ii.id) as total_tyre_items,
    COUNT(DISTINCT CASE WHEN vi.inspection_date >= CURRENT_DATE - INTERVAL '7 days' THEN vi.id END) as recent_inspections
  FROM vehicle_inspections vi
  JOIN inspection_items ii ON ii.inspection_id = vi.id
  WHERE vi.inspection_type = 'tyre'
),
tyre_update_stats AS (
  SELECT 
    COUNT(*) as total_tyres_updated_last_7days
  FROM tyres
  WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '7 days'
),
lifecycle_event_stats AS (
  SELECT 
    COUNT(*) as total_lifecycle_events_last_7days
  FROM tyre_lifecycle_events
  WHERE event_type = 'inspected'
    AND event_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  is2.total_inspections,
  is2.total_tyre_items,
  is2.recent_inspections,
  tus.total_tyres_updated_last_7days,
  les.total_lifecycle_events_last_7days,
  CASE 
    WHEN is2.recent_inspections > 0 AND tus.total_tyres_updated_last_7days = 0 THEN 'CRITICAL: Inspections not updating tyres table'
    WHEN is2.recent_inspections > tus.total_tyres_updated_last_7days THEN 'WARNING: Some inspections missing from tyres table'
    WHEN les.total_lifecycle_events_last_7days = 0 AND is2.recent_inspections > 0 THEN 'WARNING: No lifecycle events recorded'
    ELSE 'OK'
  END as data_quality_status
FROM inspection_stats is2, tyre_update_stats tus, lifecycle_event_stats les;

[
  {
    "total_inspections": 3,
    "total_tyre_items": 17,
    "recent_inspections": 3,
    "total_tyres_updated_last_7days": 17,
    "total_lifecycle_events_last_7days": 21,
    "data_quality_status": "OK"
  }
]



-- Check if inspection data is properly syncing to tyres table
WITH latest_inspections AS (
  SELECT DISTINCT ON (ii.notes) 
    ii.inspection_id,
    ii.item_name,
    ii.notes,
    vi.inspection_date,
    vi.vehicle_registration,
    -- Extract tyre serial/brand from notes
    substring(ii.notes FROM 'Brand: ([^\|]+)') as inspected_brand,
    substring(ii.notes FROM 'Tread: (\d+)mm') as inspected_tread_depth,
    substring(ii.notes FROM 'Condition: ([^\|]+)') as inspected_condition
  FROM inspection_items ii
  JOIN vehicle_inspections vi ON vi.id = ii.inspection_id
  WHERE ii.category = 'tyre'
    AND vi.inspection_date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY ii.notes, vi.inspection_date DESC
)
SELECT 
  li.inspection_date,
  li.vehicle_registration,
  li.item_name,
  li.inspected_brand,
  li.inspected_tread_depth,
  li.inspected_condition,
  t.id as tyre_id,
  t.brand as tyre_table_brand,
  t.current_tread_depth as tyre_table_tread,
  t.condition as tyre_table_condition,
  t.last_inspection_date,
  CASE 
    WHEN t.id IS NULL THEN 'TYRE NOT FOUND IN TABLE'
    WHEN t.current_tread_depth::text != li.inspected_tread_depth THEN 'TREAD DEPTH MISMATCH'
    WHEN t.condition::text != li.inspected_condition THEN 'CONDITION MISMATCH'
    WHEN t.last_inspection_date != li.inspection_date THEN 'INSPECTION DATE NOT UPDATED'
    ELSE 'MATCHED'
  END as mismatch_type
FROM latest_inspections li
LEFT JOIN tyres t ON t.serial_number LIKE '%' || split_part(li.item_name, '-', 2) || '%'
   OR t.brand ILIKE li.inspected_brand
WHERE li.inspected_tread_depth IS NOT NULL
ORDER BY li.inspection_date DESC
LIMIT 50;


[
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V2 - Front Right",
    "inspected_brand": "COMPASAL ",
    "inspected_tread_depth": "8",
    "inspected_condition": "good ",
    "tyre_id": null,
    "tyre_table_brand": null,
    "tyre_table_tread": null,
    "tyre_table_condition": null,
    "last_inspection_date": null,
    "mismatch_type": "TYRE NOT FOUND IN TABLE"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "item_name": "Tyre - V2 - Front Right",
    "inspected_brand": "DOUBLESTAR ",
    "inspected_tread_depth": "7",
    "inspected_condition": "good ",
    "tyre_id": null,
    "tyre_table_brand": null,
    "tyre_table_tread": null,
    "tyre_table_condition": null,
    "last_inspection_date": null,
    "mismatch_type": "TYRE NOT FOUND IN TABLE"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - SP - Spare",
    "inspected_brand": "GENERAL ",
    "inspected_tread_depth": "5",
    "inspected_condition": "fair ",
    "tyre_id": null,
    "tyre_table_brand": null,
    "tyre_table_tread": null,
    "tyre_table_condition": null,
    "last_inspection_date": null,
    "mismatch_type": "TYRE NOT FOUND IN TABLE"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - V1 - Front Left",
    "inspected_brand": "GENERAL ",
    "inspected_tread_depth": "5",
    "inspected_condition": "fair ",
    "tyre_id": null,
    "tyre_table_brand": null,
    "tyre_table_tread": null,
    "tyre_table_condition": null,
    "last_inspection_date": null,
    "mismatch_type": "TYRE NOT FOUND IN TABLE"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - V2 - Front Right",
    "inspected_brand": "GENERAL ",
    "inspected_tread_depth": "7",
    "inspected_condition": "good ",
    "tyre_id": null,
    "tyre_table_brand": null,
    "tyre_table_tread": null,
    "tyre_table_condition": null,
    "last_inspection_date": null,
    "mismatch_type": "TYRE NOT FOUND IN TABLE"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V4 - Rear Left Inner",
    "inspected_brand": "POWERTRAC ",
    "inspected_tread_depth": "6",
    "inspected_condition": "fair ",
    "tyre_id": null,
    "tyre_table_brand": null,
    "tyre_table_tread": null,
    "tyre_table_condition": null,
    "last_inspection_date": null,
    "mismatch_type": "TYRE NOT FOUND IN TABLE"
  }
]
-- Tyres that were inspected in mobile but not updated in tyres table
WITH mobile_inspections AS (
  SELECT DISTINCT
    vi.inspection_date,
    vi.vehicle_registration,
    ii.notes,
    substring(ii.notes FROM 'Brand: ([^\|]+)') as brand,
    substring(ii.notes FROM 'Tread: (\d+)mm') as tread_depth,
    substring(ii.notes FROM 'Condition: ([^\|]+)') as condition_status
  FROM inspection_items ii
  JOIN vehicle_inspections vi ON vi.id = ii.inspection_id
  WHERE ii.category = 'tyre'
    AND vi.inspection_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  mi.inspection_date,
  mi.vehicle_registration,
  mi.brand,
  mi.tread_depth,
  mi.condition_status,
  t.id as tyre_id,
  t.serial_number,
  t.brand as db_brand,
  t.current_tread_depth as db_tread_depth,
  t.condition as db_condition,
  t.last_inspection_date,
  'MOBILE_INSPECTION_NOT_SYNCED' as issue
FROM mobile_inspections mi
LEFT JOIN tyres t ON t.brand ILIKE mi.brand 
  AND t.current_tread_depth::text = mi.tread_depth
WHERE t.id IS NULL
  AND mi.tread_depth IS NOT NULL
ORDER BY mi.inspection_date DESC
LIMIT 50;


[
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "brand": "GENERAL ",
    "tread_depth": "7",
    "condition_status": "good ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "brand": "DOUBLESTAR ",
    "tread_depth": "7",
    "condition_status": "good ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "brand": "POWERTRAC ",
    "tread_depth": "6",
    "condition_status": "fair ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "brand": "COMPASAL ",
    "tread_depth": "8",
    "condition_status": "good ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "brand": "GENERAL ",
    "tread_depth": "5",
    "condition_status": "fair ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  },
  {
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "brand": "GENERAL ",
    "tread_depth": "5",
    "condition_status": "fair ",
    "tyre_id": null,
    "serial_number": null,
    "db_brand": null,
    "db_tread_depth": null,
    "db_condition": null,
    "last_inspection_date": null,
    "issue": "MOBILE_INSPECTION_NOT_SYNCED"
  }
]


-- Compare lifecycle events with tyres table updates
SELECT 
  tle.id as event_id,
  tle.event_date,
  tle.tyre_id,
  tle.tread_depth_at_event,
  tle.km_reading,
  tle.notes,
  t.serial_number,
  t.brand,
  t.current_tread_depth as tyre_current_tread,
  t.km_travelled as tyre_km,
  t.last_inspection_date,
  CASE 
    WHEN t.current_tread_depth != tle.tread_depth_at_event THEN 'TREAD_MISMATCH'
    WHEN t.last_inspection_date::date != tle.event_date::date THEN 'DATE_MISMATCH'
    ELSE 'SYNCED'
  END as sync_status
FROM tyre_lifecycle_events tle
LEFT JOIN tyres t ON t.id = tle.tyre_id
WHERE tle.event_type = 'inspected'
  AND tle.event_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY tle.event_date DESC
LIMIT 50;

[
  {
    "event_id": "fefc0e8a-5e55-4f9a-b2c0-2a4b215749b1",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "f3b76310-286c-4003-a547-c886c3df30d0",
    "tread_depth_at_event": "8",
    "km_reading": 131077,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0306",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "30d06208-c9ce-4fc5-8c39-af67c5315fb6",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "193521ae-9e22-42a8-9a38-800af7bb78f6",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0178",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "3887316e-c1d3-4750-b947-2b2a2bc3a6e2",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "60b50c74-9d26-4a61-9ffa-d1c3ff64664a",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0179",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "79d1f4a2-bad6-4492-a7be-51c68a6150ae",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "71adecc7-11fc-47ac-ad3c-af37f9fef4ff",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0181",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "30f9f27f-c083-4ca8-adaf-af86f277a5f9",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "5118fd90-063b-425b-83f8-b53aa9462912",
    "tread_depth_at_event": "6",
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0180",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "2d77a328-739b-452e-bb20-60f2368df47f",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tyre_id": "43723fc3-944c-4e28-a5e8-1995e2f17e5e",
    "tread_depth_at_event": "8",
    "km_reading": 131077,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0307",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "f3bd5c30-46af-4952-841f-fcdad75511ac",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "8210a33e-f44b-40da-bb6a-641639e87237",
    "tread_depth_at_event": "5",
    "km_reading": 124743,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0621",
    "brand": "GENERAL",
    "tyre_current_tread": "5",
    "tyre_km": 19305,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "3700d6e4-ca24-40fe-9551-e20f6bcc1dad",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "7dc0e39a-21cc-4ea9-9479-831d93b06535",
    "tread_depth_at_event": "7",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0622",
    "brand": "GENERAL",
    "tyre_current_tread": "7",
    "tyre_km": 15000,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "683a88f6-1fdf-4436-a3b1-3b0d23fd4aca",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "71247006-ce19-4c5a-b0c9-0e7af26f0dc5",
    "tread_depth_at_event": "7",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0623",
    "brand": "GENERAL",
    "tyre_current_tread": "7",
    "tyre_km": 15000,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "adf4be76-82b9-4408-a964-62563adefe7a",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "12b36a2a-6eed-4c2f-a68d-a46be93a13fd",
    "tread_depth_at_event": "7",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0624",
    "brand": "GENERAL",
    "tyre_current_tread": "7",
    "tyre_km": 15000,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "0465de01-d6be-49e2-b0b9-87b4c2cf4473",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tyre_id": "5d8af00d-185f-42d6-945e-e18727a50fc6",
    "tread_depth_at_event": "5",
    "km_reading": 124743,
    "notes": "Condition: fair | Wear: even",
    "serial_number": "MAT0625",
    "brand": "GENERAL",
    "tyre_current_tread": "5",
    "tyre_km": null,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "138c6e53-83b1-4a86-8692-57539d96a2c4",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "8f9b87e7-c6ff-42ef-8836-d9bb14c61e37",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0472",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "b300c263-3a47-41ca-8425-b88bc80212ef",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "fb5fe069-fd42-4396-abd1-c97d677305a1",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0473",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "1a21b8a3-7663-446e-bc50-82a2b2f3b091",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "87d3203c-5d5a-4d3a-903e-8d6e929be6d4",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0474",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "600d62f2-c249-4ff8-b8dc-207a1402e3f6",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tyre_id": "ef9eb332-b61d-4a67-a344-f384fe6573f9",
    "tread_depth_at_event": "7",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0471",
    "brand": "DOUBLESTAR",
    "tyre_current_tread": "7",
    "tyre_km": 31532,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "827f5840-f546-4e06-b050-053da88ae7aa",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "193521ae-9e22-42a8-9a38-800af7bb78f6",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0178",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "b18668d5-533c-443d-8b65-b07bbc9a7fc2",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "60b50c74-9d26-4a61-9ffa-d1c3ff64664a",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0179",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "b03765da-d15b-4b4e-8201-0bfc07ecbb3c",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "f3b76310-286c-4003-a547-c886c3df30d0",
    "tread_depth_at_event": "8",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0306",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "15d6d85e-25a8-4544-88eb-66c2b9ad32e2",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "71adecc7-11fc-47ac-ad3c-af37f9fef4ff",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0181",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "019b8127-cbdb-402e-a70d-b9d86bb3e601",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "5118fd90-063b-425b-83f8-b53aa9462912",
    "tread_depth_at_event": "6",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0180",
    "brand": "POWERTRAC",
    "tyre_current_tread": "6",
    "tyre_km": 28443,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  },
  {
    "event_id": "dedeeb4a-2f9c-442a-bb83-888a754224e9",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tyre_id": "43723fc3-944c-4e28-a5e8-1995e2f17e5e",
    "tread_depth_at_event": "8",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even",
    "serial_number": "MAT0307",
    "brand": "COMPASAL",
    "tyre_current_tread": "8",
    "tyre_km": 19470,
    "last_inspection_date": "2026-04-01",
    "sync_status": "SYNCED"
  }
]

-- Overall data quality summary
WITH inspection_stats AS (
  SELECT 
    COUNT(DISTINCT vi.id) as total_inspections,
    COUNT(DISTINCT ii.id) as total_tyre_items,
    COUNT(DISTINCT CASE WHEN vi.inspection_date >= CURRENT_DATE - INTERVAL '7 days' THEN vi.id END) as recent_inspections
  FROM vehicle_inspections vi
  JOIN inspection_items ii ON ii.inspection_id = vi.id
  WHERE vi.inspection_type = 'tyre'
),
tyre_update_stats AS (
  SELECT 
    COUNT(*) as total_tyres_updated_last_7days
  FROM tyres
  WHERE last_inspection_date >= CURRENT_DATE - INTERVAL '7 days'
),
lifecycle_event_stats AS (
  SELECT 
    COUNT(*) as total_lifecycle_events_last_7days
  FROM tyre_lifecycle_events
  WHERE event_type = 'inspected'
    AND event_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  is2.total_inspections,
  is2.total_tyre_items,
  is2.recent_inspections,
  tus.total_tyres_updated_last_7days,
  les.total_lifecycle_events_last_7days,
  CASE 
    WHEN is2.recent_inspections > 0 AND tus.total_tyres_updated_last_7days = 0 THEN 'CRITICAL: Inspections not updating tyres table'
    WHEN is2.recent_inspections > tus.total_tyres_updated_last_7days THEN 'WARNING: Some inspections missing from tyres table'
    WHEN les.total_lifecycle_events_last_7days = 0 AND is2.recent_inspections > 0 THEN 'WARNING: No lifecycle events recorded'
    ELSE 'OK'
  END as data_quality_status
FROM inspection_stats is2, tyre_update_stats tus, lifecycle_event_stats les;

[
  {
    "total_inspections": 3,
    "total_tyre_items": 17,
    "recent_inspections": 3,
    "total_tyres_updated_last_7days": 17,
    "total_lifecycle_events_last_7days": 21,
    "data_quality_status": "OK"
  }
]
-- Detailed mismatch report for recent inspections
SELECT 
  vi.inspection_number,
  vi.inspection_date,
  vi.vehicle_registration,
  vi.inspector_name,
  ii.item_name,
  ii.notes as inspection_notes,
  t.id as tyre_id,
  t.serial_number,
  t.brand,
  t.current_tread_depth as tyre_current_tread,
  t.condition as tyre_condition,
  t.last_inspection_date,
  t.km_travelled,
  CASE 
    WHEN t.id IS NULL THEN 'Tyre not found in database'
    WHEN t.current_tread_depth IS NULL THEN 'Tyre has no tread depth recorded'
    WHEN t.last_inspection_date IS NULL THEN 'Tyre never inspected'
    WHEN t.last_inspection_date::date != vi.inspection_date::date THEN 'Last inspection date mismatch'
    WHEN t.current_tread_depth::text != substring(ii.notes FROM 'Tread: (\d+)mm') THEN 'Tread depth mismatch'
    WHEN t.condition::text != substring(ii.notes FROM 'Condition: ([^\|]+)') THEN 'Condition mismatch'
    ELSE 'Match'
  END as mismatch_reason,
  substring(ii.notes FROM 'Tread: (\d+)mm') as inspected_tread,
  substring(ii.notes FROM 'Condition: ([^\|]+)') as inspected_condition
FROM vehicle_inspections vi
JOIN inspection_items ii ON ii.inspection_id = vi.id
LEFT JOIN tyres t ON t.serial_number LIKE '%' || split_part(ii.item_name, '-', 2) || '%'
WHERE vi.inspection_type = 'tyre'
  AND vi.inspection_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY vi.inspection_date DESC
LIMIT 100;

[
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "item_name": "Tyre - V3 - Rear Left Outer",
    "inspection_notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "6",
    "inspected_condition": "fair "
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "item_name": "Tyre - V4 - Rear Left Inner",
    "inspection_notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "6",
    "inspected_condition": "fair "
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "item_name": "Tyre - V1 - Front Left",
    "inspection_notes": "Brand: COMPASAL | Size: 315/80R22.5 | Tread: 8mm | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "8",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "item_name": "Tyre - V5 - Rear Right Inner",
    "inspection_notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "6",
    "inspected_condition": "fair "
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "item_name": "Tyre - V6 - Rear Right Outer",
    "inspection_notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "6",
    "inspected_condition": "fair "
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "item_name": "Tyre - V2 - Front Right",
    "inspection_notes": "Brand: COMPASAL | Size: 315/80R22.5 | Tread: 8mm | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "8",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "item_name": "Tyre - SP - Spare",
    "inspection_notes": "Condition: good",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": null,
    "inspected_condition": "good"
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "inspector_name": "cain",
    "item_name": "Tyre - V4 - Rear Right",
    "inspection_notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "7",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "inspector_name": "cain",
    "item_name": "Tyre - V1 - Front Left",
    "inspection_notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 5mm | Pressure: 30 PSI | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "5",
    "inspected_condition": "fair "
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "inspector_name": "cain",
    "item_name": "Tyre - SP - Spare",
    "inspection_notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 5mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "5",
    "inspected_condition": "fair "
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "inspector_name": "cain",
    "item_name": "Tyre - V2 - Front Right",
    "inspection_notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "7",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "inspector_name": "cain",
    "item_name": "Tyre - V3 - Rear Left",
    "inspection_notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "7",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "inspector_name": "heinrich",
    "item_name": "Tyre - V3 - Rear Left",
    "inspection_notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "7",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "inspector_name": "heinrich",
    "item_name": "Tyre - V4 - Rear Right",
    "inspection_notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "7",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "inspector_name": "heinrich",
    "item_name": "Tyre - V1 - Front Left",
    "inspection_notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "7",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "inspector_name": "heinrich",
    "item_name": "Tyre - V2 - Front Right",
    "inspection_notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": "7",
    "inspected_condition": "good "
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "inspector_name": "heinrich",
    "item_name": "Tyre - SP - Spare",
    "inspection_notes": "No tyre installed at this position",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "tyre_current_tread": null,
    "tyre_condition": null,
    "last_inspection_date": null,
    "km_travelled": null,
    "mismatch_reason": "Tyre not found in database",
    "inspected_tread": null,
    "inspected_condition": null
  }
]


-- Find tyres that need data updates
SELECT 
  id,
  serial_number,
  brand,
  current_tread_depth,
  condition,
  last_inspection_date,
  km_travelled,
  installation_km,
  CASE 
    WHEN current_tread_depth IS NULL THEN 'Missing tread depth'
    WHEN condition IS NULL THEN 'Missing condition'
    WHEN last_inspection_date IS NULL THEN 'Never inspected'
    WHEN km_travelled IS NULL THEN 'Missing km data'
    ELSE 'OK'
  END as data_issue
FROM tyres
WHERE current_tread_depth IS NULL 
   OR condition IS NULL 
   OR last_inspection_date IS NULL
   OR km_travelled IS NULL
ORDER BY last_inspection_date DESC NULLS FIRST
LIMIT 50;


[
  {
    "id": "5cbbef53-1820-4825-9f19-28feee5ab20a",
    "serial_number": "MAT04588",
    "brand": "JINYU",
    "current_tread_depth": "11",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 104242,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "a7fbf7a4-5ac0-43ae-ae72-bc0039276bc7",
    "serial_number": "MAT0183",
    "brand": "Retread",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 2083,
    "installation_km": 33916,
    "data_issue": "Never inspected"
  },
  {
    "id": "ec6efa21-5a80-401c-9181-e6a8d4ca82f1",
    "serial_number": "MAT0517",
    "brand": "MICHELIN",
    "current_tread_depth": "8",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 2348,
    "installation_km": 34235,
    "data_issue": "Never inspected"
  },
  {
    "id": "e09ca894-7fe5-4645-b9e1-7fb67f0b22f5",
    "serial_number": "MAT0530",
    "brand": "FIREMAX",
    "current_tread_depth": "10",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 1295,
    "installation_km": 35288,
    "data_issue": "Never inspected"
  },
  {
    "id": "0b0182b8-0d93-4896-93e8-467257930b03",
    "serial_number": "MAT0536",
    "brand": "FIREMAX",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 952,
    "installation_km": 35631,
    "data_issue": "Never inspected"
  },
  {
    "id": "d6ced357-947b-4b81-a942-df821ee30e2e",
    "serial_number": "MAT0014",
    "brand": "LAVINGATOR",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": null,
    "installation_km": null,
    "data_issue": "Never inspected"
  },
  {
    "id": "2a431e4b-6cf9-4f7c-a7f6-f9e7fb3be45f",
    "serial_number": "MAT0107",
    "brand": "FORMULA",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": null,
    "installation_km": null,
    "data_issue": "Never inspected"
  },
  {
    "id": "03703ab1-55ce-4158-9589-f06f605e5bda",
    "serial_number": "MAT0300",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "fea4b199-994d-440a-aba3-8e4a807b5713",
    "serial_number": "MAT0534",
    "brand": "FIREMAX",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 952,
    "installation_km": 35631,
    "data_issue": "Never inspected"
  },
  {
    "id": "133041a3-3732-42e3-a74a-aa046ddfe54a",
    "serial_number": "MAT0587",
    "brand": "FIREMAX",
    "current_tread_depth": "15",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 153269,
    "data_issue": "Never inspected"
  },
  {
    "id": "a474afcd-1053-4d38-94de-d1721812cece",
    "serial_number": "MAT0169",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "e43cac02-4aaa-49c1-804f-c2ba5ac27183",
    "serial_number": "MAT0187",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "30ed5454-bc3a-4834-80d7-0aaf5dc4c4e3",
    "serial_number": "MAT0168",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "2775c2b0-102a-49e3-bc1c-c65dfecb8eff",
    "serial_number": "MAT0189",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "fea5a33c-c599-430a-9a5e-a5ecbf333c70",
    "serial_number": "MAT0586",
    "brand": "FIREMAX",
    "current_tread_depth": "15",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 153269,
    "data_issue": "Never inspected"
  },
  {
    "id": "febed911-c8a8-4a1d-bf35-e61c0aff9245",
    "serial_number": "MAT0086",
    "brand": "RETHREAD",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 886,
    "installation_km": 146849,
    "data_issue": "Never inspected"
  },
  {
    "id": "42f98b50-2083-41df-a283-dccd007232f4",
    "serial_number": "MAT0058",
    "brand": "RETHREAD",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 886,
    "installation_km": 146849,
    "data_issue": "Never inspected"
  },
  {
    "id": "188e0132-db2d-4b52-8f6f-e14de02eea7d",
    "serial_number": "MAT0085",
    "brand": "RETHREAD",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 886,
    "installation_km": 146849,
    "data_issue": "Never inspected"
  },
  {
    "id": "69c122ec-6c87-4072-9054-413420978820",
    "serial_number": "MAT0608",
    "brand": "JINYU",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 4862,
    "data_issue": "Never inspected"
  },
  {
    "id": "a1bb1f79-aeb9-4cfd-be36-e81761bd9a61",
    "serial_number": "MAT0191",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "b2639277-77e9-4f63-9585-0c8e1db7c487",
    "serial_number": "MAT0291",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "cfe43f13-5767-407e-a134-e852bc6bd92d",
    "serial_number": "MAT0606",
    "brand": "COMPASAL",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 4862,
    "data_issue": "Never inspected"
  },
  {
    "id": "a468a2ab-46b6-4bb4-8b88-5112a04a3995",
    "serial_number": "MAT0605",
    "brand": "EVERGREEN",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 4862,
    "data_issue": "Never inspected"
  },
  {
    "id": "d63f1491-cb27-49ba-b885-de3c4b6cf2ac",
    "serial_number": "MAT0171",
    "brand": "KHUMO",
    "current_tread_depth": "8",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 18731,
    "installation_km": 658760,
    "data_issue": "Never inspected"
  },
  {
    "id": "000d417b-c53e-4efb-8669-91641552cddc",
    "serial_number": "MAT0173",
    "brand": "KHUMO",
    "current_tread_depth": "8",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 18731,
    "installation_km": 658760,
    "data_issue": "Never inspected"
  },
  {
    "id": "7faa0c71-1e15-424b-833c-eea3825a3e15",
    "serial_number": "MAT0172",
    "brand": "KHUMO",
    "current_tread_depth": "8",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 18731,
    "installation_km": 658760,
    "data_issue": "Never inspected"
  },
  {
    "id": "471ca6b2-6dac-4fba-97f9-7ad842f279e2",
    "serial_number": "MAT0174",
    "brand": "KHUMO",
    "current_tread_depth": "8",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 18731,
    "installation_km": 658760,
    "data_issue": "Never inspected"
  },
  {
    "id": "a722a711-ff3f-40f5-958f-e018e1116865",
    "serial_number": null,
    "brand": "FIREMAX",
    "current_tread_depth": "15",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 191483,
    "data_issue": "Never inspected"
  },
  {
    "id": "dddb1c1b-764e-423b-bc52-c38edc5e515c",
    "serial_number": "MAT0641",
    "brand": "WINDFORCE",
    "current_tread_depth": "15",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": null,
    "installation_km": 1139416,
    "data_issue": "Never inspected"
  },
  {
    "id": "5e4b8719-aa1e-4bfa-8fe6-098cadc2ac7d",
    "serial_number": "MAT0170",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "fair",
    "last_inspection_date": null,
    "km_travelled": 149959,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "62496626-1cbb-47cc-a943-1c3362353114",
    "serial_number": "MAT0604",
    "brand": "COMPASAL",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 4862,
    "data_issue": "Never inspected"
  },
  {
    "id": "f3b6f798-d8d9-4801-b56d-31ce1f4075b3",
    "serial_number": null,
    "brand": "JINYU",
    "current_tread_depth": "10",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 171862,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "0ac7bb70-24a1-48a9-b58f-ebe114a89041",
    "serial_number": "MAT0153",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "fair",
    "last_inspection_date": null,
    "km_travelled": 104957,
    "installation_km": 42778,
    "data_issue": "Never inspected"
  },
  {
    "id": "4ba43e10-dbc8-4124-b9b7-3a68c9a99f44",
    "serial_number": "MAT0110",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "fair",
    "last_inspection_date": null,
    "km_travelled": 104957,
    "installation_km": 42778,
    "data_issue": "Never inspected"
  },
  {
    "id": "16f058e5-1c63-4bff-abb6-e09ff52319b6",
    "serial_number": "MAT0521",
    "brand": "Retread",
    "current_tread_depth": "9",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 49,
    "installation_km": 35950,
    "data_issue": "Never inspected"
  },
  {
    "id": "10301100-bfbb-41bd-831b-e36d57cb8181",
    "serial_number": "MAT0600",
    "brand": "JINYU",
    "current_tread_depth": "20",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 1685,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "ea8c3e22-e7c9-4cb3-af2b-27f217fe4d5a",
    "serial_number": "MAT0457",
    "brand": "JINYU",
    "current_tread_depth": "11",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 104242,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "17a7245b-e8ae-4438-915e-74a247b7753e",
    "serial_number": "MAT0647",
    "brand": "WELLPLUS",
    "current_tread_depth": "15",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 574,
    "installation_km": 175000,
    "data_issue": "Never inspected"
  },
  {
    "id": "92af50ac-2aba-41b5-b467-abfead8d15a3",
    "serial_number": "MAT0511",
    "brand": "LINGLONG",
    "current_tread_depth": "9",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 64746,
    "installation_km": null,
    "data_issue": "Never inspected"
  },
  {
    "id": "c41f0429-a8ea-4894-bd55-d79895d34ca6",
    "serial_number": "MAT0142",
    "brand": "RETHREAD",
    "current_tread_depth": "7",
    "condition": "fair",
    "last_inspection_date": null,
    "km_travelled": 104957,
    "installation_km": 42778,
    "data_issue": "Never inspected"
  },
  {
    "id": "7a417dd9-a804-4903-a0aa-f66c2f9c65f7",
    "serial_number": "MAT0609",
    "brand": "BRIDGESTONE",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 4862,
    "data_issue": "Never inspected"
  },
  {
    "id": "f0bfebf4-99e0-4959-8d9e-d6b9f85d78ab",
    "serial_number": "MAT0427",
    "brand": "JINYU",
    "current_tread_depth": "12",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 100401,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "b24e3ace-c2a1-4c33-9ed6-b1fa00d2c62f",
    "serial_number": "MAT0607",
    "brand": "EVERGREEN",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 0,
    "installation_km": 4862,
    "data_issue": "Never inspected"
  },
  {
    "id": "0b36bd05-a930-4283-bd36-e74c94aa21f1",
    "serial_number": "MAT0012",
    "brand": "Retread",
    "current_tread_depth": "8",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 115,
    "installation_km": 35884,
    "data_issue": "Never inspected"
  },
  {
    "id": "640340a4-c2fe-4a21-bd45-3d1a01e34b24",
    "serial_number": "MAT0602",
    "brand": "JINYU",
    "current_tread_depth": "20",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 1685,
    "installation_km": 0,
    "data_issue": "Never inspected"
  },
  {
    "id": "5539435c-34d3-419f-ac5a-941d7a988d05",
    "serial_number": "MAT0642",
    "brand": "WINDFORCE",
    "current_tread_depth": "15",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": null,
    "installation_km": 1139416,
    "data_issue": "Never inspected"
  },
  {
    "id": "fa2a6d09-27dc-4fa2-8e06-668decb9ff1b",
    "serial_number": "MAT0114",
    "brand": "RETHREAD",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": 886,
    "installation_km": 146849,
    "data_issue": "Never inspected"
  },
  {
    "id": "56f9e82a-e9d0-45b7-a0a4-9f31b3e918e7",
    "serial_number": "MAT0610",
    "brand": "JINYU",
    "current_tread_depth": "12",
    "condition": "excellent",
    "last_inspection_date": null,
    "km_travelled": null,
    "installation_km": null,
    "data_issue": "Never inspected"
  },
  {
    "id": "acd82657-d06a-4f82-9928-d8421da19422",
    "serial_number": "MAT0513",
    "brand": "LINGLONG",
    "current_tread_depth": "9",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 64746,
    "installation_km": null,
    "data_issue": "Never inspected"
  },
  {
    "id": "1e03485f-2f7a-4e59-b938-2b048b75aa24",
    "serial_number": "MAT0429",
    "brand": "JINYU",
    "current_tread_depth": "12",
    "condition": "good",
    "last_inspection_date": null,
    "km_travelled": 100401,
    "installation_km": 0,
    "data_issue": "Never inspected"
  }
]
-- See how inspections map to actual tyres
SELECT 
  vi.inspection_number,
  vi.inspection_date,
  vi.vehicle_registration,
  ii.item_name,
  ii.notes,
  t.id as tyre_id,
  t.serial_number,
  t.brand,
  t.current_tread_depth,
  t.condition,
  CASE 
    WHEN t.id IS NULL THEN 'NO MATCHING TYRE'
    WHEN t.current_tread_depth::text = substring(ii.notes FROM 'Tread: (\d+)mm') 
      AND t.condition::text = substring(ii.notes FROM 'Condition: ([^\|]+)') 
    THEN 'MATCHED'
    ELSE 'PARTIAL MATCH'
  END as match_status
FROM vehicle_inspections vi
JOIN inspection_items ii ON ii.inspection_id = vi.id
LEFT JOIN tyres t ON t.serial_number LIKE '%' || split_part(ii.item_name, '-', 2) || '%'
WHERE vi.inspection_type = 'tyre'
  AND vi.inspection_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY vi.inspection_date DESC
LIMIT 100;

[
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V3 - Rear Left Outer",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V4 - Rear Left Inner",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V1 - Front Left",
    "notes": "Brand: COMPASAL | Size: 315/80R22.5 | Tread: 8mm | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V5 - Rear Right Inner",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V6 - Rear Right Outer",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - V2 - Front Right",
    "notes": "Brand: COMPASAL | Size: 315/80R22.5 | Tread: 8mm | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739",
    "item_name": "Tyre - SP - Spare",
    "notes": "Condition: good",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - V4 - Rear Right",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - V1 - Front Left",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 5mm | Pressure: 30 PSI | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - SP - Spare",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 5mm | Condition: fair | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - V2 - Front Right",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056",
    "item_name": "Tyre - V3 - Rear Left",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "item_name": "Tyre - V3 - Rear Left",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "item_name": "Tyre - V4 - Rear Right",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "item_name": "Tyre - V1 - Front Left",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "item_name": "Tyre - V2 - Front Right",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  },
  {
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918",
    "item_name": "Tyre - SP - Spare",
    "notes": "No tyre installed at this position",
    "tyre_id": null,
    "serial_number": null,
    "brand": null,
    "current_tread_depth": null,
    "condition": null,
    "match_status": "NO MATCHING TYRE"
  }
]

