-- Overtime approval entries
-- Workers (drivers or workshop staff) submit overtime entries that link to a job card or fleet breakdown.
-- Approvers can mark each entry approved/rejected.

CREATE TABLE IF NOT EXISTS public.overtime_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who worked the overtime (must be an inspector profile)
  inspector_id UUID NOT NULL REFERENCES public.inspector_profiles(id) ON DELETE RESTRICT,
  inspector_name TEXT NOT NULL,

  -- When
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hours NUMERIC(5, 2),

  -- What this overtime is for
  link_type TEXT NOT NULL CHECK (link_type IN ('job_card', 'breakdown', 'incident', 'other')),
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
  breakdown_id UUID REFERENCES public.fleet_breakdowns(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,

  reason TEXT,
  notes TEXT,

  -- Approval lifecycle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overtime_entries_date ON public.overtime_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_overtime_entries_status ON public.overtime_entries(status);
CREATE INDEX IF NOT EXISTS idx_overtime_entries_inspector_id ON public.overtime_entries(inspector_id);
CREATE INDEX IF NOT EXISTS idx_overtime_entries_job_card_id ON public.overtime_entries(job_card_id);
CREATE INDEX IF NOT EXISTS idx_overtime_entries_breakdown_id ON public.overtime_entries(breakdown_id);

CREATE OR REPLACE FUNCTION public.overtime_entries_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_overtime_entries_set_updated_at ON public.overtime_entries;
CREATE TRIGGER trg_overtime_entries_set_updated_at
  BEFORE UPDATE ON public.overtime_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.overtime_entries_set_updated_at();

ALTER TABLE public.overtime_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overtime_entries_select_authenticated"
  ON public.overtime_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "overtime_entries_insert_authenticated"
  ON public.overtime_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "overtime_entries_update_authenticated"
  ON public.overtime_entries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "overtime_entries_delete_authenticated"
  ON public.overtime_entries FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE public.overtime_entries IS 'Overtime work entries by inspectors (not drivers) linking to a job card, breakdown, or incident; subject to approval.';
