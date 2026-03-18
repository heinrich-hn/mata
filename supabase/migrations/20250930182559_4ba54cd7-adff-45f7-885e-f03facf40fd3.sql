-- Add new columns to tyre_inventory table
ALTER TABLE tyre_inventory
ADD COLUMN IF NOT EXISTS dot_code text,
ADD COLUMN IF NOT EXISTS pressure_rating numeric,
ADD COLUMN IF NOT EXISTS initial_tread_depth numeric,
ADD COLUMN IF NOT EXISTS purchase_cost_zar numeric,
ADD COLUMN IF NOT EXISTS purchase_cost_usd numeric,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
ADD COLUMN IF NOT EXISTS vendor text;

-- Create enum-like constraints for location
ALTER TABLE tyre_inventory DROP CONSTRAINT IF EXISTS tyre_inventory_location_check;
ALTER TABLE tyre_inventory 
ADD CONSTRAINT tyre_inventory_location_check 
CHECK (location IN ('scrap-store', 'holding-bay', 'retread-bay', 'main-warehouse', 'service-bay'));

-- Create enum-like constraints for status
ALTER TABLE tyre_inventory DROP CONSTRAINT IF EXISTS tyre_inventory_status_check;
ALTER TABLE tyre_inventory 
ADD CONSTRAINT tyre_inventory_status_check 
CHECK (status IN ('new', 'used', 'refurbished', 'scrap', 'in-service'));

-- Update type field to include seasonal types
ALTER TABLE tyre_inventory DROP CONSTRAINT IF EXISTS tyre_inventory_type_check;
ALTER TABLE tyre_inventory 
ADD CONSTRAINT tyre_inventory_type_check 
CHECK (type IN ('Steer', 'Drive', 'Trailer', 'All Position', 'summer', 'winter', 'all-season', 'off-road'));