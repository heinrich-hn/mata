-- Create inventory table for workshop parts
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  part_number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 5,
  unit_price NUMERIC(10, 2),
  location TEXT,
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view inventory"
  ON public.inventory FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage inventory"
  ON public.inventory FOR ALL
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create job_cards table
CREATE TABLE IF NOT EXISTS public.job_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id),
  assignee TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view job cards"
  ON public.job_cards FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage job cards"
  ON public.job_cards FOR ALL
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_job_cards_updated_at
  BEFORE UPDATE ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create parts_requests table
CREATE TABLE IF NOT EXISTS public.parts_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_name TEXT NOT NULL,
  part_number TEXT,
  quantity INTEGER NOT NULL,
  job_card_id UUID REFERENCES public.job_cards(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parts_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view parts requests"
  ON public.parts_requests FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage parts requests"
  ON public.parts_requests FOR ALL
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_parts_requests_updated_at
  BEFORE UPDATE ON public.parts_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();