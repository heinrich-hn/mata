-- ============================================================================
-- ENABLE REALTIME FOR LOADS TABLE
-- Allows LoadManagement component to receive real-time updates
-- ============================================================================

-- Enable realtime publication for the loads table
ALTER PUBLICATION supabase_realtime
ADD TABLE public.loads;

-- Add comment
COMMENT ON TABLE public.loads IS 'Cargo/freight management - tracks shipments to be transported. Realtime enabled for live updates.';
