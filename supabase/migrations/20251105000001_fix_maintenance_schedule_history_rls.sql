-- ============================================================================
-- FIX MAINTENANCE_SCHEDULE_HISTORY RLS POLICIES
-- ============================================================================
-- The table had RLS enabled but policies may be missing or conflicting

BEGIN;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Allow authenticated users to view maintenance history" ON public.maintenance_schedule_history;
DROP POLICY IF EXISTS "Allow authenticated users to manage maintenance history" ON public.maintenance_schedule_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance history" ON public.maintenance_schedule_history;
DROP POLICY IF EXISTS "Allow authenticated users to update maintenance history" ON public.maintenance_schedule_history;
DROP POLICY IF EXISTS "Allow authenticated users to delete maintenance history" ON public.maintenance_schedule_history;

-- Ensure RLS is enabled
ALTER TABLE public.maintenance_schedule_history ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies for all operations
CREATE POLICY "Allow authenticated users full access to maintenance history"
  ON public.maintenance_schedule_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.maintenance_schedule_history IS 'Maintenance completion history with full authenticated user access';

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed maintenance_schedule_history RLS policies';
  RAISE NOTICE '🔒 All authenticated users can now create, read, update, delete records';
END $$;
