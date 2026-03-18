-- Migration: Add procurement-specific fields to parts_requests
-- Description: Adds dedicated columns for IR Number and Make/Brand for better tracking and reporting
-- Run this in your Supabase SQL Editor

-- Add new columns for procurement tracking
ALTER TABLE parts_requests
ADD COLUMN
IF NOT EXISTS ir_number TEXT,
ADD COLUMN
IF NOT EXISTS make_brand TEXT;

-- Add index for IR number lookups
CREATE INDEX
IF NOT EXISTS idx_parts_requests_ir_number
  ON parts_requests
(ir_number)
  WHERE ir_number IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN parts_requests.ir_number IS 'Internal Requisition (IR) number for procurement tracking';
COMMENT ON COLUMN parts_requests.make_brand IS 'Manufacturer or brand name of the part being procured';

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed: Added ir_number and make_brand columns to parts_requests';
  RAISE NOTICE '   - ir_number: For Internal Requisition tracking';
  RAISE NOTICE '   - make_brand: For manufacturer/brand information';
END $$;
