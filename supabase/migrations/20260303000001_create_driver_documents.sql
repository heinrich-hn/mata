-- Migration: Create driver_documents table and storage bucket
-- Supports: License, PDP, Passport, Medicals, Retest, Defensive Driving documents

-- Create document type enum for driver documents
DO $$ BEGIN
  CREATE TYPE driver_document_type AS ENUM (
    'license',
    'pdp',
    'passport',
    'medical',
    'retest',
    'defensive_driving'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create driver_documents table
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,

  -- Document information
  document_type driver_document_type NOT NULL,
  document_number TEXT,
  expiry_date DATE,

  -- File storage
  file_url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,

  -- Metadata
  uploaded_by TEXT,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON public.driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_type ON public.driver_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_driver_documents_expiry ON public.driver_documents(expiry_date);

-- Unique constraint: one document per type per driver
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_documents_unique_type
  ON public.driver_documents(driver_id, document_type);

-- Enable RLS
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read driver documents"
ON public.driver_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert driver documents"
ON public.driver_documents FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update driver documents"
ON public.driver_documents FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete driver documents"
ON public.driver_documents FOR DELETE
TO authenticated
USING (true);

-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-documents',
  'driver-documents',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for driver-documents bucket
CREATE POLICY "Allow authenticated users to upload driver documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "Allow authenticated users to read driver documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'driver-documents');

CREATE POLICY "Allow authenticated users to update driver documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'driver-documents');

CREATE POLICY "Allow authenticated users to delete driver documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'driver-documents');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_driver_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_documents_updated_at
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_documents_updated_at();
