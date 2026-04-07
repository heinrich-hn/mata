-- Add progress_lines JSON column to action_items table
-- Stores an array of progress line entries with dates for tracking progress
ALTER TABLE action_items
ADD COLUMN IF NOT EXISTS progress_lines jsonb DEFAULT '[]'::jsonb;
