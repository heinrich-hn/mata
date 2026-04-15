SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'driver_vehicle_assignments'
ORDER BY ordinal_position;

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "character_maximum_length": null
  },
  {
    "column_name": "driver_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "character_maximum_length": null
  },
  {
    "column_name": "vehicle_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "character_maximum_length": null
  },
  {
    "column_name": "assigned_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()",
    "character_maximum_length": null
  },
  {
    "column_name": "unassigned_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null,
    "character_maximum_length": null
  },
  {
    "column_name": "is_active",
    "data_type": "boolean",
    "is_nullable": "NO",
    "column_default": "true",
    "character_maximum_length": null
  },
  {
    "column_name": "notes",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null,
    "character_maximum_length": null
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()",
    "character_maximum_length": null
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()",
    "character_maximum_length": null
  }
]-- See all foreign key relationships
SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (tc.table_name IN ('drivers', 'vehicles', 'driver_vehicle_assignments'))
ORDER BY tc.table_name;


[
  {
    "source_table": "driver_vehicle_assignments",
    "source_column": "vehicle_id",
    "target_table": "vehicles",
    "target_column": "id",
    "constraint_name": "driver_vehicle_assignments_vehicle_id_fkey"
  }
]



-- See all indexes on key tables
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('drivers', 'vehicles', 'driver_vehicle_assignments')
ORDER BY tablename, indexname;


[
  {
    "tablename": "driver_vehicle_assignments",
    "indexname": "driver_vehicle_assignments_pkey",
    "indexdef": "CREATE UNIQUE INDEX driver_vehicle_assignments_pkey ON public.driver_vehicle_assignments USING btree (id)"
  },
  {
    "tablename": "driver_vehicle_assignments",
    "indexname": "idx_driver_vehicle_assignments_driver_active",
    "indexdef": "CREATE INDEX idx_driver_vehicle_assignments_driver_active ON public.driver_vehicle_assignments USING btree (driver_id, is_active) WHERE (is_active = true)"
  },
  {
    "tablename": "driver_vehicle_assignments",
    "indexname": "idx_driver_vehicle_assignments_unique_active_driver_vehicle",
    "indexdef": "CREATE UNIQUE INDEX idx_driver_vehicle_assignments_unique_active_driver_vehicle ON public.driver_vehicle_assignments USING btree (driver_id, vehicle_id) WHERE (is_active = true)"
  },
  {
    "tablename": "driver_vehicle_assignments",
    "indexname": "idx_driver_vehicle_assignments_vehicle_active",
    "indexdef": "CREATE INDEX idx_driver_vehicle_assignments_vehicle_active ON public.driver_vehicle_assignments USING btree (vehicle_id, is_active) WHERE (is_active = true)"
  },
  {
    "tablename": "drivers",
    "indexname": "drivers_driver_number_key",
    "indexdef": "CREATE UNIQUE INDEX drivers_driver_number_key ON public.drivers USING btree (driver_number)"
  },
  {
    "tablename": "drivers",
    "indexname": "drivers_license_number_key",
    "indexdef": "CREATE UNIQUE INDEX drivers_license_number_key ON public.drivers USING btree (license_number)"
  },
  {
    "tablename": "drivers",
    "indexname": "drivers_pkey",
    "indexdef": "CREATE UNIQUE INDEX drivers_pkey ON public.drivers USING btree (id)"
  },
  {
    "tablename": "drivers",
    "indexname": "idx_drivers_driver_number",
    "indexdef": "CREATE INDEX idx_drivers_driver_number ON public.drivers USING btree (driver_number)"
  },
  {
    "tablename": "drivers",
    "indexname": "idx_drivers_license_number",
    "indexdef": "CREATE INDEX idx_drivers_license_number ON public.drivers USING btree (license_number)"
  },
  {
    "tablename": "drivers",
    "indexname": "idx_drivers_status",
    "indexdef": "CREATE INDEX idx_drivers_status ON public.drivers USING btree (status)"
  },
  {
    "tablename": "vehicles",
    "indexname": "idx_vehicles_active",
    "indexdef": "CREATE INDEX idx_vehicles_active ON public.vehicles USING btree (active)"
  },
  {
    "tablename": "vehicles",
    "indexname": "idx_vehicles_qr_code_value",
    "indexdef": "CREATE INDEX idx_vehicles_qr_code_value ON public.vehicles USING btree (qr_code_value)"
  },
  {
    "tablename": "vehicles",
    "indexname": "idx_vehicles_reefer_unit",
    "indexdef": "CREATE INDEX idx_vehicles_reefer_unit ON public.vehicles USING btree (reefer_unit)"
  },
  {
    "tablename": "vehicles",
    "indexname": "idx_vehicles_registration",
    "indexdef": "CREATE INDEX idx_vehicles_registration ON public.vehicles USING btree (registration_number)"
  },
  {
    "tablename": "vehicles",
    "indexname": "idx_vehicles_wialon_id",
    "indexdef": "CREATE INDEX idx_vehicles_wialon_id ON public.vehicles USING btree (wialon_id)"
  },
  {
    "tablename": "vehicles",
    "indexname": "vehicles_pkey",
    "indexdef": "CREATE UNIQUE INDEX vehicles_pkey ON public.vehicles USING btree (id)"
  },
  {
    "tablename": "vehicles",
    "indexname": "vehicles_registration_number_key",
    "indexdef": "CREATE UNIQUE INDEX vehicles_registration_number_key ON public.vehicles USING btree (registration_number)"
  }
]



