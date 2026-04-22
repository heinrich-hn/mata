CREATE TABLE IF NOT EXISTS public.driver_disciplinary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'other',
  title TEXT,
  reason TEXT NOT NULL,
  description TEXT,
  outcome TEXT,
  status TEXT NOT NULL DEFAULT 'inquiry_logged',
  follow_up_date DATE,
  issued_by TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns that may not exist on older versions of the table
ALTER TABLE public.driver_disciplinary ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.driver_disciplinary ADD COLUMN IF NOT EXISTS hearing_date DATE;
ALTER TABLE public.driver_disciplinary ADD COLUMN IF NOT EXISTS hearing_time TEXT;
ALTER TABLE public.driver_disciplinary ADD COLUMN IF NOT EXISTS hearing_venue TEXT;
ALTER TABLE public.driver_disciplinary ADD COLUMN IF NOT EXISTS hearing_chairperson TEXT;
ALTER TABLE public.driver_disciplinary ADD COLUMN IF NOT EXISTS outcome_date DATE;
ALTER TABLE public.driver_disciplinary ADD COLUMN IF NOT EXISTS sanction TEXT;

-- Replace status & category constraints for the 3-stage workflow
ALTER TABLE public.driver_disciplinary DROP CONSTRAINT IF EXISTS driver_disciplinary_status_check;
ALTER TABLE public.driver_disciplinary ADD CONSTRAINT driver_disciplinary_status_check
  CHECK (status IN (
    'inquiry_logged', 'hearing_scheduled', 'outcome_recorded',
    'appeal', 'dismissed', 'resolved',
    -- legacy compat
    'open', 'escalated', 'hearing_held'
  ));

ALTER TABLE public.driver_disciplinary DROP CONSTRAINT IF EXISTS driver_disciplinary_category_check;
ALTER TABLE public.driver_disciplinary ADD CONSTRAINT driver_disciplinary_category_check
  CHECK (category IN (
    'verbal_warning', 'written_warning', 'final_warning',
    'suspension', 'dismissal', 'counselling', 'other'
  ));

ALTER TABLE public.driver_disciplinary ALTER COLUMN status SET DEFAULT 'inquiry_logged';

CREATE INDEX IF NOT EXISTS idx_driver_disciplinary_driver ON public.driver_disciplinary(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_disciplinary_status ON public.driver_disciplinary(status);

ALTER TABLE public.driver_disciplinary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users manage driver_disciplinary" ON public.driver_disciplinary;
CREATE POLICY "Auth users manage driver_disciplinary" ON public.driver_disciplinary FOR ALL USING (true);

CREATE OR REPLACE TRIGGER update_driver_disciplinary_updated_at
  BEFORE UPDATE ON public.driver_disciplinary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
