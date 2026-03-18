-- Create standalone warranty_items table for manual warranty tracking
CREATE TABLE IF NOT EXISTS warranty_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  part_number varchar(100),
  serial_number varchar(100),
  category varchar(100),
  description text,

  -- Warranty details
  warranty_provider varchar(255),
  warranty_period_months integer,
  warranty_start_date date,
  warranty_end_date date,
  warranty_terms text,
  warranty_claim_contact varchar(255),
  warranty_notes text,

  -- Purchase/Procurement details
  purchase_date date,
  purchase_price numeric(12, 2),
  supplier varchar(255),
  invoice_number varchar(100),

  -- Job Card linking
  job_card_id uuid REFERENCES job_cards(id) ON DELETE SET NULL,

  -- Inventory linking (optional - if item came from inventory)
  inventory_id uuid REFERENCES inventory(id) ON DELETE SET NULL,

  -- Status
  status varchar(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'claimed', 'void')),
  claim_date date,
  claim_notes text,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warranty_items_job_card ON warranty_items(job_card_id);
CREATE INDEX IF NOT EXISTS idx_warranty_items_inventory ON warranty_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_warranty_items_status ON warranty_items(status);
CREATE INDEX IF NOT EXISTS idx_warranty_items_end_date ON warranty_items(warranty_end_date);

-- Enable RLS
ALTER TABLE warranty_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow authenticated users to view warranty_items"
  ON warranty_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert warranty_items"
  ON warranty_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update warranty_items"
  ON warranty_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete warranty_items"
  ON warranty_items FOR DELETE
  TO authenticated
  USING (true);

-- Create view for warranty status overview
CREATE OR REPLACE VIEW warranty_items_status AS
SELECT
  wi.*,
  jc.job_number,
  jc.title as job_card_title,
  jc.status as job_card_status,
  inv.name as inventory_name,
  CASE
    WHEN wi.status = 'claimed' THEN 'claimed'
    WHEN wi.status = 'void' THEN 'void'
    WHEN wi.warranty_end_date IS NULL THEN 'unknown'
    WHEN wi.warranty_end_date < CURRENT_DATE THEN 'expired'
    WHEN wi.warranty_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'active'
  END AS warranty_status,
  CASE
    WHEN wi.warranty_end_date IS NOT NULL THEN
      wi.warranty_end_date - CURRENT_DATE
    ELSE NULL
  END AS days_until_expiry
FROM warranty_items wi
LEFT JOIN job_cards jc ON wi.job_card_id = jc.id
LEFT JOIN inventory inv ON wi.inventory_id = inv.id;

-- Comments
COMMENT ON TABLE warranty_items IS 'Standalone table for tracking warranty on procured parts and items';
COMMENT ON COLUMN warranty_items.job_card_id IS 'Link to the job card where this item was used/installed';
COMMENT ON COLUMN warranty_items.inventory_id IS 'Optional link to inventory if item came from stock';
COMMENT ON COLUMN warranty_items.status IS 'Current warranty status: active, expired, claimed, or void';
