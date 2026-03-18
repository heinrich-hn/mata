-- Fix registration_no column length constraint in fleet tyres tables
-- Current constraint: VARCHAR(12) is too short for registrations like "ADZ9011/ADZ9010" (15 chars)
-- Solution: Change to TEXT to accommodate any registration number length

-- List of all fleet tyres tables that need to be updated
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
END $$;

-- Add comment explaining the change
COMMENT ON COLUMN public.fleet_33h_tyres.registration_no IS 'Vehicle registration number (TEXT to support multi-vehicle registrations like "ADZ9011/ADZ9010")';
