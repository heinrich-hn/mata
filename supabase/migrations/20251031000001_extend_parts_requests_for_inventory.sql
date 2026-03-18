-- Migration: Extend parts_requests table for inventory selection feature
-- Phase 1 - Migration 1 of 4
-- Date: 2025-10-31
-- Description: Add columns to link parts requests with inventory and track pricing/approval

BEGIN;

-- Add new columns to parts_requests table
-- Using IF NOT EXISTS to make this migration idempotent
ALTER TABLE parts_requests
  ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejected_by TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add computed column for inventory source tracking
-- First check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'parts_requests' 
    AND column_name = 'is_from_inventory'
  ) THEN
    ALTER TABLE parts_requests
      ADD COLUMN is_from_inventory BOOLEAN 
      GENERATED ALWAYS AS (inventory_id IS NOT NULL) STORED;
  END IF;
END $$;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_parts_requests_inventory_id 
  ON parts_requests(inventory_id);

CREATE INDEX IF NOT EXISTS idx_parts_requests_status 
  ON parts_requests(status);

CREATE INDEX IF NOT EXISTS idx_parts_requests_job_card_id 
  ON parts_requests(job_card_id);

-- Drop existing check constraint if it exists (to update it)
ALTER TABLE parts_requests 
  DROP CONSTRAINT IF EXISTS check_valid_status;

-- Add check constraint for valid status values
ALTER TABLE parts_requests
  ADD CONSTRAINT check_valid_status 
  CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled'));

-- Create or replace function to auto-calculate total_price
CREATE OR REPLACE FUNCTION calculate_parts_request_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if both unit_price and quantity exist
  IF NEW.unit_price IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    NEW.total_price := NEW.quantity * NEW.unit_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (to recreate it)
DROP TRIGGER IF EXISTS trigger_calculate_parts_request_total ON parts_requests;

-- Create trigger to auto-calculate total_price
CREATE TRIGGER trigger_calculate_parts_request_total
  BEFORE INSERT OR UPDATE OF quantity, unit_price
  ON parts_requests
  FOR EACH ROW
  EXECUTE FUNCTION calculate_parts_request_total();

COMMIT;

-- Verification query
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns
WHERE table_name = 'parts_requests'
  AND column_name IN (
    'inventory_id', 
    'unit_price', 
    'total_price', 
    'requested_by',
    'approved_by',
    'approved_at',
    'rejected_by',
    'rejected_at',
    'rejection_reason',
    'is_from_inventory'
  )
ORDER BY ordinal_position;
