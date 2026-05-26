-- Recurring inspection schedule rules. Drives the "physical" calendar view by
-- generating occurrences for a given month based on cadence (daily/weekly/
-- biweekly/monthly/custom interval) tied to an inspection template.

CREATE TABLE IF NOT EXISTS inspection_schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES inspection_templates(id) ON DELETE SET NULL,
  template_name TEXT,                            -- snapshot label
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_label TEXT,                            -- snapshot registration/fleet
  cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly','biweekly','monthly','custom')),
  interval_days INTEGER,                         -- required when cadence='custom'
  weekday INTEGER CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun..6=Sat (weekly/biweekly)
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28), -- monthly
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_schedule_rules_active
  ON inspection_schedule_rules(active);
CREATE INDEX IF NOT EXISTS idx_inspection_schedule_rules_vehicle
  ON inspection_schedule_rules(vehicle_id);

ALTER TABLE inspection_schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inspection_schedule_rules"
  ON inspection_schedule_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert inspection_schedule_rules"
  ON inspection_schedule_rules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update inspection_schedule_rules"
  ON inspection_schedule_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete inspection_schedule_rules"
  ON inspection_schedule_rules FOR DELETE TO authenticated USING (true);
