-- Create tyre_lifecycle_events table
CREATE TABLE tyre_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tyre_id UUID REFERENCES tyres(id) NOT NULL,
  tyre_code TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN (
    'purchased', 'received', 'inspected', 'installed', 
    'rotated', 'removed', 'refurbished', 'disposed'
  )),
  vehicle_id UUID REFERENCES vehicles(id),
  fleet_position TEXT,
  km_reading INTEGER,
  tread_depth_at_event NUMERIC,
  pressure_at_event NUMERIC,
  performed_by TEXT,
  event_date TIMESTAMPTZ DEFAULT now(),
  cost_associated NUMERIC,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE tyre_lifecycle_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view tyre lifecycle" 
  ON tyre_lifecycle_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tyre lifecycle" 
  ON tyre_lifecycle_events FOR ALL TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX idx_lifecycle_tyre ON tyre_lifecycle_events(tyre_id);
CREATE INDEX idx_lifecycle_vehicle ON tyre_lifecycle_events(vehicle_id);
CREATE INDEX idx_lifecycle_date ON tyre_lifecycle_events(event_date);
CREATE INDEX idx_lifecycle_event_type ON tyre_lifecycle_events(event_type);

-- Create fleet_position_analytics view
CREATE OR REPLACE VIEW fleet_position_analytics AS
SELECT 
  v.fleet_number,
  v.registration_number,
  tph.fleet_position as position,
  COUNT(DISTINCT tph.tyre_id) as tyres_used,
  AVG(CASE WHEN t.km_travelled > 0 THEN t.km_travelled ELSE NULL END) as avg_km_per_tyre,
  COUNT(CASE WHEN tph.action = 'removed' THEN 1 END) as removal_count,
  MAX(tph.performed_at) as last_change_date
FROM tyre_position_history tph
JOIN vehicles v ON v.id = tph.vehicle_id
LEFT JOIN tyres t ON t.id = tph.tyre_id
GROUP BY v.fleet_number, v.registration_number, tph.fleet_position;