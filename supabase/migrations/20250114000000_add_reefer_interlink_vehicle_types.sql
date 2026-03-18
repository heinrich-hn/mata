-- Add reefer and interlink vehicle types to the vehicle_type enum
-- This allows creating job cards for these vehicle types

-- Add new values to the vehicle_type enum
ALTER TYPE vehicle_type
ADD VALUE
IF NOT EXISTS 'reefer';
ALTER TYPE vehicle_type
ADD VALUE
IF NOT EXISTS 'interlink';

-- Note: PostgreSQL doesn't allow removing enum values, only adding them
-- The new values will now be available in the vehicles table
