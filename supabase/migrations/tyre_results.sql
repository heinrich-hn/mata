-- 1. Check if tyre_inspections table has ANY data (likely empty - never written to)
SELECT COUNT(*) AS total_tyre_inspections FROM tyre_inspections;

[
  {
    "total_tyre_inspections": 179
  }
]


-- 2. Check vehicle_inspections for tyre-type inspections (this is where mobile saves)
SELECT id, inspection_number, inspection_date, inspection_type, 
       vehicle_registration, inspector_name, odometer_reading, status, has_fault
FROM vehicle_inspections 
WHERE inspection_type ILIKE '%tyre%'
ORDER BY inspection_date DESC 
LIMIT 20;

[
  {
    "id": "727cd7ea-8bf1-460a-94af-40438681d10e",
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "inspection_type": "tyre",
    "vehicle_registration": "14L ABA3918",
    "inspector_name": "heinrich",
    "odometer_reading": 640083,
    "status": "completed",
    "has_fault": false
  },
  {
    "id": "8b6dcfcd-f9ca-4ec7-86b9-e11edcac0a9b",
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "inspection_type": "tyre",
    "vehicle_registration": "16L AGT9056",
    "inspector_name": "cain",
    "odometer_reading": 124743,
    "status": "completed",
    "has_fault": false
  },
  {
    "id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "inspection_type": "tyre",
    "vehicle_registration": "ABJ3739",
    "inspector_name": "cain",
    "odometer_reading": 131077,
    "status": "completed",
    "has_fault": false
  }
]



-- 3. Check inspection_items with tyre category (actual tyre data from mobile inspections)
SELECT ii.inspection_id, ii.item_name, ii.category, ii.status, ii.notes,
       vi.inspection_number, vi.inspection_date, vi.vehicle_registration
FROM inspection_items ii
JOIN vehicle_inspections vi ON vi.id = ii.inspection_id
WHERE ii.category = 'tyre'
ORDER BY vi.inspection_date DESC 
LIMIT 30;

[
  {
    "inspection_id": "727cd7ea-8bf1-460a-94af-40438681d10e",
    "item_name": "Tyre - V3 - Rear Left",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918"
  },
  {
    "inspection_id": "727cd7ea-8bf1-460a-94af-40438681d10e",
    "item_name": "Tyre - V4 - Rear Right",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918"
  },
  {
    "inspection_id": "8b6dcfcd-f9ca-4ec7-86b9-e11edcac0a9b",
    "item_name": "Tyre - V4 - Rear Right",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056"
  },
  {
    "inspection_id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "item_name": "Tyre - V3 - Rear Left Outer",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739"
  },
  {
    "inspection_id": "8b6dcfcd-f9ca-4ec7-86b9-e11edcac0a9b",
    "item_name": "Tyre - V1 - Front Left",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 5mm | Pressure: 30 PSI | Condition: fair | Wear: even",
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056"
  },
  {
    "inspection_id": "8b6dcfcd-f9ca-4ec7-86b9-e11edcac0a9b",
    "item_name": "Tyre - SP - Spare",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 5mm | Condition: fair | Wear: even",
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056"
  },
  {
    "inspection_id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "item_name": "Tyre - V4 - Rear Left Inner",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739"
  },
  {
    "inspection_id": "727cd7ea-8bf1-460a-94af-40438681d10e",
    "item_name": "Tyre - V1 - Front Left",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918"
  },
  {
    "inspection_id": "8b6dcfcd-f9ca-4ec7-86b9-e11edcac0a9b",
    "item_name": "Tyre - V2 - Front Right",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056"
  },
  {
    "inspection_id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "item_name": "Tyre - V1 - Front Left",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: COMPASAL | Size: 315/80R22.5 | Tread: 8mm | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739"
  },
  {
    "inspection_id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "item_name": "Tyre - V5 - Rear Right Inner",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739"
  },
  {
    "inspection_id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "item_name": "Tyre - V6 - Rear Right Outer",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: POWERTRAC | Size: 315/80R22.5 | Tread: 6mm | Condition: fair | Wear: even",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739"
  },
  {
    "inspection_id": "727cd7ea-8bf1-460a-94af-40438681d10e",
    "item_name": "Tyre - V2 - Front Right",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: DOUBLESTAR | Size: 195R14C | Tread: 7mm | Pressure: 2 PSI | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918"
  },
  {
    "inspection_id": "727cd7ea-8bf1-460a-94af-40438681d10e",
    "item_name": "Tyre - SP - Spare",
    "category": "tyre",
    "status": "pass",
    "notes": "No tyre installed at this position",
    "inspection_number": "TYRE-20260401-071724",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "14L ABA3918"
  },
  {
    "inspection_id": "8b6dcfcd-f9ca-4ec7-86b9-e11edcac0a9b",
    "item_name": "Tyre - V3 - Rear Left",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: GENERAL | Size: 255/60R18 | Tread: 7mm | Pressure: 30 PSI | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-074414",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "16L AGT9056"
  },
  {
    "inspection_id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "item_name": "Tyre - V2 - Front Right",
    "category": "tyre",
    "status": "pass",
    "notes": "Brand: COMPASAL | Size: 315/80R22.5 | Tread: 8mm | Condition: good | Wear: even",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739"
  },
  {
    "inspection_id": "5c949377-2aed-435b-bb84-1e5f19d64edf",
    "item_name": "Tyre - SP - Spare",
    "category": "tyre",
    "status": "pass",
    "notes": "Condition: good",
    "inspection_number": "TYRE-20260401-075232",
    "inspection_date": "2026-04-01 00:00:00+00",
    "vehicle_registration": "ABJ3739"
  }
]