-- Get complete schema information with descriptions
SELECT 
    t.table_name,
    string_agg(
        c.column_name || ' ' || c.data_type || 
        CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
        ', ' ORDER BY c.ordinal_position
    ) as columns,
    COUNT(c.column_name) as column_count
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN ('drivers', 'vehicles', 'driver_vehicle_assignments', 'auth.users')
GROUP BY t.table_name
ORDER BY t.table_name;


[
  {
    "table_name": "driver_vehicle_assignments",
    "columns": "id uuid NOT NULL, driver_id uuid NOT NULL, vehicle_id uuid NOT NULL, assigned_at timestamp with time zone NOT NULL, unassigned_at timestamp with time zone, is_active boolean NOT NULL, notes text, created_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL",
    "column_count": 9
  },
  {
    "table_name": "drivers",
    "columns": "id uuid NOT NULL, driver_number text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, email text, phone text, license_number text NOT NULL, license_expiry date, license_class text, hire_date date, status USER-DEFINED NOT NULL, address text, city text, state text, zip_code text, emergency_contact_name text, emergency_contact_phone text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid, auth_user_id uuid",
    "column_count": 22
  },
  {
    "table_name": "vehicles",
    "columns": "id uuid NOT NULL, registration_number text NOT NULL, vehicle_type USER-DEFINED NOT NULL, make text NOT NULL, model text NOT NULL, tonnage integer, engine_specs text, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, qr_code_value text, fleet_number text, wialon_id integer, reefer_unit text, current_odometer bigint",
    "column_count": 15
  }
]


-- Show how tables are connected
SELECT 
    'drivers' as source_table,
    'auth_user_id' as source_column,
    'auth.users' as target_table,
    'id' as target_column,
    'Links driver profiles to authentication users' as relationship
UNION ALL
SELECT
    'driver_vehicle_assignments',
    'driver_id',
    'auth.users',
    'id',
    'Links assignments to auth users (not drivers table!)'
UNION ALL
SELECT
    'driver_vehicle_assignments',
    'vehicle_id',
    'vehicles',
    'id',
    'Links assignments to vehicles'
UNION ALL
SELECT
    'drivers',
    'id',
    'driver_vehicle_assignments',
    'driver_id (via auth_user_id)',
    'IMPORTANT: Match on auth_user_id, not drivers.id!';


    [
  {
    "source_table": "drivers",
    "source_column": "auth_user_id",
    "target_table": "auth.users",
    "target_column": "id",
    "relationship": "Links driver profiles to authentication users"
  },
  {
    "source_table": "driver_vehicle_assignments",
    "source_column": "driver_id",
    "target_table": "auth.users",
    "target_column": "id",
    "relationship": "Links assignments to auth users (not drivers table!)"
  },
  {
    "source_table": "driver_vehicle_assignments",
    "source_column": "vehicle_id",
    "target_table": "vehicles",
    "target_column": "id",
    "relationship": "Links assignments to vehicles"
  },
  {
    "source_table": "drivers",
    "source_column": "id",
    "target_table": "driver_vehicle_assignments",
    "target_column": "driver_id (via auth_user_id)",
    "relationship": "IMPORTANT: Match on auth_user_id, not drivers.id!"
  }
]



