-- ============================================================================
-- GEOFENCE-BASED LOAD STATUS AUTOMATION
-- Auto-update load status when vehicle enters/exits geofences
-- Created: 2025-11-11
-- ============================================================================

-- Function: Update load status based on geofence events
CREATE OR REPLACE FUNCTION handle_geofence_load_automation
()
RETURNS TRIGGER AS $$
DECLARE
  v_load RECORD;
  v_geofence RECORD;
  v_new_status TEXT;
BEGIN
  -- Only process entry events with load_id
  IF NEW.event_type = 'entered' AND NEW.load_id IS NOT NULL THEN

  -- Get load details
  SELECT *
  INTO v_load
  FROM loads
  WHERE id = NEW.load_id;

  IF NOT FOUND THEN
  RETURN NEW;
END
IF;

    -- Get geofence details
    SELECT *
INTO v_geofence
FROM geofence_zones
WHERE id = NEW.geofence_zone_id;

IF NOT FOUND THEN
RETURN NEW;
END
IF;

    -- Determine status update based on geofence type and current status
    v_new_status := v_load.status;

-- LOADING LOCATION LOGIC
IF v_geofence.zone_type IN ('warehouse', 'depot', 'pickup') AND v_load.status = 'assigned' THEN
      v_new_status := 'arrived_at_pickup';

UPDATE loads
      SET
        status = v_new_status,
        arrived_at_pickup = NEW.event_timestamp,
        updated_at = NOW()
      WHERE id = NEW.load_id;

-- Create delivery event
INSERT INTO delivery_events
  (
  load_id, vehicle_id, event_type,
  latitude, longitude, location_name,
  event_timestamp, recorded_by
  )
VALUES
  (
    NEW.load_id, NEW.vehicle_id, 'arrived_origin',
    NEW.latitude, NEW.longitude, v_geofence.zone_name,
    NEW.event_timestamp, 'system_geofence'
      );

RAISE NOTICE 'Load % arrived at pickup location: %', v_load.load_number, v_geofence.zone_name;

END
IF;

    -- DELIVERY LOCATION LOGIC
    IF v_geofence.zone_type IN ('customer', 'delivery_point', 'delivery') AND v_load.status = 'in_transit' THEN
      v_new_status := 'arrived_at_delivery';

UPDATE loads
      SET
        status = v_new_status,
        arrived_at_delivery = NEW.event_timestamp,
        updated_at = NOW()
      WHERE id = NEW.load_id;

-- Create delivery event
INSERT INTO delivery_events
  (
  load_id, vehicle_id, event_type,
  latitude, longitude, location_name,
  event_timestamp, recorded_by
  )
VALUES
  (
    NEW.load_id, NEW.vehicle_id, 'arrived_destination',
    NEW.latitude, NEW.longitude, v_geofence.zone_name,
    NEW.event_timestamp, 'system_geofence'
      );

RAISE NOTICE 'Load % arrived at delivery location: %', v_load.load_number, v_geofence.zone_name;

END
IF;

  END
IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_geofence_load_automation
ON geofence_events;

-- Trigger: Fire after geofence event is created
CREATE TRIGGER trigger_geofence_load_automation
  AFTER
INSERT ON
geofence_events
FOR
EACH
ROW
EXECUTE FUNCTION handle_geofence_load_automation
();

COMMENT ON FUNCTION handle_geofence_load_automation
() IS
  'Automatically update load status when vehicle enters loading/delivery geofences';

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_geofence_load_automation
() TO authenticated;
