-- Remove the inventory/vendor mutual-exclusion rule from validate_parts_request.
--
-- Rationale:
--   * Replenishment requests need both inventory_id (which SKU to top up) and
--     vendor_id (who to buy from).
--   * Job-card parts may also need both: inventory_id identifies the matching
--     stock SKU for cost tracking while vendor_id records where the part was
--     sourced when stock ran out. Updates such as marking a request "received"
--     or "allocated" set additional fields and re-trigger validation, which
--     was failing on these legitimate combinations.
--
-- The cost-rollup view (job_card_costs_summary) already classifies parts by
-- whether inventory_id is null — it does not need the mutually-exclusive
-- guarantee. Dropping the rule unblocks the full procurement workflow.

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

  -- Service items must have a description
  IF (NEW.is_service IS DISTINCT FROM FALSE)
     AND (NEW.is_service IS NOT DISTINCT FROM TRUE)
     AND (NEW.service_description IS NULL OR NEW.service_description = '') THEN
    RAISE EXCEPTION 'Service items must have a service_description';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