-- See how records are actually linked
SELECT 
    'Driver Record' as record_type,
    d.id as driver_table_id,
    d.auth_user_id,
    d.email,
    d.first_name,
    d.last_name
FROM drivers d
WHERE d.email = 'albert@mat.com'

UNION ALL

SELECT 
    'Auth User Record',
    NULL,
    u.id,
    u.email,
    NULL,
    NULL
FROM auth.users u
WHERE u.email = 'albert@mat.com'

UNION ALL

SELECT 
    'Assignment Record',
    NULL,
    dva.driver_id,
    NULL,
    v.registration_number,
    dva.is_active::text
FROM driver_vehicle_assignments dva
JOIN vehicles v ON dva.vehicle_id = v.id
WHERE dva.driver_id = (SELECT auth_user_id FROM drivers WHERE email = 'albert@mat.com');


[
  {
    "record_type": "Driver Record",
    "driver_table_id": "33a96d03-8d26-4ece-ab91-4e011d7a350a",
    "auth_user_id": "0dac767c-4452-4987-acef-3c0dfafa22b3",
    "email": "albert@mat.com",
    "first_name": "Albert",
    "last_name": "Zunga"
  },
  {
    "record_type": "Auth User Record",
    "driver_table_id": null,
    "auth_user_id": "0dac767c-4452-4987-acef-3c0dfafa22b3",
    "email": "albert@mat.com",
    "first_name": null,
    "last_name": null
  },
  {
    "record_type": "Assignment Record",
    "driver_table_id": null,
    "auth_user_id": "0dac767c-4452-4987-acef-3c0dfafa22b3",
    "email": null,
    "first_name": "AFQ 1324",
    "last_name": "true"
  }
]


-- Create a schema map
SELECT 
    '═══════════════════════════════════════════════════════════════' as schema_map
UNION ALL SELECT 'DATABASE SCHEMA STRUCTURE:'
UNION ALL SELECT ''
UNION ALL SELECT 'auth.users (Authentication)'
UNION ALL SELECT '  ├─ id (UUID) [PRIMARY KEY]'
UNION ALL SELECT '  ├─ email'
UNION ALL SELECT '  └─ encrypted_password'
UNION ALL SELECT '         │'
UNION ALL SELECT '         │ (linked by auth_user_id)'
UNION ALL SELECT '         ↓'
UNION ALL SELECT 'drivers (Driver Profiles)'
UNION ALL SELECT '  ├─ id (UUID) [PRIMARY KEY]'
UNION ALL SELECT '  ├─ auth_user_id (UUID) [REFERENCES auth.users.id]'
UNION ALL SELECT '  ├─ first_name'
UNION ALL SELECT '  ├─ last_name'
UNION ALL SELECT '  ├─ email'
UNION ALL SELECT '  ├─ phone'
UNION ALL SELECT '  └─ status'
UNION ALL SELECT '         │'
UNION ALL SELECT '         │ (assignments link via driver_id = auth_user_id)'
UNION ALL SELECT '         ↓'
UNION ALL SELECT 'driver_vehicle_assignments (Junction Table)'
UNION ALL SELECT '  ├─ id (UUID) [PRIMARY KEY]'
UNION ALL SELECT '  ├─ driver_id (UUID) [REFERENCES auth.users.id]'
UNION ALL SELECT '  ├─ vehicle_id (UUID) [REFERENCES vehicles.id]'
UNION ALL SELECT '  ├─ assigned_at (TIMESTAMP)'
UNION ALL SELECT '  ├─ unassigned_at (TIMESTAMP)'
UNION ALL SELECT '  ├─ is_active (BOOLEAN)'
UNION ALL SELECT '  └─ notes (TEXT)'
UNION ALL SELECT '         │'
UNION ALL SELECT '         │ (linked by vehicle_id)'
UNION ALL SELECT '         ↓'
UNION ALL SELECT 'vehicles (Fleet Vehicles)'
UNION ALL SELECT '  ├─ id (UUID) [PRIMARY KEY]'
UNION ALL SELECT '  ├─ registration_number'
UNION ALL SELECT '  ├─ fleet_number'
UNION ALL SELECT '  ├─ make'
UNION ALL SELECT '  ├─ model'
UNION ALL SELECT '  └─ vehicle_type'
UNION ALL SELECT ''
UNION ALL SELECT 'IMPORTANT NOTES:'
UNION ALL SELECT '• driver_vehicle_assignments.driver_id references auth.users.id, NOT drivers.id'
UNION ALL SELECT '• Always join drivers.auth_user_id to driver_vehicle_assignments.driver_id'
UNION ALL SELECT '• A driver can have multiple active vehicles'
UNION ALL SELECT '• A vehicle can have multiple active drivers'
UNION ALL SELECT '• is_active=true means current assignment'
UNION ALL SELECT '• unassigned_at=NULL + is_active=true = current active assignment';


