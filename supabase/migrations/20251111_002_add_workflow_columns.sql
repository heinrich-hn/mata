-- Migration Part 2: Add workflow timestamp columns and supporting objects
-- Purpose: Track exact timing for each stage of the load lifecycle
-- NOTE: Run this AFTER 20251111_001_add_enum_values.sql

-- Add new timestamp columns for detailed workflow tracking
ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS arrived_at_pickup TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS loading_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS loading_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS arrived_at_delivery TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS offloading_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS offloading_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_loads_status ON public.loads(status);
CREATE INDEX IF NOT EXISTS idx_loads_workflow_timestamps ON public.loads(
  loading_started_at,
  loading_completed_at,
  offloading_started_at,
  offloading_completed_at
);

-- Function to calculate loading duration
CREATE OR REPLACE FUNCTION calculate_loading_duration(p_load_id UUID)
RETURNS INTERVAL AS $$
DECLARE
  v_duration INTERVAL;
BEGIN
  SELECT loading_completed_at - loading_started_at
  INTO v_duration
  FROM public.loads
  WHERE id = p_load_id;

  RETURN v_duration;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate offloading duration
CREATE OR REPLACE FUNCTION calculate_offloading_duration(p_load_id UUID)
RETURNS INTERVAL AS $$
DECLARE
  v_duration INTERVAL;
BEGIN
  SELECT offloading_completed_at - offloading_started_at
  INTO v_duration
  FROM public.loads
  WHERE id = p_load_id;

  RETURN v_duration;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total transit time
CREATE OR REPLACE FUNCTION calculate_transit_time(p_load_id UUID)
RETURNS INTERVAL AS $$
DECLARE
  v_duration INTERVAL;
BEGIN
  SELECT arrived_at_delivery - departure_time
  INTO v_duration
  FROM public.loads
  WHERE id = p_load_id;

  RETURN v_duration;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_loading_duration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_offloading_duration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_transit_time(UUID) TO authenticated;

-- Create view for workflow analytics
CREATE OR REPLACE VIEW load_workflow_analytics AS
SELECT
  l.id,
  l.load_number,
  l.status,
  l.customer_name,
  l.origin,
  l.destination,

  -- Duration calculations (in minutes)
  EXTRACT(EPOCH FROM (l.loading_completed_at - l.loading_started_at)) / 60 AS loading_duration_minutes,
  EXTRACT(EPOCH FROM (l.arrived_at_delivery - l.departure_time)) / 60 AS transit_duration_minutes,
  EXTRACT(EPOCH FROM (l.offloading_completed_at - l.offloading_started_at)) / 60 AS offloading_duration_minutes,
  EXTRACT(EPOCH FROM (l.completed_at - l.created_at)) / 60 AS total_duration_minutes,

  -- Timestamps
  l.created_at,
  l.assigned_at,
  l.arrived_at_pickup,
  l.loading_started_at,
  l.loading_completed_at,
  l.departure_time,
  l.arrived_at_delivery,
  l.offloading_started_at,
  l.offloading_completed_at,
  l.delivered_at,
  l.completed_at,

  -- Schedule variance
  l.pickup_datetime AS scheduled_pickup,
  l.delivery_datetime AS scheduled_delivery,
  l.actual_pickup_datetime,
  l.actual_delivery_datetime,

  -- Check if behind schedule
  CASE
    WHEN l.arrived_at_delivery IS NOT NULL
         AND l.delivery_datetime IS NOT NULL
         AND l.arrived_at_delivery > l.delivery_datetime THEN true
    ELSE false
  END AS is_delayed,

  -- Time variance in minutes
  EXTRACT(EPOCH FROM (l.delivery_datetime - l.arrived_at_delivery)) / 60 AS time_variance_minutes,

  -- Vehicle info
  l.assigned_vehicle_id,
  v.registration_number,
  v.fleet_number

FROM public.loads l
LEFT JOIN public.vehicles v ON l.assigned_vehicle_id = v.id
WHERE l.status IN (
  'loading_completed',
  'in_transit',
  'arrived_at_delivery',
  'offloading',
  'offloading_completed',
  'delivered',
  'completed'
);

-- Grant select on view
GRANT SELECT ON load_workflow_analytics TO authenticated;

-- Create trigger function to log status changes
CREATE OR REPLACE FUNCTION log_load_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    -- Log to load_history or notifications table if it exists
    RAISE NOTICE 'Load % status changed from % to %',
      NEW.load_number, OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status changes
DROP TRIGGER IF EXISTS load_status_change_trigger ON public.loads;
CREATE TRIGGER load_status_change_trigger
  AFTER UPDATE ON public.loads
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_load_status_change();

-- Add comments
COMMENT ON COLUMN public.loads.arrived_at_pickup IS 'Timestamp when vehicle arrived at pickup/loading location';
COMMENT ON COLUMN public.loads.loading_started_at IS 'Timestamp when loading process began';
COMMENT ON COLUMN public.loads.loading_completed_at IS 'Timestamp when all cargo was loaded';
COMMENT ON COLUMN public.loads.departure_time IS 'Timestamp when vehicle departed from pickup location';
COMMENT ON COLUMN public.loads.arrived_at_delivery IS 'Timestamp when vehicle arrived at delivery/offloading location';
COMMENT ON COLUMN public.loads.offloading_started_at IS 'Timestamp when offloading process began';
COMMENT ON COLUMN public.loads.offloading_completed_at IS 'Timestamp when all cargo was offloaded';
COMMENT ON COLUMN public.loads.delivered_at IS 'Timestamp when delivery was confirmed';
COMMENT ON COLUMN public.loads.completed_at IS 'Timestamp when load was marked as fully completed';

COMMENT ON VIEW load_workflow_analytics IS 'Analytics view for load workflow performance metrics';
COMMENT ON FUNCTION calculate_loading_duration IS 'Calculate duration between loading start and completion';
COMMENT ON FUNCTION calculate_offloading_duration IS 'Calculate duration between offloading start and completion';
COMMENT ON FUNCTION calculate_transit_time IS 'Calculate duration between departure and arrival at delivery location';
