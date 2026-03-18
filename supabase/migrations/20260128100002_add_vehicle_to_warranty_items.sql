-- Add vehicle_id column to warranty_items table
ALTER TABLE warranty_items
ADD COLUMN
IF NOT EXISTS vehicle_id uuid REFERENCES vehicles
(id) ON
DELETE
SET NULL;

-- Create index for vehicle lookups
CREATE INDEX
IF NOT EXISTS idx_warranty_items_vehicle ON warranty_items
(vehicle_id);

-- Drop existing view first to avoid column rename issues
DROP VIEW IF EXISTS warranty_items_status;

-- Recreate the view to include vehicle information
CREATE VIEW warranty_items_status
AS
  SELECT
    wi.*,
    jc.job_number,
    jc.title as job_card_title,
    jc.status as job_card_status,
    inv.name as inventory_name,
    v.fleet_number,
    v.registration_number as vehicle_registration,
    v.make as vehicle_make,
    v.model as vehicle_model,
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
    LEFT JOIN inventory inv ON wi.inventory_id = inv.id
    LEFT JOIN vehicles v ON wi.vehicle_id = v.id;

-- Comment
COMMENT ON COLUMN warranty_items.vehicle_id IS 'Link to the vehicle this warranty item is associated with';
