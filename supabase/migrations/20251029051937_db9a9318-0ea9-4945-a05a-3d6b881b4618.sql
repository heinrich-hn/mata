-- Add debrief and coaching fields to driver_behavior_events table
ALTER TABLE driver_behavior_events 
ADD COLUMN IF NOT EXISTS debrief_date DATE,
ADD COLUMN IF NOT EXISTS debrief_notes TEXT,
ADD COLUMN IF NOT EXISTS debrief_conducted_by TEXT,
ADD COLUMN IF NOT EXISTS driver_acknowledged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS driver_signature TEXT,
ADD COLUMN IF NOT EXISTS debriefer_signature TEXT,
ADD COLUMN IF NOT EXISTS witness_signature TEXT,
ADD COLUMN IF NOT EXISTS coaching_action_plan TEXT,
ADD COLUMN IF NOT EXISTS debriefed_at TIMESTAMPTZ;