[
  {
    "schema_map": "═══════════════════════════════════════════════════════════════"
  },
  {
    "schema_map": "DATABASE SCHEMA STRUCTURE:"
  },
  {
    "schema_map": ""
  },
  {
    "schema_map": "auth.users (Authentication)"
  },
  {
    "schema_map": "  ├─ id (UUID) [PRIMARY KEY]"
  },
  {
    "schema_map": "  ├─ email"
  },
  {
    "schema_map": "  └─ encrypted_password"
  },
  {
    "schema_map": "         │"
  },
  {
    "schema_map": "         │ (linked by auth_user_id)"
  },
  {
    "schema_map": "         ↓"
  },
  {
    "schema_map": "drivers (Driver Profiles)"
  },
  {
    "schema_map": "  ├─ id (UUID) [PRIMARY KEY]"
  },
  {
    "schema_map": "  ├─ auth_user_id (UUID) [REFERENCES auth.users.id]"
  },
  {
    "schema_map": "  ├─ first_name"
  },
  {
    "schema_map": "  ├─ last_name"
  },
  {
    "schema_map": "  ├─ email"
  },
  {
    "schema_map": "  ├─ phone"
  },
  {
    "schema_map": "  └─ status"
  },
  {
    "schema_map": "         │"
  },
  {
    "schema_map": "         │ (assignments link via driver_id = auth_user_id)"
  },
  {
    "schema_map": "         ↓"
  },
  {
    "schema_map": "driver_vehicle_assignments (Junction Table)"
  },
  {
    "schema_map": "  ├─ id (UUID) [PRIMARY KEY]"
  },
  {
    "schema_map": "  ├─ driver_id (UUID) [REFERENCES auth.users.id]"
  },
  {
    "schema_map": "  ├─ vehicle_id (UUID) [REFERENCES vehicles.id]"
  },
  {
    "schema_map": "  ├─ assigned_at (TIMESTAMP)"
  },
  {
    "schema_map": "  ├─ unassigned_at (TIMESTAMP)"
  },
  {
    "schema_map": "  ├─ is_active (BOOLEAN)"
  },
  {
    "schema_map": "  └─ notes (TEXT)"
  },
  {
    "schema_map": "         │"
  },
  {
    "schema_map": "         │ (linked by vehicle_id)"
  },
  {
    "schema_map": "         ↓"
  },
  {
    "schema_map": "vehicles (Fleet Vehicles)"
  },
  {
    "schema_map": "  ├─ id (UUID) [PRIMARY KEY]"
  },
  {
    "schema_map": "  ├─ registration_number"
  },
  {
    "schema_map": "  ├─ fleet_number"
  },
  {
    "schema_map": "  ├─ make"
  },
  {
    "schema_map": "  ├─ model"
  },
  {
    "schema_map": "  └─ vehicle_type"
  },
  {
    "schema_map": ""
  },
  {
    "schema_map": "IMPORTANT NOTES:"
  },
  {
    "schema_map": "• driver_vehicle_assignments.driver_id references auth.users.id, NOT drivers.id"
  },
  {
    "schema_map": "• Always join drivers.auth_user_id to driver_vehicle_assignments.driver_id"
  },
  {
    "schema_map": "• A driver can have multiple active vehicles"
  },
  {
    "schema_map": "• A vehicle can have multiple active drivers"
  },
  {
    "schema_map": "• is_active=true means current assignment"
  },
  {
    "schema_map": "• unassigned_at=NULL + is_active=true = current active assignment"
  }
]

-- Detailed column info with constraints
SELECT 
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    CASE WHEN pk.constraint_name IS NOT NULL THEN 'PRIMARY KEY' ELSE '' END as key_type,
    CASE WHEN fk.constraint_name IS NOT NULL THEN 'FOREIGN KEY to ' || fk.foreign_table || '(' || fk.foreign_column || ')' ELSE '' END as references_info
