-- Create storage bucket for incident documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-documents',
  'incident-documents',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for incident images (photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-images',
  'incident-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for incident-documents bucket
CREATE POLICY "Allow authenticated users to upload incident documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'incident-documents');

CREATE POLICY "Allow authenticated users to read incident documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'incident-documents');

CREATE POLICY "Allow authenticated users to update incident documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'incident-documents');

CREATE POLICY "Allow authenticated users to delete incident documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'incident-documents');

-- RLS Policies for incident-images bucket
CREATE POLICY "Allow authenticated users to upload incident images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'incident-images');

CREATE POLICY "Allow authenticated users to read incident images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'incident-images');

CREATE POLICY "Allow authenticated users to update incident images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'incident-images');

CREATE POLICY "Allow authenticated users to delete incident images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'incident-images');

-- Allow public access to view incident documents and images (for public URLs)
CREATE POLICY "Allow public read access to incident documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'incident-documents');

CREATE POLICY "Allow public read access to incident images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'incident-images');
