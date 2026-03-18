-- Combined Migration: Fix VARCHAR(12) constraint AND repair orphaned installations
-- Run this as a single migration to ensure correct order of operations

-- ============================================================================
-- PART 1: Fix registration_no column length constraint in fleet tyres tables
-- ============================================================================

DO $
$
DECLARE
    tbl_name TEXT;
    table_names TEXT[] := ARRAY[
        'fleet_1h_tyres',
        'fleet_1t_tyres',
        'fleet_2t_tyres',
        'fleet_3t_tyres',
        'fleet_4f_tyres',
        'fleet_4h_tyres',
        'fleet_4t_tyres',
        'fleet_5f_tyres',
        'fleet_6f_tyres',
        'fleet_6h_tyres',
        'fleet_7f_tyres',
        'fleet_8f_tyres',
        'fleet_14l_tyres',
        'fleet_15l_tyres',
        'fleet_21h_tyres',
        'fleet_22h_tyres',
        'fleet_23h_tyres',
        'fleet_24h_tyres',
        'fleet_26h_tyres',
        'fleet_28h_tyres',
        'fleet_29h_tyres',
        'fleet_30h_tyres',
        'fleet_31h_tyres',
        'fleet_32h_tyres',
        'fleet_33h_tyres',
        'fleet_ud_tyres'
    ];
BEGIN
    RAISE NOTICE '=== PART 1: Fixing VARCHAR(12) constraints ===';

    FOREACH tbl_name IN ARRAY table_names
    LOOP
-- Check if table exists before altering
IF EXISTS (
            SELECT
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = tbl_name
        ) THEN
-- Alter the registration_no column to TEXT type
EXECUTE format
('ALTER TABLE public.%I ALTER COLUMN registration_no TYPE TEXT', tbl_name);
            RAISE NOTICE 'Updated registration_no column in %', tbl_name;
END
IF;
    END LOOP;

    RAISE NOTICE 'VARCHAR(12) constraint fix completed';
END $$;

-- Add comment explaining the change
COMMENT ON COLUMN public.fleet_33h_tyres.registration_no IS 'Vehicle registration number (TEXT to support multi-vehicle registrations like "ADZ9011/ADZ9010")';

-- ============================================================================
-- PART 2: Repair orphaned tyre installations
-- ============================================================================

DO $$
DECLARE
    tyre_record RECORD;
    fleet_number TEXT;
    registration TEXT;
    position_code TEXT;
    fleet_table TEXT;
    table_exists BOOLEAN;
    repair_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== PART 2: Repairing orphaned tyre installations ===';

    -- Loop through all tyres that have a current_fleet_position but may not be in fleet tables
    FOR tyre_record IN
SELECT
  id,
  current_fleet_position,
  position
FROM tyres
WHERE current_fleet_position IS NOT NULL
  AND current_fleet_position != ''
LOOP
        -- Parse current_fleet_position: "33H JFK963FS-V3"
        -- Extract: fleet_number="33H", registration="JFK963FS", position="V3"

        -- Extract fleet number (e.g., "33H" from "33H JFK963FS-V3")
        fleet_number := substring
(tyre_record.current_fleet_position from '^(\d+[A-Z]+)');

        -- Extract registration (between fleet number and dash)
        registration := trim
(substring
(tyre_record.current_fleet_position from '^\d+[A-Z]+\s+([^-]+)'));

        -- Extract position code (after dash)
        position_code := substring
(tyre_record.current_fleet_position from '-([A-Z0-9]+)$');

IF fleet_number IS NULL OR registration IS NULL OR position_code IS NULL THEN
            RAISE NOTICE 'Skipping tyre % - could not parse current_fleet_position: %',
                tyre_record.id, tyre_record.current_fleet_position;
CONTINUE;
END
IF;

        -- Determine fleet table name
        fleet_table := 'fleet_' || lower
(fleet_number) || '_tyres';

-- Check if table exists
SELECT EXISTS
(
            SELECT
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name = fleet_table
        )
INTO table_exists;

IF NOT table_exists THEN
            RAISE NOTICE 'Table % does not exist for tyre %', fleet_table, tyre_record.id;
CONTINUE;
END
IF;

        -- Insert or update the fleet table entry
        EXECUTE format
(
            'INSERT INTO %I (registration_no, position, tyre_code, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (registration_no, position)
             DO UPDATE SET
                tyre_code = EXCLUDED.tyre_code,
                updated_at = NOW()',
            fleet_table
        ) USING registration, position_code, tyre_record.id;

        repair_count := repair_count + 1;
        RAISE NOTICE 'Synced tyre % to % table: % at position %',
            tyre_record.id, fleet_table, registration, position_code;

END LOOP;

    RAISE NOTICE 'Orphaned tyre repair completed. Repaired % installations', repair_count;
END $$;
