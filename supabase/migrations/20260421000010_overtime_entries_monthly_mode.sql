-- Add a monthly-total entry mode to overtime_entries.
-- Existing rows are per-shift entries (with date + start/end times + link).
-- Monthly entries store a YYYY-MM month and the total hours, no shift times or link required.

ALTER TABLE public.overtime_entries
  ADD COLUMN IF NOT EXISTS entry_mode TEXT NOT NULL DEFAULT 'shift'
    CHECK (entry_mode IN ('shift', 'monthly'));

ALTER TABLE public.overtime_entries
  ADD COLUMN IF NOT EXISTS month TEXT; -- format: 'YYYY-MM'

-- Relax NOT NULL constraints so monthly entries can omit shift fields.
ALTER TABLE public.overtime_entries ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.overtime_entries ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE public.overtime_entries ALTER COLUMN link_type DROP NOT NULL;

-- Replace the link_type CHECK so it allows NULL for monthly entries.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'overtime_entries_link_type_check'
      AND conrelid = 'public.overtime_entries'::regclass
  ) THEN
    ALTER TABLE public.overtime_entries DROP CONSTRAINT overtime_entries_link_type_check;
  END IF;
END $$;

ALTER TABLE public.overtime_entries
  ADD CONSTRAINT overtime_entries_link_type_check
  CHECK (link_type IS NULL OR link_type IN ('job_card', 'breakdown', 'incident', 'other'));

-- Sanity: a monthly entry must have a month value; a shift entry must have shift fields.
ALTER TABLE public.overtime_entries
  ADD CONSTRAINT overtime_entries_mode_fields_check
  CHECK (
    (entry_mode = 'monthly' AND month IS NOT NULL)
    OR
    (entry_mode = 'shift' AND start_time IS NOT NULL AND end_time IS NOT NULL AND link_type IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_overtime_entries_month ON public.overtime_entries(month);
