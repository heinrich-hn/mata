-- Create incident_checklists table to store checklist responses
-- Migration: 20251208000003_create_incident_checklists.sql

-- Create incident_checklists table
CREATE TABLE IF NOT EXISTS incident_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,

  -- Store responses as JSONB array: [{item_id: 1, response: true/false/null, notes: "", completed_at: "", completed_by: ""}]
  responses JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Tracking
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure one checklist per incident
  CONSTRAINT unique_incident_checklist UNIQUE (incident_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_incident_checklists_incident_id ON incident_checklists(incident_id);

-- Enable RLS
ALTER TABLE incident_checklists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow authenticated users to view incident checklists" ON incident_checklists;
CREATE POLICY "Allow authenticated users to view incident checklists"
ON incident_checklists FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create incident checklists" ON incident_checklists;
CREATE POLICY "Allow authenticated users to create incident checklists"
ON incident_checklists FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update incident checklists" ON incident_checklists;
CREATE POLICY "Allow authenticated users to update incident checklists"
ON incident_checklists FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete incident checklists" ON incident_checklists;
CREATE POLICY "Allow authenticated users to delete incident checklists"
ON incident_checklists FOR DELETE
TO authenticated
USING (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_incident_checklist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_incident_checklist_timestamp ON incident_checklists;
CREATE TRIGGER trigger_update_incident_checklist_timestamp
  BEFORE UPDATE ON incident_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_incident_checklist_timestamp();

-- Add comment
COMMENT ON TABLE incident_checklists IS 'Stores accident reporting checklist responses for each incident';
