-- Add warranty fields to inventory table
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS has_warranty boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS warranty_period_months integer,
ADD COLUMN IF NOT EXISTS warranty_start_date date,
ADD COLUMN IF NOT EXISTS warranty_end_date date,
ADD COLUMN IF NOT EXISTS warranty_provider varchar(255),
ADD COLUMN IF NOT EXISTS warranty_terms text,
ADD COLUMN IF NOT EXISTS warranty_claim_contact varchar(255),
ADD COLUMN IF NOT EXISTS warranty_notes text;

-- Create index for warranty expiry queries
CREATE INDEX IF NOT EXISTS idx_inventory_warranty_end_date ON inventory(warranty_end_date) WHERE has_warranty = true;

-- Create a view for warranty tracking
CREATE OR REPLACE VIEW inventory_warranty_status AS
SELECT
  id,
  name,
  part_number,
  category,
  supplier,
  has_warranty,
  warranty_period_months,
  warranty_start_date,
  warranty_end_date,
  warranty_provider,
  warranty_terms,
  warranty_claim_contact,
  warranty_notes,
  quantity,
  unit_price,
  CASE
    WHEN has_warranty = false OR warranty_end_date IS NULL THEN 'no_warranty'
    WHEN warranty_end_date < CURRENT_DATE THEN 'expired'
    WHEN warranty_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'active'
  END AS warranty_status,
  CASE
    WHEN warranty_end_date IS NOT NULL THEN
      warranty_end_date - CURRENT_DATE
    ELSE NULL
  END AS days_until_expiry
FROM inventory
WHERE has_warranty = true;

COMMENT ON COLUMN inventory.has_warranty IS 'Whether this inventory item has warranty coverage';
COMMENT ON COLUMN inventory.warranty_period_months IS 'Warranty duration in months';
COMMENT ON COLUMN inventory.warranty_start_date IS 'Date when warranty coverage started';
COMMENT ON COLUMN inventory.warranty_end_date IS 'Date when warranty coverage expires';
COMMENT ON COLUMN inventory.warranty_provider IS 'Company or vendor providing the warranty';
COMMENT ON COLUMN inventory.warranty_terms IS 'Warranty terms and conditions';
COMMENT ON COLUMN inventory.warranty_claim_contact IS 'Contact information for warranty claims';
COMMENT ON COLUMN inventory.warranty_notes IS 'Additional notes about the warranty';