-- 4. Check tyre_lifecycle_events (written by mobile on inspection)
SELECT id, tyre_id, event_type, event_date, tread_depth_at_event, 
       pressure_at_event, km_reading, notes
FROM tyre_lifecycle_events 
WHERE event_type = 'inspected'
ORDER BY event_date DESC 
LIMIT 20;


[
  {
    "id": "fefc0e8a-5e55-4f9a-b2c0-2a4b215749b1",
    "tyre_id": "f3b76310-286c-4003-a547-c886c3df30d0",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tread_depth_at_event": "8",
    "pressure_at_event": null,
    "km_reading": 131077,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "30d06208-c9ce-4fc5-8c39-af67c5315fb6",
    "tyre_id": "193521ae-9e22-42a8-9a38-800af7bb78f6",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": null,
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even"
  },
  {
    "id": "3887316e-c1d3-4750-b947-2b2a2bc3a6e2",
    "tyre_id": "60b50c74-9d26-4a61-9ffa-d1c3ff64664a",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": null,
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even"
  },
  {
    "id": "79d1f4a2-bad6-4492-a7be-51c68a6150ae",
    "tyre_id": "71adecc7-11fc-47ac-ad3c-af37f9fef4ff",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": null,
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even"
  },
  {
    "id": "30f9f27f-c083-4ca8-adaf-af86f277a5f9",
    "tyre_id": "5118fd90-063b-425b-83f8-b53aa9462912",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": null,
    "km_reading": 131077,
    "notes": "Condition: fair | Wear: even"
  },
  {
    "id": "2d77a328-739b-452e-bb20-60f2368df47f",
    "tyre_id": "43723fc3-944c-4e28-a5e8-1995e2f17e5e",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:52:32.501+00",
    "tread_depth_at_event": "8",
    "pressure_at_event": null,
    "km_reading": 131077,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "f3bd5c30-46af-4952-841f-fcdad75511ac",
    "tyre_id": "8210a33e-f44b-40da-bb6a-641639e87237",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tread_depth_at_event": "5",
    "pressure_at_event": "30",
    "km_reading": 124743,
    "notes": "Condition: fair | Wear: even"
  },
  {
    "id": "3700d6e4-ca24-40fe-9551-e20f6bcc1dad",
    "tyre_id": "7dc0e39a-21cc-4ea9-9479-831d93b06535",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tread_depth_at_event": "7",
    "pressure_at_event": "30",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "683a88f6-1fdf-4436-a3b1-3b0d23fd4aca",
    "tyre_id": "71247006-ce19-4c5a-b0c9-0e7af26f0dc5",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tread_depth_at_event": "7",
    "pressure_at_event": "30",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "adf4be76-82b9-4408-a964-62563adefe7a",
    "tyre_id": "12b36a2a-6eed-4c2f-a68d-a46be93a13fd",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tread_depth_at_event": "7",
    "pressure_at_event": "30",
    "km_reading": 124743,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "0465de01-d6be-49e2-b0b9-87b4c2cf4473",
    "tyre_id": "5d8af00d-185f-42d6-945e-e18727a50fc6",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:44:14.268+00",
    "tread_depth_at_event": "5",
    "pressure_at_event": null,
    "km_reading": 124743,
    "notes": "Condition: fair | Wear: even"
  },
  {
    "id": "138c6e53-83b1-4a86-8692-57539d96a2c4",
    "tyre_id": "8f9b87e7-c6ff-42ef-8836-d9bb14c61e37",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tread_depth_at_event": "7",
    "pressure_at_event": "2",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "b300c263-3a47-41ca-8425-b88bc80212ef",
    "tyre_id": "fb5fe069-fd42-4396-abd1-c97d677305a1",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tread_depth_at_event": "7",
    "pressure_at_event": "2",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "1a21b8a3-7663-446e-bc50-82a2b2f3b091",
    "tyre_id": "87d3203c-5d5a-4d3a-903e-8d6e929be6d4",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tread_depth_at_event": "7",
    "pressure_at_event": "2",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "600d62f2-c249-4ff8-b8dc-207a1402e3f6",
    "tyre_id": "ef9eb332-b61d-4a67-a344-f384fe6573f9",
    "event_type": "inspected",
    "event_date": "2026-04-01 05:17:24.788+00",
    "tread_depth_at_event": "7",
    "pressure_at_event": "2",
    "km_reading": 640083,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "827f5840-f546-4e06-b050-053da88ae7aa",
    "tyre_id": "193521ae-9e22-42a8-9a38-800af7bb78f6",
    "event_type": "inspected",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": "5",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "b18668d5-533c-443d-8b65-b07bbc9a7fc2",
    "tyre_id": "60b50c74-9d26-4a61-9ffa-d1c3ff64664a",
    "event_type": "inspected",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": "5",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "b03765da-d15b-4b4e-8201-0bfc07ecbb3c",
    "tyre_id": "f3b76310-286c-4003-a547-c886c3df30d0",
    "event_type": "inspected",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tread_depth_at_event": "8",
    "pressure_at_event": "5",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "15d6d85e-25a8-4544-88eb-66c2b9ad32e2",
    "tyre_id": "71adecc7-11fc-47ac-ad3c-af37f9fef4ff",
    "event_type": "inspected",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": "5",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even"
  },
  {
    "id": "019b8127-cbdb-402e-a70d-b9d86bb3e601",
    "tyre_id": "5118fd90-063b-425b-83f8-b53aa9462912",
    "event_type": "inspected",
    "event_date": "2026-04-01 04:55:41.008+00",
    "tread_depth_at_event": "6",
    "pressure_at_event": "5",
    "km_reading": 131025,
    "notes": "Condition: good | Wear: even"
  }
]

