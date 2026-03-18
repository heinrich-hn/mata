-- Create cost_attachments table
CREATE TABLE IF NOT EXISTS public.cost_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id UUID NOT NULL REFERENCES public.cost_entries(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trip_additional_costs table  
CREATE TABLE IF NOT EXISTS public.trip_additional_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  notes TEXT,
  added_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create additional_cost_documents table
CREATE TABLE IF NOT EXISTS public.additional_cost_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  additional_cost_id UUID NOT NULL REFERENCES public.trip_additional_costs(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.cost_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_additional_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_cost_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cost_attachments
CREATE POLICY "Allow authenticated users to view cost attachments"
ON public.cost_attachments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage cost attachments"
ON public.cost_attachments FOR ALL
TO authenticated
USING (true);

-- Create RLS policies for trip_additional_costs
CREATE POLICY "Allow authenticated users to view additional costs"
ON public.trip_additional_costs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage additional costs"
ON public.trip_additional_costs FOR ALL
TO authenticated
USING (true);

-- Create RLS policies for additional_cost_documents
CREATE POLICY "Allow authenticated users to view additional cost documents"
ON public.additional_cost_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage additional cost documents"
ON public.additional_cost_documents FOR ALL
TO authenticated
USING (true);

-- Create storage bucket for trip documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-documents', 'trip-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for trip-documents bucket
CREATE POLICY "Authenticated users can view trip documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'trip-documents');

CREATE POLICY "Authenticated users can upload trip documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trip-documents');

CREATE POLICY "Authenticated users can update trip documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'trip-documents');

CREATE POLICY "Authenticated users can delete trip documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trip-documents');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cost_attachments_cost_id ON public.cost_attachments(cost_id);
CREATE INDEX IF NOT EXISTS idx_trip_additional_costs_trip_id ON public.trip_additional_costs(trip_id);
CREATE INDEX IF NOT EXISTS idx_additional_cost_documents_cost_id ON public.additional_cost_documents(additional_cost_id);

-- Add triggers for updated_at
CREATE TRIGGER update_cost_attachments_updated_at
BEFORE UPDATE ON public.cost_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trip_additional_costs_updated_at
BEFORE UPDATE ON public.trip_additional_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_additional_cost_documents_updated_at
BEFORE UPDATE ON public.additional_cost_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
