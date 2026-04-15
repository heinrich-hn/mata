-- Add 'off_day' to the valid_day_status check constraint
ALTER TABLE driver_day_status DROP CONSTRAINT valid_day_status;
ALTER TABLE driver_day_status ADD CONSTRAINT valid_day_status CHECK (status IN ('at_work', 'on_trip', 'leave', 'off_day'));