-- 5. Check tyres table - last_inspection_date and km_travelled values
SELECT id, brand, size, dot_code, serial_number, condition, 
       current_tread_depth, initial_tread_depth, 
       installation_km, km_travelled, last_inspection_date,
       purchase_cost_zar
FROM tyres
WHERE last_inspection_date IS NOT NULL
ORDER BY last_inspection_date DESC 
LIMIT 20;


[
  {
    "id": "8210a33e-f44b-40da-bb6a-641639e87237",
    "brand": "GENERAL",
    "size": "255/60R18",
    "dot_code": null,
    "serial_number": "MAT0621",
    "condition": "fair",
    "current_tread_depth": "5",
    "initial_tread_depth": null,
    "installation_km": 105438,
    "km_travelled": 19305,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "12b36a2a-6eed-4c2f-a68d-a46be93a13fd",
    "brand": "GENERAL",
    "size": "255/60R18",
    "dot_code": null,
    "serial_number": "MAT0624",
    "condition": "good",
    "current_tread_depth": "7",
    "initial_tread_depth": null,
    "installation_km": 105438,
    "km_travelled": 15000,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "fb5fe069-fd42-4396-abd1-c97d677305a1",
    "brand": "DOUBLESTAR",
    "size": "195R14C",
    "dot_code": null,
    "serial_number": "MAT0473",
    "condition": "good",
    "current_tread_depth": "7",
    "initial_tread_depth": null,
    "installation_km": 625813,
    "km_travelled": 31532,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "5d8af00d-185f-42d6-945e-e18727a50fc6",
    "brand": "GENERAL",
    "size": "255/60R18",
    "dot_code": null,
    "serial_number": "MAT0625",
    "condition": "fair",
    "current_tread_depth": "5",
    "initial_tread_depth": null,
    "installation_km": null,
    "km_travelled": null,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "f3b76310-286c-4003-a547-c886c3df30d0",
    "brand": "COMPASAL",
    "size": "315/80R22.5",
    "dot_code": "MAT0306",
    "serial_number": "MAT0306",
    "condition": "good",
    "current_tread_depth": "8",
    "initial_tread_depth": "15",
    "installation_km": 142122,
    "km_travelled": 19470,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": "235"
  },
  {
    "id": "193521ae-9e22-42a8-9a38-800af7bb78f6",
    "brand": "POWERTRAC",
    "size": "315/80R22.5",
    "dot_code": "MAT0178",
    "serial_number": "MAT0178",
    "condition": "fair",
    "current_tread_depth": "6",
    "initial_tread_depth": "15",
    "installation_km": 133149,
    "km_travelled": 28443,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": "235"
  },
  {
    "id": "5118fd90-063b-425b-83f8-b53aa9462912",
    "brand": "POWERTRAC",
    "size": "315/80R22.5",
    "dot_code": "MAT0180",
    "serial_number": "MAT0180",
    "condition": "fair",
    "current_tread_depth": "6",
    "initial_tread_depth": "15",
    "installation_km": 133149,
    "km_travelled": 28443,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": "235"
  },
  {
    "id": "60b50c74-9d26-4a61-9ffa-d1c3ff64664a",
    "brand": "POWERTRAC",
    "size": "315/80R22.5",
    "dot_code": "MAT0179",
    "serial_number": "MAT0179",
    "condition": "fair",
    "current_tread_depth": "6",
    "initial_tread_depth": "15",
    "installation_km": 133149,
    "km_travelled": 28443,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": "235"
  },
  {
    "id": "71adecc7-11fc-47ac-ad3c-af37f9fef4ff",
    "brand": "POWERTRAC",
    "size": "315/80R22.5",
    "dot_code": null,
    "serial_number": "MAT0181",
    "condition": "fair",
    "current_tread_depth": "6",
    "initial_tread_depth": "15",
    "installation_km": 133149,
    "km_travelled": 28443,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": "235"
  },
  {
    "id": "43723fc3-944c-4e28-a5e8-1995e2f17e5e",
    "brand": "COMPASAL",
    "size": "315/80R22.5",
    "dot_code": null,
    "serial_number": "MAT0307",
    "condition": "good",
    "current_tread_depth": "8",
    "initial_tread_depth": "15",
    "installation_km": 142122,
    "km_travelled": 19470,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": "235"
  },
  {
    "id": "87d3203c-5d5a-4d3a-903e-8d6e929be6d4",
    "brand": "DOUBLESTAR",
    "size": "195R14C",
    "dot_code": null,
    "serial_number": "MAT0474",
    "condition": "good",
    "current_tread_depth": "7",
    "initial_tread_depth": null,
    "installation_km": 625813,
    "km_travelled": 31532,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "ef9eb332-b61d-4a67-a344-f384fe6573f9",
    "brand": "DOUBLESTAR",
    "size": "195R14C",
    "dot_code": "MAT0471",
    "serial_number": "MAT0471",
    "condition": "good",
    "current_tread_depth": "7",
    "initial_tread_depth": "10",
    "installation_km": 625813,
    "km_travelled": 31532,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "8f9b87e7-c6ff-42ef-8836-d9bb14c61e37",
    "brand": "DOUBLESTAR",
    "size": "195R14C",
    "dot_code": null,
    "serial_number": "MAT0472",
    "condition": "good",
    "current_tread_depth": "7",
    "initial_tread_depth": null,
    "installation_km": 625813,
    "km_travelled": 31532,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "7dc0e39a-21cc-4ea9-9479-831d93b06535",
    "brand": "GENERAL",
    "size": "255/60R18",
    "dot_code": null,
    "serial_number": "MAT0622",
    "condition": "good",
    "current_tread_depth": "7",
    "initial_tread_depth": null,
    "installation_km": 105438,
    "km_travelled": 15000,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "71247006-ce19-4c5a-b0c9-0e7af26f0dc5",
    "brand": "GENERAL",
    "size": "255/60R18",
    "dot_code": null,
    "serial_number": "MAT0623",
    "condition": "good",
    "current_tread_depth": "7",
    "initial_tread_depth": null,
    "installation_km": 105438,
    "km_travelled": 15000,
    "last_inspection_date": "2026-04-01",
    "purchase_cost_zar": null
  },
  {
    "id": "794af1c3-3b75-476d-b98c-156b96f39f80",
    "brand": "FIREMAX",
    "size": "385/80R22.5",
    "dot_code": "MAT0542",
    "serial_number": null,
    "condition": "good",
    "current_tread_depth": "11",
    "initial_tread_depth": "15",
    "installation_km": 105189,
    "km_travelled": 69811,
    "last_inspection_date": "2026-03-26",
    "purchase_cost_zar": null
  },
  {
    "id": "25c5019f-37cd-4553-bc93-22de1cf74cc2",
    "brand": "FIREMAX",
    "size": "385/80R22.5",
    "dot_code": "MAT0532",
    "serial_number": null,
    "condition": "good",
    "current_tread_depth": "11",
    "initial_tread_depth": "15",
    "installation_km": 105189,
    "km_travelled": 69811,
    "last_inspection_date": "2026-03-26",
    "purchase_cost_zar": null
  },
  {
    "id": "e7fefb9b-6c27-4151-b9e8-2a8d9eb8e8f7",
    "brand": "FIREMAX",
    "size": "385/65R22.5",
    "dot_code": "MAT0532",
    "serial_number": null,
    "condition": "good",
    "current_tread_depth": "11",
    "initial_tread_depth": "15",
    "installation_km": 35675,
    "km_travelled": 15,
    "last_inspection_date": "2026-03-24",
    "purchase_cost_zar": null
  },
  {
    "id": "0670e30f-24c7-4f1b-a2a7-238625de8e17",
    "brand": "FIREMAX",
    "size": "385/65R22.5",
    "dot_code": "MAT0542",
    "serial_number": null,
    "condition": "good",
    "current_tread_depth": "11",
    "initial_tread_depth": "15",
    "installation_km": 35675,
    "km_travelled": 15,
    "last_inspection_date": "2026-03-24",
    "purchase_cost_zar": null
  },
  {
    "id": "5fccc48e-4454-4080-aada-8bc76432991f",
    "brand": "AOSEN",
    "size": "385/65R22.5",
    "dot_code": null,
    "serial_number": "MAT0493",
    "condition": "good",
    "current_tread_depth": "11",
    "initial_tread_depth": null,
    "installation_km": 34165,
    "km_travelled": 1508,
    "last_inspection_date": "2026-03-24",
    "purchase_cost_zar": null
  }
]



