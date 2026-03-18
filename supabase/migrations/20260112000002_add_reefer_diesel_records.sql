-- Migration: Add reefer diesel records table
-- Reefers consume diesel measured in litres per hour (L/hr), not km/L like trucks
-- Reefer diesel can be linked to a truck diesel transaction for cost allocation

CREATE TABLE IF NOT EXISTS reefer_diesel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reefer identification (4F, 5F, 6F, 7F, 8F, 9F)
  reefer_unit VARCHAR(10) NOT NULL,

  -- Fill-up details
  date DATE NOT NULL,
  fuel_station VARCHAR(255) NOT NULL,
  litres_filled NUMERIC(10, 2) NOT NULL,
  cost_per_litre NUMERIC(10, 4),
  total_cost NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ZAR',

  -- Operating hours tracking for L/hr calculation
  operating_hours NUMERIC(10, 2),
  previous_operating_hours NUMERIC(10, 2),
  hours_operated NUMERIC(10, 2), -- Calculated: operating_hours - previous_operating_hours
  litres_per_hour NUMERIC(10, 4), -- Calculated: litres_filled / hours_operated

  -- Linking to truck diesel transaction for cost allocation
  linked_diesel_record_id UUID REFERENCES diesel_records(id),

  -- Driver/operator info
  driver_name VARCHAR(255),

  -- Additional metadata
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_reefer_diesel_reefer_unit ON reefer_diesel_records(reefer_unit);
CREATE INDEX idx_reefer_diesel_date ON reefer_diesel_records(date);
CREATE INDEX idx_reefer_diesel_linked_diesel ON reefer_diesel_records(linked_diesel_record_id);

-- Add comments for documentation
COMMENT ON TABLE reefer_diesel_records IS 'Diesel consumption records for reefer units (4F-9F), tracked in litres per hour';
COMMENT ON COLUMN reefer_diesel_records.reefer_unit IS 'Reefer unit identifier (4F, 5F, 6F, 7F, 8F, 9F)';
COMMENT ON COLUMN reefer_diesel_records.operating_hours IS 'Current hour meter reading at fill-up';
COMMENT ON COLUMN reefer_diesel_records.previous_operating_hours IS 'Hour meter reading from previous fill-up';
COMMENT ON COLUMN reefer_diesel_records.hours_operated IS 'Hours operated since last fill-up (calculated)';
COMMENT ON COLUMN reefer_diesel_records.litres_per_hour IS 'Fuel consumption rate in L/hr (calculated)';
COMMENT ON COLUMN reefer_diesel_records.linked_diesel_record_id IS 'Reference to the truck diesel transaction this reefer fill was linked to';

-- Trigger to auto-calculate hours_operated and litres_per_hour
CREATE OR REPLACE FUNCTION calculate_reefer_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate hours operated
  IF NEW.operating_hours IS NOT NULL AND NEW.previous_operating_hours IS NOT NULL THEN
    NEW.hours_operated := NEW.operating_hours - NEW.previous_operating_hours;
  END IF;

  -- Calculate litres per hour
  IF NEW.hours_operated IS NOT NULL AND NEW.hours_operated > 0 AND NEW.litres_filled > 0 THEN
    NEW.litres_per_hour := NEW.litres_filled / NEW.hours_operated;
  END IF;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_reefer_consumption
  BEFORE INSERT OR UPDATE OF operating_hours, previous_operating_hours, litres_filled
  ON reefer_diesel_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_reefer_consumption();

-- Enable Row Level Security
ALTER TABLE reefer_diesel_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy for authenticated users
CREATE POLICY "Allow authenticated users to manage reefer diesel records"
  ON reefer_diesel_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- View for reefer consumption reporting (separate from truck consumption)
CREATE OR REPLACE VIEW reefer_consumption_summary AS
SELECT
  reefer_unit,
  COUNT(*) as fill_count,
  SUM(litres_filled) as total_litres,
  SUM(total_cost) as total_cost,
  SUM(hours_operated) as total_hours,
  AVG(litres_per_hour) as avg_litres_per_hour,
  MIN(date) as first_fill_date,
  MAX(date) as last_fill_date
FROM reefer_diesel_records
GROUP BY reefer_unit;

-- View for reefer consumption by linked truck diesel transaction
CREATE OR REPLACE VIEW reefer_consumption_by_truck AS
SELECT
  d.fleet_number as truck_fleet_number,
  d.driver_name as truck_driver,
  d.date as truck_fill_date,
  r.reefer_unit,
  r.litres_filled as reefer_litres,
  r.total_cost as reefer_cost,
  r.litres_per_hour as reefer_lph,
  d.litres_filled as truck_litres,
  d.total_cost as truck_cost,
  (d.total_cost + r.total_cost) as combined_cost
FROM reefer_diesel_records r
JOIN diesel_records d ON r.linked_diesel_record_id = d.id
WHERE r.linked_diesel_record_id IS NOT NULL;
