-- ============================================================================
-- FIX RLS POLICIES FOR LOAD ASSIGNMENT HISTORY
-- Allow authenticated users to insert assignment history records
-- ============================================================================

-- Add INSERT policy for load_assignment_history
-- This is needed because the trigger log_load_assignment_trigger inserts into this table
CREATE POLICY "Allow authenticated users to insert assignment history"
  ON public.load_assignment_history FOR
INSERT
  TO authenticated
  WITH CHECK (
true);

-- Add full management policy as well for completeness
CREATE POLICY "Allow authenticated users to manage assignment history"
  ON public.load_assignment_history FOR ALL
  TO authenticated
  USING
(true);

-- Drop the old SELECT-only policy since we now have the ALL policy
DROP POLICY
IF EXISTS "Allow authenticated users to view assignment history" ON public.load_assignment_history;

COMMENT ON POLICY "Allow authenticated users to insert assignment history"
  ON public.load_assignment_history
  IS 'Allows triggers and authenticated users to log load assignment changes';

COMMENT ON POLICY "Allow authenticated users to manage assignment history"
  ON public.load_assignment_history
  IS 'Full access for authenticated users to manage assignment audit trail';
