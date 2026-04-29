-- Add risk_score (1-5) to driver_behavior_events.
-- Assigned during debriefing to indicate the assessed risk level
-- of the event/event-type combination for the driver.
ALTER TABLE public.driver_behavior_events
ADD COLUMN IF NOT EXISTS risk_score SMALLINT
  CHECK (risk_score IS NULL OR (risk_score BETWEEN 1 AND 5));

COMMENT ON COLUMN public.driver_behavior_events.risk_score IS
  'Risk score (1-5) assigned to the event/event-type during debriefing. 1 = low risk, 5 = critical risk.';
