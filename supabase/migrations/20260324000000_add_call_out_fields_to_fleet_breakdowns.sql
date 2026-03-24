-- Add call-out workflow fields to fleet_breakdowns
ALTER TABLE fleet_breakdowns
  ADD COLUMN IF NOT EXISTS call_out_departure_time timestamptz,
  ADD COLUMN IF NOT EXISTS call_out_start_time timestamptz,
  ADD COLUMN IF NOT EXISTS call_out_completed_time timestamptz,
  ADD COLUMN IF NOT EXISTS call_out_mechanic text;
