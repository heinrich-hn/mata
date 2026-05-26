-- Link scheduled_inspections to inspection_templates so planners can pick a form
ALTER TABLE public.scheduled_inspections
    ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.inspection_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS template_name text;

CREATE INDEX IF NOT EXISTS idx_scheduled_inspections_template_id
    ON public.scheduled_inspections(template_id);
