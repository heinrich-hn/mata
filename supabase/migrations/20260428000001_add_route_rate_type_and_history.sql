-- Add rate type / rate amount to route_expense_configs and an audit history table.
-- Lets each predefined route specify whether trip revenue is per load (fixed) or per km,
-- and tracks every rate change for reference.

ALTER TABLE public.route_expense_configs
  ADD COLUMN IF NOT EXISTS rate_type TEXT NOT NULL DEFAULT 'per_load'
    CHECK (rate_type IN ('per_load', 'per_km')),
  ADD COLUMN IF NOT EXISTS rate_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (rate_currency IN ('USD', 'ZAR'));

COMMENT ON COLUMN public.route_expense_configs.rate_type IS
  'How the route''s revenue is charged: per_load (fixed amount) or per_km (rate multiplied by trip distance).';
COMMENT ON COLUMN public.route_expense_configs.rate_amount IS
  'Default rate value: total revenue when per_load, or rate per km when per_km.';
COMMENT ON COLUMN public.route_expense_configs.rate_currency IS
  'Currency for the rate amount (USD or ZAR).';

-- History of every rate change for audit / reference purposes.
CREATE TABLE IF NOT EXISTS public.route_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_config_id UUID NOT NULL REFERENCES public.route_expense_configs(id) ON DELETE CASCADE,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('per_load', 'per_km')),
  rate_amount DECIMAL(12,2) NOT NULL,
  rate_currency TEXT NOT NULL CHECK (rate_currency IN ('USD', 'ZAR')),
  previous_rate_type TEXT,
  previous_rate_amount DECIMAL(12,2),
  previous_rate_currency TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_route_rate_history_config_id
  ON public.route_rate_history(route_config_id);
CREATE INDEX IF NOT EXISTS idx_route_rate_history_changed_at
  ON public.route_rate_history(changed_at DESC);

ALTER TABLE public.route_rate_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read route_rate_history" ON public.route_rate_history;
CREATE POLICY "Allow authenticated read route_rate_history" ON public.route_rate_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert route_rate_history" ON public.route_rate_history;
CREATE POLICY "Allow authenticated insert route_rate_history" ON public.route_rate_history
  FOR INSERT TO authenticated WITH CHECK (true);
