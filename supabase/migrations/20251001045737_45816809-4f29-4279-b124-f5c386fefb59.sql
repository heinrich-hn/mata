-- Create tasks table for job card tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create labor entries table
CREATE TABLE public.labor_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  technician_name TEXT NOT NULL,
  description TEXT,
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (hours_worked * hourly_rate) STORED,
  work_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create job card notes table
CREATE TABLE public.job_card_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create job card templates table
CREATE TABLE public.job_card_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_priority TEXT DEFAULT 'medium',
  default_tasks JSONB,
  default_parts JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Allow authenticated users to view tasks"
  ON public.tasks FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage tasks"
  ON public.tasks FOR ALL USING (true);

-- RLS Policies for labor_entries
CREATE POLICY "Allow authenticated users to view labor entries"
  ON public.labor_entries FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage labor entries"
  ON public.labor_entries FOR ALL USING (true);

-- RLS Policies for job_card_notes
CREATE POLICY "Allow authenticated users to view notes"
  ON public.job_card_notes FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage notes"
  ON public.job_card_notes FOR ALL USING (true);

-- RLS Policies for job_card_templates
CREATE POLICY "Allow authenticated users to view templates"
  ON public.job_card_templates FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage templates"
  ON public.job_card_templates FOR ALL USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_entries_updated_at
  BEFORE UPDATE ON public.labor_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_card_notes_updated_at
  BEFORE UPDATE ON public.job_card_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_card_templates_updated_at
  BEFORE UPDATE ON public.job_card_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();