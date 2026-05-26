-- Allow out-of-commission reports to be explicitly closed when the vehicle
-- has been repaired and is back in service. Closed reports stay in history
-- (visible on the Closed tab / reports) but disappear from the active list.

ALTER TABLE out_of_commission_reports
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by TEXT,
  ADD COLUMN IF NOT EXISTS closure_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_ooc_reports_closed_at
  ON out_of_commission_reports(closed_at);