-- 6. Cross-check: vehicles with fleet_tyre_positions linked to tyres
SELECT v.registration_number, v.fleet_number, v.current_odometer,
       ftp.position, ftp.tyre_code,
       t.brand, t.installation_km, t.km_travelled, t.current_tread_depth
FROM vehicles v
JOIN fleet_tyre_positions ftp ON ftp.fleet_number = v.fleet_number
LEFT JOIN tyres t ON t.id::text = ftp.tyre_code  -- Cast uuid to text for comparison
WHERE ftp.tyre_code IS NOT NULL 
  AND ftp.tyre_code != ''
  AND NOT ftp.tyre_code LIKE 'NEW_CODE_%'
ORDER BY v.fleet_number, ftp.position
LIMIT 30;

[
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V1",
    "tyre_code": "ef9eb332-b61d-4a67-a344-f384fe6573f9",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V2",
    "tyre_code": "8f9b87e7-c6ff-42ef-8836-d9bb14c61e37",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V3",
    "tyre_code": "fb5fe069-fd42-4396-abd1-c97d677305a1",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V4",
    "tyre_code": "87d3203c-5d5a-4d3a-903e-8d6e929be6d4",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V1",
    "tyre_code": "d63f1491-cb27-49ba-b885-de3c4b6cf2ac",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V2",
    "tyre_code": "7faa0c71-1e15-424b-833c-eea3825a3e15",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V3",
    "tyre_code": "000d417b-c53e-4efb-8669-91641552cddc",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V4",
    "tyre_code": "471ca6b2-6dac-4fba-97f9-7ad842f279e2",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "SP",
    "tyre_code": "5d8af00d-185f-42d6-945e-e18727a50fc6",
    "brand": "GENERAL",
    "installation_km": null,
    "km_travelled": null,
    "current_tread_depth": "5"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V1",
    "tyre_code": "8210a33e-f44b-40da-bb6a-641639e87237",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 19305,
    "current_tread_depth": "5"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V2",
    "tyre_code": "7dc0e39a-21cc-4ea9-9479-831d93b06535",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 15000,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V3",
    "tyre_code": "71247006-ce19-4c5a-b0c9-0e7af26f0dc5",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 15000,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V4",
    "tyre_code": "12b36a2a-6eed-4c2f-a68d-a46be93a13fd",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 15000,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V1",
    "tyre_code": "62f1bf41-0882-41b6-aeef-40f55f12e298",
    "brand": "POWERTRAC",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "6"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V2",
    "tyre_code": "31633238-f8c0-4448-9b68-40d46ec8b7c7",
    "brand": "POWERTRAC",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "6"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V3",
    "tyre_code": "b2349505-a072-4de9-92d4-91504e224f9c",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V4",
    "tyre_code": "c918587c-5a51-4ae5-982f-3471a5806c0a",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V5",
    "tyre_code": "5f7916ae-c09e-4530-9689-bb1924624f52",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V6",
    "tyre_code": "890480de-e0d4-442c-9414-29291205dd56",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T1",
    "tyre_code": "6b115960-160d-403d-873f-0fe35cc86358",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T10",
    "tyre_code": "03703ab1-55ce-4158-9589-f06f605e5bda",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T11",
    "tyre_code": "a1bb1f79-aeb9-4cfd-be36-e81761bd9a61",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T12",
    "tyre_code": "b2639277-77e9-4f63-9585-0c8e1db7c487",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T13",
    "tyre_code": "a474afcd-1053-4d38-94de-d1721812cece",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T14",
    "tyre_code": "e43cac02-4aaa-49c1-804f-c2ba5ac27183",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T15",
    "tyre_code": "30ed5454-bc3a-4834-80d7-0aaf5dc4c4e3",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T16",
    "tyre_code": "2775c2b0-102a-49e3-bc1c-c65dfecb8eff",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T2",
    "tyre_code": "b274f7c1-d992-4f6f-ae94-50b36d526efd",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T3",
    "tyre_code": "ed72436c-9642-4b77-bf37-b95bc5833530",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T4",
    "tyre_code": "523ae169-6ca2-45ea-b6f0-d090e126e267",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  }
]

