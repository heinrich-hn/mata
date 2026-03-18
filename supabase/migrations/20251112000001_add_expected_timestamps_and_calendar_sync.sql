-- ============================================================================
-- ADD EXPECTED TIMESTAMPS AND BIDIRECTIONAL CALENDAR SYNC
-- Purpose: Add expected arrival/departure times and ensure loads show on calendar
-- Created: 2025-11-12
-- ============================================================================

-- ============================================================================
-- PART 1: Add Expected Timestamp Fields to Loads Table
-- ============================================================================

ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS expected_arrival_at_pickup TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expected_departure_from_pickup TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expected_arrival_at_delivery TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expected_departure_from_delivery TIMESTAMPTZ;

-- Add helpful comments
COMMENT ON COLUMN public.loads.expected_arrival_at_pickup IS 'Scheduled/expected time to arrive at loading point';
COMMENT ON COLUMN public.loads.expected_departure_from_pickup IS 'Scheduled/expected time to depart from loading point after loading';
COMMENT ON COLUMN public.loads.expected_arrival_at_delivery IS 'Scheduled/expected time to arrive at delivery point';
COMMENT ON COLUMN public.loads.expected_departure_from_delivery IS 'Scheduled/expected time to depart from delivery point after offloading';

-- Create indexes for these fields (useful for calendar queries)
CREATE INDEX IF NOT EXISTS idx_loads_expected_arrival_pickup
  ON public.loads(expected_arrival_at_pickup)
  WHERE expected_arrival_at_pickup IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loads_expected_departure_pickup
  ON public.loads(expected_departure_from_pickup)
  WHERE expected_departure_from_pickup IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loads_expected_arrival_delivery
  ON public.loads(expected_arrival_at_delivery)
  WHERE expected_arrival_at_delivery IS NOT NULL;

-- ============================================================================
-- PART 2: Create Function to Sync Loads to Calendar Events
-- ============================================================================

-- Function: Automatically create/update calendar events when loads are created/updated
CREATE OR REPLACE FUNCTION sync_load_to_calendar_events()
RETURNS TRIGGER AS $$
DECLARE
  v_pickup_event_id UUID;
  v_delivery_event_id UUID;
