-- Add archived_at column to job_cards for soft archive support.
-- Lists filter on archived_at IS NULL by default; an "Archived" tab shows the rest.

ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS job_cards_archived_at_idx
  ON public.job_cards (archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.job_cards.archived_at IS
  'Timestamp when the job card was archived. NULL = active. Soft archive: row is preserved but hidden from default views.';
