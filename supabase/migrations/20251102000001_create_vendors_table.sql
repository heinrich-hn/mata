-- Create vendors table for supplier management
CREATE TABLE
IF NOT EXISTS public.vendors
(
  id UUID NOT NULL DEFAULT gen_random_uuid
() PRIMARY KEY,
  vendor_id TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  contact_person TEXT,
  work_email TEXT,
  mobile TEXT,
  address TEXT,
  city TEXT,
  master_email TEXT,
  created_at TIMESTAMP
WITH TIME ZONE DEFAULT now
(),
  updated_at TIMESTAMP
WITH TIME ZONE DEFAULT now
()
);

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view vendors"
  ON public.vendors FOR
SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage vendors"
  ON public.vendors FOR ALL
  USING
(auth.role
() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_vendors_updated_at
  BEFORE
UPDATE ON public.vendors
  FOR EACH ROW
EXECUTE
FUNCTION public.update_updated_at_column
();

-- Create indexes for better performance
CREATE INDEX
IF NOT EXISTS idx_vendors_vendor_id ON public.vendors
(vendor_id);
CREATE INDEX
IF NOT EXISTS idx_vendors_vendor_name ON public.vendors
(vendor_name);
CREATE INDEX
IF NOT EXISTS idx_vendors_master_email ON public.vendors
(master_email);

-- Add comment
COMMENT ON TABLE public.vendors IS 'Stores vendor/supplier information for inventory management';