-- Alternative: Cast tyre_code to uuid if it contains valid UUID values
SELECT v.registration_number, v.fleet_number, v.current_odometer,
       ftp.position, ftp.tyre_code,
       t.brand, t.installation_km, t.km_travelled, t.current_tread_depth
FROM vehicles v
JOIN fleet_tyre_positions ftp ON ftp.fleet_number = v.fleet_number
LEFT JOIN tyres t ON t.id = ftp.tyre_code::uuid  -- Cast text to uuid
WHERE ftp.tyre_code IS NOT NULL 
  AND ftp.tyre_code != ''
  AND NOT ftp.tyre_code LIKE 'NEW_CODE_%'
ORDER BY v.fleet_number, ftp.position
LIMIT 30;


[
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V1",
    "tyre_code": "ef9eb332-b61d-4a67-a344-f384fe6573f9",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V2",
    "tyre_code": "8f9b87e7-c6ff-42ef-8836-d9bb14c61e37",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V3",
    "tyre_code": "fb5fe069-fd42-4396-abd1-c97d677305a1",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "14L ABA3918",
    "fleet_number": "14L",
    "current_odometer": 638010,
    "position": "V4",
    "tyre_code": "87d3203c-5d5a-4d3a-903e-8d6e929be6d4",
    "brand": "DOUBLESTAR",
    "installation_km": 625813,
    "km_travelled": 31532,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V1",
    "tyre_code": "d63f1491-cb27-49ba-b885-de3c4b6cf2ac",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V2",
    "tyre_code": "7faa0c71-1e15-424b-833c-eea3825a3e15",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V3",
    "tyre_code": "000d417b-c53e-4efb-8669-91641552cddc",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "15L AAX2987",
    "fleet_number": "15L",
    "current_odometer": 656530,
    "position": "V4",
    "tyre_code": "471ca6b2-6dac-4fba-97f9-7ad842f279e2",
    "brand": "KHUMO",
    "installation_km": 658760,
    "km_travelled": 18731,
    "current_tread_depth": "8"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "SP",
    "tyre_code": "5d8af00d-185f-42d6-945e-e18727a50fc6",
    "brand": "GENERAL",
    "installation_km": null,
    "km_travelled": null,
    "current_tread_depth": "5"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V1",
    "tyre_code": "8210a33e-f44b-40da-bb6a-641639e87237",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 19305,
    "current_tread_depth": "5"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V2",
    "tyre_code": "7dc0e39a-21cc-4ea9-9479-831d93b06535",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 15000,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V3",
    "tyre_code": "71247006-ce19-4c5a-b0c9-0e7af26f0dc5",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 15000,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "16L AGT9056",
    "fleet_number": "16L",
    "current_odometer": 0,
    "position": "V4",
    "tyre_code": "12b36a2a-6eed-4c2f-a68d-a46be93a13fd",
    "brand": "GENERAL",
    "installation_km": 105438,
    "km_travelled": 15000,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V1",
    "tyre_code": "62f1bf41-0882-41b6-aeef-40f55f12e298",
    "brand": "POWERTRAC",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "6"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V2",
    "tyre_code": "31633238-f8c0-4448-9b68-40d46ec8b7c7",
    "brand": "POWERTRAC",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "6"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V3",
    "tyre_code": "b2349505-a072-4de9-92d4-91504e224f9c",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V4",
    "tyre_code": "c918587c-5a51-4ae5-982f-3471a5806c0a",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V5",
    "tyre_code": "5f7916ae-c09e-4530-9689-bb1924624f52",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ACO8468",
    "fleet_number": "1H",
    "current_odometer": 0,
    "position": "V6",
    "tyre_code": "890480de-e0d4-442c-9414-29291205dd56",
    "brand": "TRIANGLE",
    "installation_km": 0,
    "km_travelled": 42481,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T1",
    "tyre_code": "6b115960-160d-403d-873f-0fe35cc86358",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T10",
    "tyre_code": "03703ab1-55ce-4158-9589-f06f605e5bda",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T11",
    "tyre_code": "a1bb1f79-aeb9-4cfd-be36-e81761bd9a61",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T12",
    "tyre_code": "b2639277-77e9-4f63-9585-0c8e1db7c487",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T13",
    "tyre_code": "a474afcd-1053-4d38-94de-d1721812cece",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T14",
    "tyre_code": "e43cac02-4aaa-49c1-804f-c2ba5ac27183",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T15",
    "tyre_code": "30ed5454-bc3a-4834-80d7-0aaf5dc4c4e3",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T16",
    "tyre_code": "2775c2b0-102a-49e3-bc1c-c65dfecb8eff",
    "brand": "RETHREAD",
    "installation_km": 0,
    "km_travelled": 149959,
    "current_tread_depth": "7"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T2",
    "tyre_code": "b274f7c1-d992-4f6f-ae94-50b36d526efd",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T3",
    "tyre_code": "ed72436c-9642-4b77-bf37-b95bc5833530",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  },
  {
    "registration_number": "ADZ9011/ADZ9010",
    "fleet_number": "1T",
    "current_odometer": 0,
    "position": "T4",
    "tyre_code": "523ae169-6ca2-45ea-b6f0-d090e126e267",
    "brand": "WELLPLUS",
    "installation_km": 149959,
    "km_travelled": 1241,
    "current_tread_depth": "15"
  }
]





