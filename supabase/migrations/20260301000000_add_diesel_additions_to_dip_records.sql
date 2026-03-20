-- Add diesel_additions_liters column to daily_dip_records
-- This tracks diesel added (refills) during an open dip period,
-- so that additions are excluded from gain/loss variance calculations.
--
-- Corrected formula:
--   C (Tank Usage) = A (Opening) - B (Closing) + diesel_additions_liters
--   G (Variance)   = C - F (Pump Issued)

ALTER TABLE public.daily_dip_records
  ADD COLUMN IF NOT EXISTS diesel_additions_liters NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_dip_records.diesel_additions_liters
  IS 'Total diesel added (refilled) to the bunker during this open dip period. Factored into tank usage: C = A - B + additions.';
