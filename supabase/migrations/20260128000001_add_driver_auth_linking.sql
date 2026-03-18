-- Migration: Add auth linking to drivers table
-- This allows linking fleet drivers to Supabase auth users for mobile app access

-- Add auth_user_id column to drivers table
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_drivers_auth_user_id ON drivers(auth_user_id);

-- Create a unique constraint to prevent multiple drivers linking to same auth user
ALTER TABLE drivers
ADD CONSTRAINT drivers_auth_user_id_unique UNIQUE (auth_user_id);

-- Create a view to show drivers with their auth status
CREATE OR REPLACE VIEW drivers_with_auth_status AS
SELECT
  d.*,
  CASE WHEN d.auth_user_id IS NOT NULL THEN true ELSE false END as has_auth_profile,
  u.user_id as linked_user_id,
  u.username as linked_username
FROM drivers d
LEFT JOIN users u ON u.notification_email = d.email;

-- RLS policy for the view
ALTER VIEW drivers_with_auth_status OWNER TO authenticated;

-- Function to create driver mobile app access
CREATE OR REPLACE FUNCTION create_driver_auth_profile(
  p_driver_id UUID,
  p_email TEXT,
  p_password TEXT,
  p_role_id INTEGER DEFAULT 8 -- Default to Driver role, adjust as needed
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver RECORD;
  v_auth_user_id UUID;
  v_user_id INTEGER;
  v_shortcode TEXT;
  v_username TEXT;
BEGIN
  -- Get driver details
  SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Driver not found');
  END IF;

  -- Check if driver already has auth profile
  IF v_driver.auth_user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Driver already has an auth profile');
  END IF;

  -- Generate username and shortcode
  v_username := LOWER(REPLACE(v_driver.first_name || '.' || v_driver.last_name, ' ', ''));
  v_shortcode := UPPER(SUBSTRING(v_driver.first_name FROM 1 FOR 1) || SUBSTRING(v_driver.last_name FROM 1 FOR 2));

  -- Check if username exists, append number if needed
  WHILE EXISTS (SELECT 1 FROM users WHERE username = v_username) LOOP
    v_username := v_username || FLOOR(RANDOM() * 1000)::TEXT;
  END LOOP;

  -- Create entry in users table
  INSERT INTO users (
    name,
    username,
    shortcode,
    notification_email,
    role_id,
    status
  ) VALUES (
    v_driver.first_name || ' ' || v_driver.last_name,
    v_username,
    v_shortcode,
    p_email,
    p_role_id,
    'Active'
  ) RETURNING user_id INTO v_user_id;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', v_username,
    'message', 'User profile created. Auth user needs to be created separately via Supabase Auth.'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_driver_auth_profile TO authenticated;

-- Function to link existing auth user to driver
CREATE OR REPLACE FUNCTION link_auth_to_driver(
  p_driver_id UUID,
  p_auth_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update driver with auth user id
  UPDATE drivers
  SET auth_user_id = p_auth_user_id,
      updated_at = NOW()
  WHERE id = p_driver_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Driver not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Auth user linked to driver');
END;
$$;

GRANT EXECUTE ON FUNCTION link_auth_to_driver TO authenticated;

COMMENT ON COLUMN drivers.auth_user_id IS 'Links to Supabase auth.users for mobile app authentication';
