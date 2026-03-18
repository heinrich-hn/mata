-- MIGRATION: Drop old fleet tables after successful migration
-- ⚠️ ONLY RUN THIS AFTER:
--   1. Running 20260116100001_create_unified_fleet_table.sql
--   2. Verifying data migrated correctly
--   3. Updating application code to use new table

-- ============================================================================
-- SAFETY CHECK: Verify unified table has data
-- ============================================================================

DO $$
DECLARE
    unified_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unified_count FROM fleet_tyre_positions;

    IF unified_count = 0 THEN
        RAISE EXCEPTION 'ABORT: fleet_tyre_positions table is empty. Migration may have failed. Do not drop old tables!';
    END IF;

    RAISE NOTICE 'Safety check passed: fleet_tyre_positions has % rows', unified_count;
END $$;

-- ============================================================================
-- DROP old fleet-specific tables
-- ============================================================================

DROP TABLE IF EXISTS public.fleet_1h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_1t_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_2t_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_3t_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_4f_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_4h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_4t_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_5f_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_6f_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_6h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_7f_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_8f_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_14l_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_15l_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_21h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_22h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_23h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_24h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_26h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_28h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_29h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_30h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_31h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_32h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_33h_tyres CASCADE;
DROP TABLE IF EXISTS public.fleet_ud_tyres CASCADE;

-- Verify cleanup
SELECT
    COUNT(*) as remaining_old_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'fleet_%_tyres'
  AND table_name != 'fleet_tyre_positions';

-- Should return 0
