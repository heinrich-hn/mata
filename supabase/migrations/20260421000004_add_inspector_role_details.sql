-- Add job title, responsibilities, and skills to inspector_profiles
-- Allows users to capture richer role info per inspector and edit it over time.

ALTER TABLE public.inspector_profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS responsibilities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN public.inspector_profiles.job_title IS 'Inspector job title / role label (e.g. Senior Workshop Inspector).';
COMMENT ON COLUMN public.inspector_profiles.responsibilities IS 'Free-form list of responsibilities assigned to this inspector.';
COMMENT ON COLUMN public.inspector_profiles.skills IS 'Free-form list of skills / certifications held by this inspector.';

CREATE INDEX IF NOT EXISTS idx_inspector_profiles_job_title
  ON public.inspector_profiles(job_title);
