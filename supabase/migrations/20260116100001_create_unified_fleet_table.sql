-- MIGRATION: Unified Fleet Tyre Positions Table
-- This replaces all separate fleet_*_tyres tables with a single unified table
-- that dynamically supports any fleet number

-- ============================================================================
-- PART 1: Create the unified table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fleet_tyre_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Fleet identification (dynamic - supports ANY fleet number)
    fleet_number TEXT NOT NULL,              -- e.g., "33H", "14L", "6H", etc.

    -- Vehicle identification
    vehicle_id UUID,                         -- Foreign key to vehicles table
    registration_no TEXT NOT NULL,           -- Vehicle registration number

    -- Position on vehicle
    position TEXT NOT NULL,                  -- e.g., "V1", "FL", "RR1", etc.
    position_label TEXT,                     -- Human-readable label

    -- Tyre assignment
    tyre_code TEXT,                          -- UUID from tyres.id (NULL = empty position)

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(fleet_number, registration_no, position),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_fleet_tyre_positions_fleet ON fleet_tyre_positions(fleet_number);
CREATE INDEX idx_fleet_tyre_positions_vehicle ON fleet_tyre_positions(vehicle_id);
CREATE INDEX idx_fleet_tyre_positions_registration ON fleet_tyre_positions(registration_no);
CREATE INDEX idx_fleet_tyre_positions_tyre ON fleet_tyre_positions(tyre_code) WHERE tyre_code IS NOT NULL;
CREATE INDEX idx_fleet_tyre_positions_lookup ON fleet_tyre_positions(fleet_number, registration_no);

-- RLS policy
ALTER TABLE public.fleet_tyre_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view fleet tyre positions"
ON public.fleet_tyre_positions FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage fleet tyre positions"
ON public.fleet_tyre_positions FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE public.fleet_tyre_positions IS
'Unified table for tracking tyre positions across all fleet vehicles. Replaces separate fleet_*_tyres tables. Supports dynamic fleet numbers.';

-- ============================================================================
-- PART 2: Migrate data from old tables to unified table
-- ============================================================================

DO $$
DECLARE
    fleet_table TEXT;
    fleet_num TEXT;
    migrate_count INTEGER := 0;
    total_migrated INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Starting data migration to unified table ===';

    -- List of all fleet tables to migrate from
    FOR fleet_table IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'fleet_%_tyres'
        AND table_name != 'fleet_tyre_positions'
        ORDER BY table_name
    LOOP
        -- Extract fleet number from table name (e.g., "fleet_33h_tyres" -> "33H")
        fleet_num := upper(regexp_replace(fleet_table, '^fleet_(.+)_tyres$', '\1'));

        -- Migrate data from this table
        -- Use DISTINCT ON to handle duplicates within the source table
        EXECUTE format('
            INSERT INTO fleet_tyre_positions (
                fleet_number,
                vehicle_id,
                registration_no,
                position,
                tyre_code,
                updated_at
            )
            SELECT DISTINCT ON (ft.registration_no, ft.position)
                %L as fleet_number,
                v.id as vehicle_id,
                ft.registration_no,
                ft.position,
                ft.tyre_code,
                COALESCE(ft.updated_at, NOW())
            FROM %I ft
            LEFT JOIN LATERAL (
                SELECT id
                FROM vehicles
                WHERE registration_number LIKE ''%%'' || ft.registration_no || ''%%''
                LIMIT 1
            ) v ON true
            ORDER BY ft.registration_no, ft.position, ft.updated_at DESC NULLS LAST
            ON CONFLICT (fleet_number, registration_no, position)
            DO UPDATE SET
                tyre_code = EXCLUDED.tyre_code,
                vehicle_id = COALESCE(EXCLUDED.vehicle_id, fleet_tyre_positions.vehicle_id),
                updated_at = EXCLUDED.updated_at
        ', fleet_num, fleet_table);

        GET DIAGNOSTICS migrate_count = ROW_COUNT;
        total_migrated := total_migrated + migrate_count;

        RAISE NOTICE 'Migrated % rows from % (fleet %)', migrate_count, fleet_table, fleet_num;
    END LOOP;

    RAISE NOTICE '=== Migration completed. Total rows migrated: % ===', total_migrated;
END $$;

-- ============================================================================
-- PART 3: Verify migration
-- ============================================================================

-- Check the results
SELECT
    fleet_number,
    COUNT(*) as position_count,
    COUNT(DISTINCT registration_no) as vehicle_count,
    COUNT(tyre_code) as positions_with_tyres
FROM fleet_tyre_positions
GROUP BY fleet_number
ORDER BY fleet_number;
