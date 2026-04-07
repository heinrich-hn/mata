-- Create client_documents table for storing documents shared with clients
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow authenticated read access on client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "Allow authenticated insert access on client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "Allow authenticated update access on client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "Allow authenticated delete access on client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "Allow anon read access on client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "Allow anon insert access on client_documents" ON public.client_documents;
DROP POLICY IF EXISTS "Allow service role full access on client_documents" ON public.client_documents;

-- Authenticated users: full CRUD
CREATE POLICY "Allow authenticated read access on client_documents"
  ON public.client_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert access on client_documents"
  ON public.client_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update access on client_documents"
  ON public.client_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access on client_documents"
  ON public.client_documents FOR DELETE TO authenticated USING (true);

-- Anonymous users (portal): read and upload scoped to client_id
CREATE POLICY "Allow anon read access on client_documents"
  ON public.client_documents FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert access on client_documents"
  ON public.client_documents FOR INSERT TO anon WITH CHECK (true);

-- Service role: full access
CREATE POLICY "Allow service role full access on client_documents"
  ON public.client_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_load_id ON public.client_documents(load_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_category ON public.client_documents(category);
