-- Migration: Add cost document uploads and vendor tracking for job cards
-- Date: 2025-11-12
-- Description: Enhance parts_requests to support document uploads, vendor selection for non-inventory items, and improved cost tracking

BEGIN;

-- 1. Add vendor_id column to parts_requests for non-inventory items
ALTER TABLE parts_requests
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS document_name TEXT,
  ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT FALSE, -- Flag for services/repairs vs physical parts
  ADD COLUMN IF NOT EXISTS service_description TEXT;

-- 2. Create index on vendor_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_parts_requests_vendor_id
  ON parts_requests(vendor_id);

-- 3. Add comment explaining the data model
COMMENT ON COLUMN parts_requests.inventory_id IS 'Link to inventory for stock parts. NULL for non-inventory items (services, external parts)';
COMMENT ON COLUMN parts_requests.vendor_id IS 'Vendor for non-inventory items. NULL if from internal inventory';
COMMENT ON COLUMN parts_requests.document_url IS 'URL to uploaded document (receipt, invoice, quote) as proof of cost';
COMMENT ON COLUMN parts_requests.is_service IS 'TRUE for services/repairs (labor, welding, etc), FALSE for physical parts';

-- 4. Create a view for easy cost calculations per job card
CREATE OR REPLACE VIEW job_card_cost_summary AS
SELECT
  job_card_id,
  -- Inventory parts cost
  COALESCE(SUM(CASE WHEN inventory_id IS NOT NULL THEN total_price ELSE 0 END), 0) AS inventory_parts_cost,
  -- Non-inventory parts cost
  COALESCE(SUM(CASE WHEN inventory_id IS NULL AND is_service = FALSE THEN total_price ELSE 0 END), 0) AS external_parts_cost,
  -- Services cost
  COALESCE(SUM(CASE WHEN is_service = TRUE THEN total_price ELSE 0 END), 0) AS services_cost,
  -- Total cost
  COALESCE(SUM(total_price), 0) AS total_parts_cost,
  -- Count of items
  COUNT(*) AS total_items,
  COUNT(CASE WHEN inventory_id IS NOT NULL THEN 1 END) AS inventory_items_count,
  COUNT(CASE WHEN inventory_id IS NULL AND is_service = FALSE THEN 1 END) AS external_items_count,
  COUNT(CASE WHEN is_service = TRUE THEN 1 END) AS service_items_count,
  -- Document tracking
  COUNT(CASE WHEN document_url IS NOT NULL THEN 1 END) AS items_with_documents
FROM parts_requests
WHERE status != 'cancelled'
GROUP BY job_card_id;

-- 5. Create function to validate parts request based on source
CREATE OR REPLACE FUNCTION validate_parts_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that inventory items have inventory_id
  IF NEW.is_service = FALSE AND NEW.inventory_id IS NULL AND NEW.vendor_id IS NULL THEN
    RAISE EXCEPTION 'Non-service parts must have either inventory_id or vendor_id specified';
  END IF;

  -- Validate that inventory items don't have vendor_id
  IF NEW.inventory_id IS NOT NULL AND NEW.vendor_id IS NOT NULL THEN
    RAISE EXCEPTION 'Part cannot be from both inventory and external vendor';
  END IF;

  -- Validate service description for services
  IF NEW.is_service = TRUE AND (NEW.service_description IS NULL OR NEW.service_description = '') THEN
    RAISE EXCEPTION 'Service items must have a service_description';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for validation
DROP TRIGGER IF EXISTS trigger_validate_parts_request ON parts_requests;
CREATE TRIGGER trigger_validate_parts_request
  BEFORE INSERT OR UPDATE ON parts_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_parts_request();

-- 7. Add RLS policies for document access (if not exists)
-- Users can see documents for parts requests they have access to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'parts_requests'
    AND policyname = 'Users can view documents'
  ) THEN
    -- This is just a placeholder - actual policy depends on your auth setup
    -- Typically handled by existing RLS policies on parts_requests table
    NULL;
  END IF;
END $$;

COMMIT;

-- Verification queries
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'parts_requests'
  AND column_name IN ('vendor_id', 'document_url', 'document_name', 'is_service', 'service_description')
ORDER BY ordinal_position;

-- Test the view
SELECT * FROM job_card_cost_summary LIMIT 5;
