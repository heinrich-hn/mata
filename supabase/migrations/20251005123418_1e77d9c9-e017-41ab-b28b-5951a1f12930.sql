-- Link inspection faults to job_cards instead of work_orders
-- Add job_card_id to inspection_faults
ALTER TABLE public.inspection_faults 
ADD COLUMN job_card_id uuid REFERENCES public.job_cards(id) ON DELETE SET NULL;

-- Add inspection_id to job_cards to track which inspection created the job
ALTER TABLE public.job_cards
ADD COLUMN inspection_id uuid REFERENCES public.vehicle_inspections(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_inspection_faults_job_card ON public.inspection_faults(job_card_id);
CREATE INDEX idx_job_cards_inspection ON public.job_cards(inspection_id);

-- Add corrective action fields to inspection_faults
ALTER TABLE public.inspection_faults
ADD COLUMN corrective_action_status text CHECK (corrective_action_status IN ('pending', 'fixed', 'not_fixed', 'no_need')),
ADD COLUMN corrective_action_notes text,
ADD COLUMN corrective_action_date timestamptz,
ADD COLUMN corrective_action_by text;

-- Add vehicle search columns to inspections for easier querying
ALTER TABLE public.vehicle_inspections
ADD COLUMN vehicle_registration text,
ADD COLUMN vehicle_make text,
ADD COLUMN vehicle_model text;

-- Update RLS policies for new relationships
CREATE POLICY "Users can view job cards linked to inspections"
ON public.job_cards
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update corrective actions on inspection faults"
ON public.inspection_faults
FOR UPDATE
TO authenticated
USING (true);

COMMENT ON COLUMN public.inspection_faults.job_card_id IS 'Links fault to the job card created to fix it';
COMMENT ON COLUMN public.job_cards.inspection_id IS 'Links job card back to the inspection that identified the work';
COMMENT ON COLUMN public.inspection_faults.corrective_action_status IS 'Final status after work: pending, fixed, not_fixed, or no_need';