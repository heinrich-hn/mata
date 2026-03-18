-- Add vendor_id FK to inventory table
-- Allows inventory items to be formally linked to a vendor in the vendors table
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

COMMENT ON COLUMN inventory.vendor_id IS
  'Optional link to the preferred/primary vendor for this inventory item. '
  'The free-text supplier column is retained for legacy display.';
