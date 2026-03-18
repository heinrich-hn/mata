-- Repair orphaned tyre installations
-- This fixes tyres that were installed but fleet table updates failed due to VARCHAR(12) constraint

-- This script finds tyres with current_fleet_position set but missing from fleet tables
-- and re-links them properly

DO $
$
DECLARE
    tyre_record RECORD;
    fleet_number TEXT;
    registration TEXT;
    position_code TEXT;
    fleet_table TEXT;
    table_exists BOOLEAN;
BEGIN
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

        -- Check if this position already exists in fleet table
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

        RAISE NOTICE 'Synced tyre % to % table: % at position %',
            tyre_record.id, fleet_table, registration, position_code;

END LOOP;

    RAISE NOTICE 'Orphaned tyre repair completed';
END $$;