FROM information_schema.columns c
LEFT JOIN (
    SELECT kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = 'driver_vehicle_assignments'
) pk ON c.column_name = pk.column_name
LEFT JOIN (
    SELECT 
        kcu.column_name,
        tc.constraint_name,
        ccu.table_name as foreign_table,
        ccu.column_name as foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'driver_vehicle_assignments'
) fk ON c.column_name = fk.column_name
WHERE c.table_name = 'driver_vehicle_assignments'
ORDER BY c.ordinal_position;

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "key_type": "PRIMARY KEY",
    "references_info": ""
  },
  {
    "column_name": "driver_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null,
    "key_type": "",
    "references_info": ""
  },
  {
    "column_name": "vehicle_id",
    "data_type": "uuid",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": null,
    "key_type": "",
    "references_info": "FOREIGN KEY to vehicles(id)"
  },
  {
    "column_name": "assigned_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()",
    "key_type": "",
    "references_info": ""
  },
  {
    "column_name": "unassigned_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null,
    "key_type": "",
    "references_info": ""
  },
  {
    "column_name": "is_active",
    "data_type": "boolean",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "true",
    "key_type": "",
    "references_info": ""
  },
  {
    "column_name": "notes",
    "data_type": "text",
    "character_maximum_length": null,
    "is_nullable": "YES",
    "column_default": null,
    "key_type": "",
    "references_info": ""
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()",
    "key_type": "",
    "references_info": ""
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "character_maximum_length": null,
    "is_nullable": "NO",
    "column_default": "now()",
    "key_type": "",
    "references_info": ""
  }
]


-- Find drivers with multiple active assignments (potential issues)
SELECT 
    d.email,
    d.first_name,
    d.last_name,
    COUNT(*) as active_assignments,
    string_agg(
        v.registration_number || ' (' || v.vehicle_type || ')', 
        ', ' ORDER BY 
            CASE WHEN v.vehicle_type IN ('truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck') 
            THEN 1 ELSE 2 END,
            dva.assigned_at DESC
    ) as vehicles,
    MIN(dva.assigned_at) as first_assigned,
    MAX(dva.assigned_at) as last_assigned
FROM drivers d
JOIN driver_vehicle_assignments dva ON d.auth_user_id = dva.driver_id AND dva.is_active = true
JOIN vehicles v ON dva.vehicle_id = v.id
GROUP BY d.id, d.email, d.first_name, d.last_name
HAVING COUNT(*) > 1
ORDER BY active_assignments DESC;


[
  {
    "email": "Phillimon@matanuska.com",
    "first_name": "Phillimon",
    "last_name": "Kwarire",
    "active_assignments": 2,
    "vehicles": "MR86PVGP (horse_truck), 6F LR93LPGP (reefer)",
    "first_assigned": "2026-03-18 13:20:28.04+00",
    "last_assigned": "2026-03-18 13:20:28.04+00"
  },
  {
    "email": "CHARLES@mat.com",
    "first_name": "Charles",
    "last_name": "Seira",
    "active_assignments": 2,
    "vehicles": "JF964 FS (horse_truck), 9F MR86RWGP (reefer)",
    "first_assigned": "2026-03-18 10:25:41.881+00",
    "last_assigned": "2026-03-18 11:17:57.224+00"
  },
  {
    "email": "Taurayi@mat.com",
    "first_name": "Taurayi",
    "last_name": "Vherenaisi",
    "active_assignments": 2,
    "vehicles": "AFQ 1329 (horse_truck), AGK 4430 (reefer)",
    "first_assigned": "2026-04-15 06:46:47.196+00",
    "last_assigned": "2026-04-15 06:46:47.196+00"
  },
  {
    "email": "Encok@mat.com",
    "first_name": "Enock",
    "last_name": "Mukonyerwa",
    "active_assignments": 2,
    "vehicles": "AGZ 1963 (horse_truck), 8F AGK1234 (reefer)",
    "first_assigned": "2026-03-18 13:21:34.874+00",
    "last_assigned": "2026-03-18 13:21:34.874+00"
  },
  {
    "email": "lovemore1@mat.com",
    "first_name": " Lovemore",
    "last_name": "Tambula",
    "active_assignments": 2,
    "vehicles": "JFK 963 FS (horse_truck), LX08PLGP (reefer)",
    "first_assigned": "2026-03-10 04:47:50.701+00",
    "last_assigned": "2026-03-18 11:14:28.796+00"
  },
  {
    "email": "daniel@mat.com",
    "first_name": " Daniel Fungai",
    "last_name": "Chitsinga",
    "active_assignments": 2,
    "vehicles": "AFQ 1325 (horse_truck), AGK7473 (reefer)",
    "first_assigned": "2026-03-24 14:11:36.822+00",
    "last_assigned": "2026-03-24 14:11:36.822+00"
  }
]


