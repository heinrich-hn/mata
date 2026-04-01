-- Out-of-commission reports: filed when inspector marks vehicle as NOT safe to operate
CREATE TABLE IF NOT EXISTS out_of_commission_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,

  -- Report metadata
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_time TIME NOT NULL DEFAULT CURRENT_TIME,

  -- Vehicle information (snapshot at time of report)
  vehicle_id_or_license TEXT NOT NULL,
  make_model TEXT,
  year TEXT,
  odometer_hour_meter TEXT,
  location TEXT,

  -- Core report
  reason_out_of_commission TEXT NOT NULL,
  immediate_plan JSONB DEFAULT '[]'::jsonb,        -- text[]
  parts_required JSONB DEFAULT '[]'::jsonb,         -- {partNameNumber, quantity, onHand, orderNeededBy}[]
  additional_notes_safety_concerns TEXT,

  -- Mechanic sign-off
  mechanic_name TEXT NOT NULL,
  mechanic_signature TEXT,
  sign_off_date DATE DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups by inspection
CREATE INDEX IF NOT EXISTS idx_ooc_reports_inspection_id ON out_of_commission_reports(inspection_id);
-- Index for vehicle history
CREATE INDEX IF NOT EXISTS idx_ooc_reports_vehicle_id ON out_of_commission_reports(vehicle_id);

-- Enable RLS
ALTER TABLE out_of_commission_reports ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert
CREATE POLICY "Authenticated users can read out_of_commission_reports"
  ON out_of_commission_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert out_of_commission_reports"
  ON out_of_commission_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update out_of_commission_reports"
  ON out_of_commission_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
