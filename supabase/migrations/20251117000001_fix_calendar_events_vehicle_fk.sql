-- Fix foreign key constraint issue for calendar_events
-- This migration ensures loads.assigned_vehicle_id properly references wialon_vehicles

-- =====================================================
-- 1. Add foreign key constraint to loads.assigned_vehicle_id
-- =====================================================
-- First, check if there are any orphaned records and clean them up
DO $$
BEGIN
  -- Set NULL for any loads.assigned_vehicle_id that doesn't exist in wialon_vehicles
  UPDATE loads
  SET assigned_vehicle_id = NULL
  WHERE assigned_vehicle_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM wialon_vehicles WHERE id = loads.assigned_vehicle_id
    );

  RAISE NOTICE 'Cleaned up orphaned assigned_vehicle_id references in loads table';
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loads_assigned_vehicle_id_fkey'
  ) THEN
    ALTER TABLE loads
      ADD CONSTRAINT loads_assigned_vehicle_id_fkey
      FOREIGN KEY (assigned_vehicle_id)
      REFERENCES wialon_vehicles(id)
      ON DELETE SET NULL;

    RAISE NOTICE 'Added foreign key constraint loads_assigned_vehicle_id_fkey';
  ELSE
    RAISE NOTICE 'Foreign key constraint loads_assigned_vehicle_id_fkey already exists';
  END IF;
END $$;

-- =====================================================
-- 2. Update trigger to handle NULL vehicle IDs gracefully
-- =====================================================
-- Replace the sync_load_to_calendar_events function to handle NULLs better
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
      -- Only update assigned_vehicle_id if it's valid
      UPDATE calendar_events
      SET
        start_time = COALESCE(NEW.expected_arrival_at_pickup, NEW.pickup_datetime),
        end_time = COALESCE(NEW.expected_departure_from_pickup, NEW.pickup_datetime + INTERVAL '2 hours'),
        assigned_vehicle_id = CASE
          WHEN NEW.assigned_vehicle_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM wialon_vehicles WHERE id = NEW.assigned_vehicle_id)
          THEN NEW.assigned_vehicle_id
          ELSE NULL
        END,
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
      -- Only set assigned_vehicle_id if it exists in wialon_vehicles
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
        CASE
          WHEN NEW.assigned_vehicle_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM wialon_vehicles WHERE id = NEW.assigned_vehicle_id)
          THEN NEW.assigned_vehicle_id
          ELSE NULL
        END,
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

  -- Similar logic for delivery event
  IF NEW.delivery_datetime IS NOT NULL OR NEW.expected_arrival_at_delivery IS NOT NULL THEN

    SELECT id INTO v_delivery_event_id
    FROM calendar_events
    WHERE load_id = NEW.id AND event_type = 'delivery'
    LIMIT 1;

    IF v_delivery_event_id IS NOT NULL THEN
      -- Update existing delivery event
      -- Only update assigned_vehicle_id if it's valid
      UPDATE calendar_events
      SET
        start_time = COALESCE(NEW.expected_arrival_at_delivery, NEW.delivery_datetime),
        end_time = COALESCE(NEW.expected_departure_from_delivery, NEW.delivery_datetime + INTERVAL '2 hours'),
        assigned_vehicle_id = CASE
          WHEN NEW.assigned_vehicle_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM wialon_vehicles WHERE id = NEW.assigned_vehicle_id)
          THEN NEW.assigned_vehicle_id
          ELSE NULL
        END,
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
        CASE
          WHEN NEW.assigned_vehicle_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM wialon_vehicles WHERE id = NEW.assigned_vehicle_id)
          THEN NEW.assigned_vehicle_id
          ELSE NULL
        END,
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_load_to_calendar_events() IS 'Automatically syncs load data to calendar_events with validation for assigned_vehicle_id';

-- =====================================================
-- 3. Verify the fix
-- =====================================================
DO $$
DECLARE
  v_orphaned_count INTEGER;
BEGIN
  -- Check for any orphaned calendar_events
  SELECT COUNT(*) INTO v_orphaned_count
  FROM calendar_events ce
  WHERE ce.assigned_vehicle_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM wialon_vehicles wv WHERE wv.id = ce.assigned_vehicle_id
    );

  IF v_orphaned_count > 0 THEN
    RAISE WARNING 'Found % calendar_events with invalid assigned_vehicle_id. Cleaning up...', v_orphaned_count;

    UPDATE calendar_events
    SET assigned_vehicle_id = NULL
    WHERE assigned_vehicle_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM wialon_vehicles WHERE id = calendar_events.assigned_vehicle_id
      );

    RAISE NOTICE 'Cleaned up % orphaned calendar_events references', v_orphaned_count;
  ELSE
    RAISE NOTICE 'No orphaned calendar_events found';
  END IF;

  RAISE NOTICE 'Foreign key constraint fix completed successfully!';
END $$;