-- Find assignments where driver exists but auth_user_id mismatch
SELECT 
    'POTENTIAL ISSUE' as status,
    d.email,
    d.auth_user_id as driver_auth_id,
    dva.driver_id as assignment_driver_id,
    CASE 
        WHEN d.auth_user_id = dva.driver_id THEN 'MATCH' 
        ELSE 'MISMATCH - FIX NEEDED' 
    END as relationship_check,
    v.registration_number,
    dva.is_active
FROM driver_vehicle_assignments dva
LEFT JOIN drivers d ON d.auth_user_id = dva.driver_id
LEFT JOIN vehicles v ON dva.vehicle_id = v.id
WHERE d.auth_user_id IS NULL OR d.auth_user_id != dva.driver_id;


[
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AGJ 3466",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "JFK 963 FS",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AGZ 1963",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "JF964 FS",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "ABJ3739",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "JF964 FS",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "ADS 4865",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AGZ 3812",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AFQ 1327",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "ABJ3739",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AFQ 1329",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AGZ 1963",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "JFK 963 FS",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "4b6e7f04-c3d0-47f1-9bbd-7b845a21796c",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "JF964 FS",
    "is_active": true
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "51656422-0187-4365-8971-f4cc7b532957",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "MR86PVGP",
    "is_active": true
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "1245126d-49d1-4231-b66d-13ec903389d6",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "JFK 963 FS",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "1245126d-49d1-4231-b66d-13ec903389d6",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AFQ 1329",
    "is_active": true
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "JF964 FS",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "e13b2956-12f9-4dc0-a930-e59d48b320b1",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "15L AAX2987",
    "is_active": true
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "af5c5174-48ad-4f01-9e4e-8c5a73adfc0e",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AGZ 3812",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "698ecddd-df11-4dd1-a6f7-0dc36d500702",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "MR86PVGP",
    "is_active": true
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "af5c5174-48ad-4f01-9e4e-8c5a73adfc0e",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AFQ 1329",
    "is_active": false
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "af5c5174-48ad-4f01-9e4e-8c5a73adfc0e",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "AGZ 3812",
    "is_active": true
  },
  {
    "status": "POTENTIAL ISSUE",
    "email": null,
    "driver_auth_id": null,
    "assignment_driver_id": "4dc4be37-5592-489f-8f48-5ab4b87a6754",
    "relationship_check": "MISMATCH - FIX NEEDED",
    "registration_number": "14L ABA3918",
    "is_active": true
  }
]


-- =====================================================
-- COMPLETE DATA FLOW AND RELATIONSHIPS
-- =====================================================

SELECT '
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         COMPLETE SYSTEM ARCHITECTURE                          ║
╚═══════════════════════════════════════════════════════════════════════════════╝

1. AUTHENTICATION LAYER
   auth.users (Supabase Auth)
   ├─ id (UUID) ───────────────────────────────┐
   ├─ email                                     │
   └─ raw_user_meta_data (includes assigned_vehicle_id fallback)
                                                │
                                                ▼
2. DRIVER PROFILES                              
   drivers                                      
   ├─ id (UUID) [PRIMARY KEY]                  
   ├─ auth_user_id (UUID) ────────────────────► REFERENCES auth.users.id
   ├─ first_name, last_name, email             
   └─ status                                   
                                                │
                                                │ (via auth_user_id)
                                                ▼
3. VEHICLE ASSIGNMENTS                          
   driver_vehicle_assignments                   
   ├─ driver_id (UUID) ───────────────────────► REFERENCES auth.users.id
   ├─ vehicle_id (UUID) ──────────────────────┐
   ├─ is_active                                │
   └─ assigned_at                              │
                                                │
                                                ▼
4. VEHICLES                                     
   vehicles                                     
   ├─ id (UUID) [PRIMARY KEY] ◄────────────────┘
   ├─ registration_number                      
   ├─ fleet_number ───────────────────────────┐
   ├─ make, model                              │
   └─ vehicle_type                             │
                                                │
                    ┌───────────────────────────┘
                    │ (via fleet_number OR vehicle_id)
                    ▼
