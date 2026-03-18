-- Add load_type column to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS load_type text;