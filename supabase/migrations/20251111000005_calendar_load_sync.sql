-- ============================================================================
-- CALENDAR TO LOAD SYNC TRIGGER
-- Automatically update loads table when calendar events are created/updated
-- Created: 2025-11-11
-- ============================================================================

-- Function: Sync calendar event vehicle assignment to load
CREATE OR REPLACE FUNCTION sync_calendar_event_to_load()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process pickup/delivery events with load_id
  IF NEW.load_id IS NOT NULL AND NEW.event_type IN ('pickup', 'delivery') THEN

    -- Update the load with assigned vehicle and timing
    UPDATE loads
    SET
      assigned_vehicle_id = NEW.assigned_vehicle_id,
      status = CASE
        WHEN status = 'pending' AND NEW.assigned_vehicle_id IS NOT NULL THEN 'assigned'
        ELSE status
      END,
      pickup_datetime = CASE
        WHEN NEW.event_type = 'pickup' THEN NEW.start_time
        ELSE pickup_datetime
      END,
      delivery_datetime = CASE
        WHEN NEW.event_type = 'delivery' THEN NEW.start_time
        ELSE delivery_datetime
      END,
      updated_at = NOW()
    WHERE id = NEW.load_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_calendar_to_load ON calendar_events;

-- Trigger: Fire after calendar_event insert/update
CREATE TRIGGER trigger_sync_calendar_to_load
  AFTER INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION sync_calendar_event_to_load();

COMMENT ON FUNCTION sync_calendar_event_to_load() IS
  'Auto-sync calendar event assignments to loads table - updates vehicle assignment and status';

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_calendar_event_to_load() TO authenticated;