5. TRIPS & TRANSPORT                           
   trips                                       
   ├─ id (UUID) [PRIMARY KEY]                  
   ├─ fleet_vehicle_id ──────────────────────► REFERENCES vehicles.id
   ├─ vehicle_id (alternative) ───────────────┤
   ├─ driver_id (UUID) ──────────────────────► REFERENCES auth.users.id
   ├─ start_location, end_location             
   ├─ distance_km                              
   ├─ fuel_consumed_liters                     
   ├─ fuel_efficiency (km/l)                   
   └─ trip_date                                
                                                │
                    ┌───────────────────────────┘
                    │ (via vehicle_id OR fleet_number)
                    ▼
6. FUEL & DIESEL RECORDS                       
   diesel_records                              
   ├─ id (UUID) [PRIMARY KEY]                  
   ├─ vehicle_id (UUID) ─────────────────────► REFERENCES vehicles.id
   ├─ fleet_number ──────────────────────────► REFERENCES vehicles.fleet_number
   ├─ driver_id (UUID) ──────────────────────► REFERENCES auth.users.id
   ├─ liters                                  
   ├─ cost                                    
   ├─ odometer_reading                        
   ├─ transaction_date                        
   └─ transaction_type (refuel, usage, etc.)
                                                │
                    ┌───────────────────────────┘
                    │ (via vehicle_id)
                    ▼
7. LOADS & CARGO                               
   loads                                       
   ├─ id (UUID) [PRIMARY KEY]                  
   ├─ assigned_vehicle_id ───────────────────► REFERENCES vehicles.id
   ├─ driver_id (UUID) ──────────────────────► REFERENCES auth.users.id
   ├─ pickup_location, dropoff_location       
   ├─ weight_tonnage                          
   └─ status (pending, assigned, in_transit)  
';


[
  {
    "?column?": "\r\n╔═══════════════════════════════════════════════════════════════════════════════╗\r\n║                         COMPLETE SYSTEM ARCHITECTURE                          ║\r\n╚═══════════════════════════════════════════════════════════════════════════════╝\r\n\r\n1. AUTHENTICATION LAYER\r\n   auth.users (Supabase Auth)\r\n   ├─ id (UUID) ───────────────────────────────┐\r\n   ├─ email                                     │\r\n   └─ raw_user_meta_data (includes assigned_vehicle_id fallback)\r\n                                                │\r\n                                                ▼\r\n2. DRIVER PROFILES                              \r\n   drivers                                      \r\n   ├─ id (UUID) [PRIMARY KEY]                  \r\n   ├─ auth_user_id (UUID) ────────────────────► REFERENCES auth.users.id\r\n   ├─ first_name, last_name, email             \r\n   └─ status                                   \r\n                                                │\r\n                                                │ (via auth_user_id)\r\n                                                ▼\r\n3. VEHICLE ASSIGNMENTS                          \r\n   driver_vehicle_assignments                   \r\n   ├─ driver_id (UUID) ───────────────────────► REFERENCES auth.users.id\r\n   ├─ vehicle_id (UUID) ──────────────────────┐\r\n   ├─ is_active                                │\r\n   └─ assigned_at                              │\r\n                                                │\r\n                                                ▼\r\n4. VEHICLES                                     \r\n   vehicles                                     \r\n   ├─ id (UUID) [PRIMARY KEY] ◄────────────────┘\r\n   ├─ registration_number                      \r\n   ├─ fleet_number ───────────────────────────┐\r\n   ├─ make, model                              │\r\n   └─ vehicle_type                             │\r\n                                                │\r\n                    ┌───────────────────────────┘\r\n                    │ (via fleet_number OR vehicle_id)\r\n                    ▼\r\n5. TRIPS & TRANSPORT                           \r\n   trips                                       \r\n   ├─ id (UUID) [PRIMARY KEY]                  \r\n   ├─ fleet_vehicle_id ──────────────────────► REFERENCES vehicles.id\r\n   ├─ vehicle_id (alternative) ───────────────┤\r\n   ├─ driver_id (UUID) ──────────────────────► REFERENCES auth.users.id\r\n   ├─ start_location, end_location             \r\n   ├─ distance_km                              \r\n   ├─ fuel_consumed_liters                     \r\n   ├─ fuel_efficiency (km/l)                   \r\n   └─ trip_date                                \r\n                                                │\r\n                    ┌───────────────────────────┘\r\n                    │ (via vehicle_id OR fleet_number)\r\n                    ▼\r\n6. FUEL & DIESEL RECORDS                       \r\n   diesel_records                              \r\n   ├─ id (UUID) [PRIMARY KEY]                  \r\n   ├─ vehicle_id (UUID) ─────────────────────► REFERENCES vehicles.id\r\n   ├─ fleet_number ──────────────────────────► REFERENCES vehicles.fleet_number\r\n   ├─ driver_id (UUID) ──────────────────────► REFERENCES auth.users.id\r\n   ├─ liters                                  \r\n   ├─ cost                                    \r\n   ├─ odometer_reading                        \r\n   ├─ transaction_date                        \r\n   └─ transaction_type (refuel, usage, etc.)\r\n                                                │\r\n                    ┌───────────────────────────┘\r\n                    │ (via vehicle_id)\r\n                    ▼\r\n7. LOADS & CARGO                               \r\n   loads                                       \r\n   ├─ id (UUID) [PRIMARY KEY]                  \r\n   ├─ assigned_vehicle_id ───────────────────► REFERENCES vehicles.id\r\n   ├─ driver_id (UUID) ──────────────────────► REFERENCES auth.users.id\r\n   ├─ pickup_location, dropoff_location       \r\n   ├─ weight_tonnage                          \r\n   └─ status (pending, assigned, in_transit)  \r\n"
  }
]