BEGIN
  -- Only create calendar events if we have required dates
  IF NEW.pickup_datetime IS NOT NULL OR NEW.expected_arrival_at_pickup IS NOT NULL THEN

    -- Check if pickup event already exists
    SELECT id INTO v_pickup_event_id
    FROM calendar_events
    WHERE load_id = NEW.id AND event_type = 'pickup'
    LIMIT 1;

    IF v_pickup_event_id IS NOT NULL THEN
      -- Update existing pickup event
      UPDATE calendar_events
      SET
        start_time = COALESCE(NEW.expected_arrival_at_pickup, NEW.pickup_datetime),
        end_time = COALESCE(NEW.expected_departure_from_pickup, NEW.pickup_datetime + INTERVAL '2 hours'),
        assigned_vehicle_id = NEW.assigned_vehicle_id,
        notes = CONCAT(
          'Load: ', NEW.load_number,
          ' | Origin: ', NEW.origin,
          ' | Customer: ', COALESCE(NEW.customer_name, 'N/A'),
          ' | Weight: ', NEW.weight_kg, 'kg',
          CASE WHEN NEW.notes IS NOT NULL THEN ' | Notes: ' || NEW.notes ELSE '' END
        ),
        updated_at = NOW()
      WHERE id = v_pickup_event_id;
    ELSE
      -- Create new pickup event
      INSERT INTO calendar_events (
        load_id,
        event_type,
        start_time,
        end_time,
        assigned_vehicle_id,
        notes
      ) VALUES (
        NEW.id,
        'pickup',
        COALESCE(NEW.expected_arrival_at_pickup, NEW.pickup_datetime),
        COALESCE(NEW.expected_departure_from_pickup, NEW.pickup_datetime + INTERVAL '2 hours'),
        NEW.assigned_vehicle_id,
        CONCAT(
          'Load: ', NEW.load_number,
          ' | Origin: ', NEW.origin,
          ' | Customer: ', COALESCE(NEW.customer_name, 'N/A'),
          ' | Weight: ', NEW.weight_kg, 'kg',
          CASE WHEN NEW.notes IS NOT NULL THEN ' | Notes: ' || NEW.notes ELSE '' END
        )
      );
    END IF;
  END IF;

  -- Create/update delivery event if we have delivery date
  IF NEW.delivery_datetime IS NOT NULL OR NEW.expected_arrival_at_delivery IS NOT NULL THEN

    -- Check if delivery event already exists
    SELECT id INTO v_delivery_event_id
    FROM calendar_events
    WHERE load_id = NEW.id AND event_type = 'delivery'
    LIMIT 1;

    IF v_delivery_event_id IS NOT NULL THEN
      -- Update existing delivery event
      UPDATE calendar_events
      SET
        start_time = COALESCE(NEW.expected_arrival_at_delivery, NEW.delivery_datetime),
        end_time = COALESCE(NEW.expected_departure_from_delivery, NEW.delivery_datetime + INTERVAL '2 hours'),
        assigned_vehicle_id = NEW.assigned_vehicle_id,
        notes = CONCAT(
          'Load: ', NEW.load_number,
          ' | Destination: ', NEW.destination,
          ' | Customer: ', COALESCE(NEW.customer_name, 'N/A'),
          ' | Weight: ', NEW.weight_kg, 'kg',
          CASE WHEN NEW.notes IS NOT NULL THEN ' | Notes: ' || NEW.notes ELSE '' END
        ),
        updated_at = NOW()
      WHERE id = v_delivery_event_id;
    ELSE
      -- Create new delivery event
      INSERT INTO calendar_events (
        load_id,
        event_type,
        start_time,
        end_time,
        assigned_vehicle_id,
        notes
      ) VALUES (
        NEW.id,
        'delivery',
        COALESCE(NEW.expected_arrival_at_delivery, NEW.delivery_datetime),
        COALESCE(NEW.expected_departure_from_delivery, NEW.delivery_datetime + INTERVAL '2 hours'),
        NEW.assigned_vehicle_id,
        CONCAT(
          'Load: ', NEW.load_number,
          ' | Destination: ', NEW.destination,
          ' | Customer: ', COALESCE(NEW.customer_name, 'N/A'),
          ' | Weight: ', NEW.weight_kg, 'kg',
          CASE WHEN NEW.notes IS NOT NULL THEN ' | Notes: ' || NEW.notes ELSE '' END
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_load_to_calendar ON loads;

-- Create trigger: Fire after load insert or update
CREATE TRIGGER trigger_sync_load_to_calendar
  AFTER INSERT OR UPDATE OF
    pickup_datetime,
    delivery_datetime,
    expected_arrival_at_pickup,
    expected_departure_from_pickup,
    expected_arrival_at_delivery,
    expected_departure_from_delivery,
    assigned_vehicle_id,
    origin,
    destination,
    customer_name,
    weight_kg,
    notes,
    load_number
  ON loads
  FOR EACH ROW
  EXECUTE FUNCTION sync_load_to_calendar_events();

COMMENT ON FUNCTION sync_load_to_calendar_events() IS
  'Bidirectional sync: creates/updates calendar events when loads are created/modified';

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_load_to_calendar_events() TO authenticated;

-- ============================================================================
-- PART 3: Function to Delete Calendar Events When Loads Are Deleted
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_load_calendar_events()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete any calendar events associated with this load
  DELETE FROM calendar_events
  WHERE load_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_delete_load_calendar_events ON loads;

-- Create trigger: Fire before load deletion
CREATE TRIGGER trigger_delete_load_calendar_events
  BEFORE DELETE ON loads
  FOR EACH ROW
  EXECUTE FUNCTION delete_load_calendar_events();

COMMENT ON FUNCTION delete_load_calendar_events() IS
  'Cleanup calendar events when a load is deleted';

-- Grant permissions
GRANT EXECUTE ON FUNCTION delete_load_calendar_events() TO authenticated;

-- ============================================================================
-- PART 4: Backfill Calendar Events for Existing Loads
-- ============================================================================

-- Create calendar events for any existing loads that don't have them
DO $$
DECLARE
  v_load RECORD;
BEGIN
  -- Loop through all loads that have pickup dates but no calendar events
  FOR v_load IN
    SELECT l.*
    FROM loads l
    WHERE l.pickup_datetime IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM calendar_events ce
        WHERE ce.load_id = l.id AND ce.event_type = 'pickup'
      )
  LOOP
    -- Create pickup event
    INSERT INTO calendar_events (
      load_id,
      event_type,
      start_time,
      end_time,
      assigned_vehicle_id,
      notes
    ) VALUES (
      v_load.id,
      'pickup',
      v_load.pickup_datetime,
      v_load.pickup_datetime + INTERVAL '2 hours',
      v_load.assigned_vehicle_id,
      CONCAT(
        'Load: ', v_load.load_number,
        ' | Origin: ', v_load.origin,
        ' | Customer: ', COALESCE(v_load.customer_name, 'N/A'),
        ' | Weight: ', v_load.weight_kg, 'kg'
      )
    );

    -- Create delivery event if delivery date exists
    IF v_load.delivery_datetime IS NOT NULL THEN
      INSERT INTO calendar_events (
        load_id,
        event_type,
        start_time,
        end_time,
        assigned_vehicle_id,
        notes
      ) VALUES (
        v_load.id,
        'delivery',
        v_load.delivery_datetime,
        v_load.delivery_datetime + INTERVAL '2 hours',
        v_load.assigned_vehicle_id,
        CONCAT(
          'Load: ', v_load.load_number,
          ' | Destination: ', v_load.destination,
          ' | Customer: ', COALESCE(v_load.customer_name, 'N/A'),
          ' | Weight: ', v_load.weight_kg, 'kg'
        )
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Calendar events backfill completed';
END;
$$;

-- ============================================================================
-- PART 5: Create Helper View for Calendar Display
-- ============================================================================

-- Drop view if exists
DROP VIEW IF EXISTS v_calendar_load_events CASCADE;

-- Create view that combines load data with calendar events
CREATE VIEW v_calendar_load_events AS
SELECT
  ce.id as event_id,
  ce.event_type,
  ce.start_time,
  ce.end_time,
  ce.notes as event_notes,
  l.id as load_id,
  l.load_number,
  l.origin,
  l.destination,
  l.customer_name,
  l.weight_kg,
  l.status,
  l.pickup_datetime,
  l.delivery_datetime,
  l.expected_arrival_at_pickup,
  l.expected_departure_from_pickup,
  l.expected_arrival_at_delivery,
  l.expected_departure_from_delivery,
  l.assigned_vehicle_id,
  wv.fleet_number,
  wv.registration,
  wv.name as vehicle_name
FROM calendar_events ce
JOIN loads l ON ce.load_id = l.id
LEFT JOIN wialon_vehicles wv ON l.assigned_vehicle_id = wv.id
WHERE ce.event_type IN ('pickup', 'delivery')
ORDER BY ce.start_time;

COMMENT ON VIEW v_calendar_load_events IS
  'Combined view of calendar events with full load and vehicle details';

-- Grant permissions
GRANT SELECT ON v_calendar_load_events TO authenticated;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration:
-- 1. Adds 4 new expected timestamp fields to loads table
-- 2. Creates bidirectional sync between loads and calendar_events
-- 3. Backfills calendar events for existing loads
-- 4. Creates a helpful view for calendar display
-- 5. Ensures loads automatically appear on the calendar when created
-- ============================================================================
