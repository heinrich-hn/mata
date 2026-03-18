-- Create document_type enum for incident documents
DO $$ BEGIN
  CREATE TYPE incident_document_type AS ENUM (
    'incident_report',
    'police_report',
    'insurance_application',
    'insurance_claim',
    'witness_statement',
    'damage_assessment',
    'repair_quote',
    'medical_report',
    'photo_evidence',
    'video_evidence',
    'correspondence',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create incident_documents table
CREATE TABLE IF NOT EXISTS public.incident_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,

  -- Document information
  document_type incident_document_type NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  description TEXT,

  -- File storage
  file_url TEXT NOT NULL,
  file_path TEXT, -- Storage bucket path
  file_size INTEGER,
  mime_type TEXT,

  -- Metadata
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create incident_timeline table for tracking all events
CREATE TABLE IF NOT EXISTS public.incident_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,

  -- Event information
  event_type TEXT NOT NULL, -- 'created', 'status_change', 'document_added', 'photo_added', 'note_added', 'updated', 'closed', 'claimed'
  event_title TEXT NOT NULL,
  event_description TEXT,

  -- Status tracking (for status_change events)
  old_status TEXT,
  new_status TEXT,

  -- Reference to related document if applicable
  document_id UUID REFERENCES public.incident_documents(id) ON DELETE SET NULL,

  -- Who performed the action
  performed_by TEXT NOT NULL,

  -- Additional metadata as JSON
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on incident_documents
ALTER TABLE public.incident_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view incident documents"
  ON public.incident_documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage incident documents"
  ON public.incident_documents FOR ALL
  USING (auth.role() = 'authenticated');

-- Enable RLS on incident_timeline
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view incident timeline"
  ON public.incident_timeline FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage incident timeline"
  ON public.incident_timeline FOR ALL
  USING (auth.role() = 'authenticated');

-- Add trigger for updated_at on incident_documents
CREATE TRIGGER update_incident_documents_updated_at
  BEFORE UPDATE ON public.incident_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_incident_documents_incident_id ON public.incident_documents(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_documents_document_type ON public.incident_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_id ON public.incident_timeline(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_created_at ON public.incident_timeline(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_timeline;

-- Comments
COMMENT ON TABLE public.incident_documents IS 'Stores documents related to incidents (reports, claims, evidence)';
COMMENT ON TABLE public.incident_timeline IS 'Tracks all events and status changes for incidents';

-- Function to automatically add timeline entry when incident is created
CREATE OR REPLACE FUNCTION add_incident_created_timeline()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.incident_timeline (
    incident_id,
    event_type,
    event_title,
    event_description,
    new_status,
    performed_by
  ) VALUES (
    NEW.id,
    'created',
    'Incident Created',
    'Incident ' || NEW.incident_number || ' was reported',
    NEW.status::text,
    NEW.reported_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_created_timeline
  AFTER INSERT ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION add_incident_created_timeline();

-- Function to automatically add timeline entry when incident status changes
CREATE OR REPLACE FUNCTION add_incident_status_change_timeline()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.incident_timeline (
      incident_id,
      event_type,
      event_title,
      event_description,
      old_status,
      new_status,
      performed_by
    ) VALUES (
      NEW.id,
      'status_change',
      'Status Changed',
      'Status changed from ' || OLD.status::text || ' to ' || NEW.status::text,
      OLD.status::text,
      NEW.status::text,
      COALESCE(NEW.closed_by, 'System')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_status_change_timeline
  AFTER UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION add_incident_status_change_timeline();
