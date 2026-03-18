-- Create storage bucket for inspection photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for inspection photos bucket
CREATE POLICY "Users can view inspection photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'inspection-photos');

CREATE POLICY "Users can upload inspection photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Users can delete their own inspection photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'inspection-photos');