-- Migration: Add edit history audit trail to daily_dip_records
-- This adds columns to track changes made to dip records for audit purposes

-- Add edit_history JSONB column to store history of edits
ALTER TABLE daily_dip_records
ADD COLUMN
IF NOT EXISTS edit_history jsonb DEFAULT '[]'::jsonb;

-- Add last_edited_by to track who made the last edit
ALTER TABLE daily_dip_records
ADD COLUMN
IF NOT EXISTS last_edited_by text;

-- Add last_edited_at to track when the last edit was made
ALTER TABLE daily_dip_records
ADD COLUMN
IF NOT EXISTS last_edited_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN daily_dip_records.edit_history IS 'JSON array storing audit trail of all edits made to this record';
COMMENT ON COLUMN daily_dip_records.last_edited_by IS 'Name of the user who last edited this record';
COMMENT ON COLUMN daily_dip_records.last_edited_at IS 'Timestamp of the last edit to this record';
