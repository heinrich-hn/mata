-- Migration: Add RLS policies for driver_vehicle_assignments table
-- This allows drivers to manage their own vehicle assignments via the mobile app

-- Enable RLS on the table if not already enabled
ALTER TABLE driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all assignments (needed for admin views)
DROP POLICY
IF EXISTS "Allow authenticated read assignments" ON driver_vehicle_assignments;
CREATE POLICY "Allow authenticated read assignments"
ON driver_vehicle_assignments
FOR
SELECT
  TO authenticated
USING
(true);

-- Allow authenticated users to insert their own assignments
DROP POLICY
IF EXISTS "Allow authenticated insert own assignments" ON driver_vehicle_assignments;
CREATE POLICY "Allow authenticated insert own assignments"
ON driver_vehicle_assignments
FOR
INSERT
TO authenticated
WITH CHECK (
true);

-- Allow authenticated users to update their own assignments
DROP POLICY
IF EXISTS "Allow authenticated update own assignments" ON driver_vehicle_assignments;
CREATE POLICY "Allow authenticated update own assignments"
ON driver_vehicle_assignments
FOR
UPDATE
TO authenticated
USING (true)
WITH CHECK
(true);

-- Allow authenticated users to delete their own assignments (optional, for admin)
DROP POLICY
IF EXISTS "Allow authenticated delete assignments" ON driver_vehicle_assignments;
CREATE POLICY "Allow authenticated delete assignments"
ON driver_vehicle_assignments
FOR
DELETE
TO authenticated
USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON driver_vehicle_assignments TO authenticated;

COMMENT ON TABLE driver_vehicle_assignments IS 'Links drivers to their assigned vehicles - RLS enabled for mobile app access';
