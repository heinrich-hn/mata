-- Scheduled inspections: simple calendar planning for upcoming vehicle inspections
CREATE TABLE IF NOT EXISTS scheduled_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_label TEXT,                          -- snapshot of registration / fleet # for display
  scheduled_date DATE NOT NULL,
  inspection_type TEXT,                        -- e.g. 'pre-trip', 'monthly', 'service'
  notes TEXT,
  created_by TEXT,
  completed_at TIMESTAMPTZ,
  completed_inspection_id UUID REFERENCES vehicle_inspections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_inspections_date
  ON scheduled_inspections(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_inspections_vehicle
  ON scheduled_inspections(vehicle_id);

ALTER TABLE scheduled_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scheduled_inspections"
  ON scheduled_inspections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert scheduled_inspections"
  ON scheduled_inspections FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update scheduled_inspections"
  ON scheduled_inspections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete scheduled_inspections"
  ON scheduled_inspections FOR DELETE TO authenticated USING (true);
