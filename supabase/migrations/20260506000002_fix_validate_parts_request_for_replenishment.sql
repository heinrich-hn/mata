-- Fix validate_parts_request trigger to allow replenishment requests.
--
-- Replenishment requests (created from low-stock items) legitimately need BOTH
-- inventory_id (which SKU is being topped up) AND vendor_id (who to buy from).
-- The previous trigger forbade this combination unconditionally, breaking the
-- replenishment workflow.
--
-- The mutual-exclusion rule (a part is EITHER pulled from existing stock OR
-- bought externally) only makes sense for parts attached to a job card. For
-- standalone procurement / replenishment rows, both columns must be allowed
-- to coexist.

CREATE OR REPLACE FUNCTION validate_parts_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Tyre procurement rows are valid without inventory_id or vendor_id
  IF NEW.tyre_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Non-service, non-tyre parts must have either inventory_id or vendor_id
  IF (NEW.is_service IS NOT DISTINCT FROM FALSE)
     AND NEW.inventory_id IS NULL
     AND NEW.vendor_id IS NULL THEN
    RAISE EXCEPTION 'Non-service parts must have either inventory_id or vendor_id specified';
  END IF;

  -- A job-card part cannot be both pulled from inventory and bought from a vendor.
  -- For non-job-card rows (replenishment / standalone procurement) both columns
  -- may be set: inventory_id identifies the SKU being topped up and vendor_id
  -- identifies who to order from.
  IF NEW.job_card_id IS NOT NULL
     AND NEW.inventory_id IS NOT NULL
     AND NEW.vendor_id IS NOT NULL THEN
    RAISE EXCEPTION 'Part cannot be from both inventory and external vendor';
  END IF;

  -- Service items must have a description
  IF (NEW.is_service IS DISTINCT FROM FALSE)
     AND (NEW.is_service IS NOT DISTINCT FROM TRUE)
     AND (NEW.service_description IS NULL OR NEW.service_description = '') THEN
    RAISE EXCEPTION 'Service items must have a service_description';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
