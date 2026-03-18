-- Add root_cause_analysis JSONB column to vehicle_inspections table
ALTER TABLE public.vehicle_inspections
ADD COLUMN
IF NOT EXISTS root_cause_analysis JSONB;

-- Add comment to explain the structure
COMMENT ON COLUMN public.vehicle_inspections.root_cause_analysis IS
'Root Cause Analysis data stored as JSON with fields: root_cause, conducted_by, responsible_person, notes, completed_at';