-- Show how all entities connect
SELECT '
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    ACTUAL DATABASE RELATIONSHIPS                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝

1. DRIVERS (driver profiles)
   └─ auth_user_id ────► auth.users.id

2. VEHICLES (fleet vehicles)
   ├─ id ──────────────────────────────────────┐
   └─ fleet_number                             │

3. DRIVER_VEHICLE_ASSIGNMENTS                 │
   ├─ driver_id ────► auth.users.id           │
   └─ vehicle_id ────► vehicles.id ────────────┤

4. TRIPS (load trips)                          │
   ├─ vehicle_id ────► vehicles.id ◄───────────┤
   ├─ fleet_vehicle_id ──► vehicles.id         │
   └─ driver_name (text field, not linked!)    │

5. DIESEL_RECORDS (fuel transactions)          │
   ├─ trip_id ────► trips.id                   │
   ├─ fleet_number ──► vehicles.fleet_number   │
   ├─ driver_name (text field, not linked!)    │
   └─ linked_trip_ids (ARRAY) ──► trips.id     │

⚠️  IMPORTANT: trips.driver_name and diesel_records.driver_name 
   are TEXT fields - NOT foreign keys to drivers table!
';


[
  {
    "?column?": "\r\n╔═══════════════════════════════════════════════════════════════════════════════╗\r\n║                    ACTUAL DATABASE RELATIONSHIPS                              ║\r\n╚═══════════════════════════════════════════════════════════════════════════════╝\r\n\r\n1. DRIVERS (driver profiles)\r\n   └─ auth_user_id ────► auth.users.id\r\n\r\n2. VEHICLES (fleet vehicles)\r\n   ├─ id ──────────────────────────────────────┐\r\n   └─ fleet_number                             │\r\n\r\n3. DRIVER_VEHICLE_ASSIGNMENTS                 │\r\n   ├─ driver_id ────► auth.users.id           │\r\n   └─ vehicle_id ────► vehicles.id ────────────┤\r\n\r\n4. TRIPS (load trips)                          │\r\n   ├─ vehicle_id ────► vehicles.id ◄───────────┤\r\n   ├─ fleet_vehicle_id ──► vehicles.id         │\r\n   └─ driver_name (text field, not linked!)    │\r\n\r\n5. DIESEL_RECORDS (fuel transactions)          │\r\n   ├─ trip_id ────► trips.id                   │\r\n   ├─ fleet_number ──► vehicles.fleet_number   │\r\n   ├─ driver_name (text field, not linked!)    │\r\n   └─ linked_trip_ids (ARRAY) ──► trips.id     │\r\n\r\n⚠️  IMPORTANT: trips.driver_name and diesel_records.driver_name \r\n   are TEXT fields - NOT foreign keys to drivers table!\r\n"
  }
]


