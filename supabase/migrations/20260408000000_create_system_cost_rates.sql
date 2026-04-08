-- Create system_cost_rates table for persistent, auditable operational cost rates
-- Append-only design: rate changes insert new rows with new effective_date for full audit trail

CREATE TABLE IF NOT EXISTS system_cost_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('per_km', 'per_day')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  display_name TEXT NOT NULL,
  effective_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  notes TEXT
);

-- Unique constraint: one rate per key per effective date
ALTER TABLE system_cost_rates
  ADD CONSTRAINT uq_system_cost_rates_key_date UNIQUE (rate_key, effective_date);

-- Index for efficient lookups of current rates
CREATE INDEX idx_system_cost_rates_active ON system_cost_rates (rate_key, effective_date DESC) WHERE is_active = true;

-- Enable RLS
ALTER TABLE system_cost_rates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read system_cost_rates"
  ON system_cost_rates FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert (rate adjustments)
CREATE POLICY "Authenticated users can insert system_cost_rates"
  ON system_cost_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update (deactivate old rates)
CREATE POLICY "Authenticated users can update system_cost_rates"
  ON system_cost_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed with default USD rates from costCategories.ts DEFAULT_SYSTEM_COST_RATES
INSERT INTO system_cost_rates (rate_key, rate_type, amount, display_name, effective_date, created_by, notes) VALUES
  ('repair_maintenance', 'per_km', 0.11, 'Repair & Maintenance per KM', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('tyre_cost', 'per_km', 0.03, 'Tyre Cost per KM', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('git_insurance', 'per_day', 10.21, 'GIT Insurance', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('short_term_insurance', 'per_day', 7.58, 'Short-Term Insurance', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('tracking_cost', 'per_day', 2.47, 'Tracking Cost', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('fleet_management_system', 'per_day', 1.34, 'Fleet Management System', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('licensing', 'per_day', 1.32, 'Licensing', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('vid_roadworthy', 'per_day', 0.41, 'VID / Roadworthy', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('wages', 'per_day', 16.88, 'Wages', '2025-01-01', 'System Default', 'Initial seed from system defaults'),
  ('depreciation', 'per_day', 321.17, 'Depreciation', '2025-01-01', 'System Default', 'Initial seed from system defaults');
