-- Migration: Cascade driver name updates across all tables
-- When a driver's first_name or last_name changes, all records referencing
-- the old "FirstName LastName" string are updated to the new name.

CREATE OR REPLACE FUNCTION public.cascade_driver_name_update(
  p_old_name TEXT,
  p_new_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip if names are identical (case-insensitive check)
  IF LOWER(TRIM(p_old_name)) = LOWER(TRIM(p_new_name)) THEN
    RETURN;
  END IF;

  -- Update all tables that store driver_name as a text string
  -- Uses case-insensitive matching (ILIKE) to handle mixed-case entries
  UPDATE public.trips
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.diesel_records
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.reefer_diesel_records
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.car_reports
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.coaching_sessions
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.corrective_actions
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.driver_behavior
    SET driver_name = p_new_name
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.driver_behavior_events
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.fuel_route_analytics
    SET driver_name = p_new_name
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.fuel_transactions
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.incidents
    SET driver_name = p_new_name, updated_at = NOW()
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));

  UPDATE public.route_analytics
    SET driver_name = p_new_name
    WHERE LOWER(TRIM(driver_name)) = LOWER(TRIM(p_old_name));
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cascade_driver_name_update(TEXT, TEXT) TO authenticated;
