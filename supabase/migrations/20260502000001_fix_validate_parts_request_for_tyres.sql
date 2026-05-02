-- Fix validate_parts_request trigger to allow tyre procurement rows.
--
-- Tyre procurement requests (tyre_id IS NOT NULL) are a valid third category:
-- they are not inventory-linked and not yet vendor-linked at creation time.
-- The original trigger only knew about service items and inventory/vendor items,
-- so it incorrectly blocked tyre rows. Also tighten the service check to use
-- IS NOT DISTINCT FROM TRUE to avoid NULL ambiguity.

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

  -- A part cannot be from both inventory and an external vendor
  IF NEW.inventory_id IS NOT NULL AND NEW.vendor_id IS NOT NULL THEN
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
