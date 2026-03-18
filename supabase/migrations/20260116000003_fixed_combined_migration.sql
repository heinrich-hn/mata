-- Combined Migration: Fix VARCHAR(12) constraint AND repair orphaned installations
-- This migration MUST be run as a single transaction to ensure correct order

-- ============================================================================
-- PART 1: Fix registration_no column length constraint in fleet tyres tables
-- ============================================================================
-- Using explicit ALTER TABLE statements (not dynamic SQL) to ensure they execute first

ALTER TABLE IF EXISTS public.fleet_1h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_1t_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_2t_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_3t_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_4f_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_4h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_4t_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_5f_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_6f_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_6h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_7f_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_8f_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_14l_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_15l_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_21h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_22h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_23h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_24h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_26h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_28h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_29h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_30h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_31h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_32h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_33h_tyres ALTER COLUMN registration_no TYPE TEXT;
ALTER TABLE IF EXISTS public.fleet_ud_tyres ALTER COLUMN registration_no TYPE TEXT;

-- Add comment explaining the change
COMMENT ON COLUMN public.fleet_33h_tyres.registration_no IS 'Vehicle registration number (TEXT to support multi-vehicle registrations like "ADZ9011/ADZ9010")';

-- ============================================================================
-- PART 2: Repair orphaned tyre installations
-- ============================================================================
-- Now that ALL constraints are fixed, we can safely repair orphaned installations

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
    RAISE NOTICE '=== Starting orphaned tyre repair ===';

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
        fleet_number := substring(tyre_record.current_fleet_position from '^(\d+[A-Z]+)');

        -- Extract registration (between fleet number and dash)
        registration := trim(substring(tyre_record.current_fleet_position from '^\d+[A-Z]+\s+([^-]+)'));

        -- Extract position code (after dash)
        position_code := substring(tyre_record.current_fleet_position from '-([A-Z0-9]+)$');

        IF fleet_number IS NULL OR registration IS NULL OR position_code IS NULL THEN
            RAISE NOTICE 'Skipping tyre % - could not parse current_fleet_position: %',
                tyre_record.id, tyre_record.current_fleet_position;
            CONTINUE;
        END IF;

        -- Determine fleet table name
        fleet_table := 'fleet_' || lower(fleet_number) || '_tyres';

        -- Check if table exists
        SELECT EXISTS (
            SELECT FROM information_schema.tables t
            WHERE t.table_schema = 'public'
            AND t.table_name = fleet_table
        ) INTO table_exists;

        IF NOT table_exists THEN
            RAISE NOTICE 'Table % does not exist for tyre %', fleet_table, tyre_record.id;
            CONTINUE;
        END IF;

        -- Insert or update the fleet table entry
        -- This should now work because registration_no is TEXT
        EXECUTE format(
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

    RAISE NOTICE '=== Orphaned tyre repair completed. Repaired % installations ===', repair_count;
END $$;
