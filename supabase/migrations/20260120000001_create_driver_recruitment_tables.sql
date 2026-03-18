-- Migration: Create HR Driver Recruitment Tables
-- Description: Creates tables for managing driver candidates through a three-step evaluation process
-- Date: 2026-01-20

-- Create enum types for recruitment statuses
DO $$ BEGIN
    CREATE TYPE evaluation_step AS ENUM ('interview', 'yard_test', 'road_test');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE evaluation_status AS ENUM ('pending', 'passed', 'failed', 'scheduled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE candidate_status AS ENUM ('new', 'in_progress', 'hired', 'rejected', 'withdrawn');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create driver_candidates table
CREATE TABLE IF NOT EXISTS driver_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    license_number TEXT NOT NULL,
    license_class TEXT NOT NULL,
    license_expiry DATE NOT NULL,
    years_experience INTEGER DEFAULT 0,
    previous_employer TEXT,
    address TEXT,
    city TEXT,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status candidate_status NOT NULL DEFAULT 'new',
    current_step evaluation_step NOT NULL DEFAULT 'interview',
    interview_result JSONB,
    yard_test_result JSONB,
    road_test_result JSONB,
    cv_file_path TEXT,
    cv_file_name TEXT,
    cv_file_type TEXT,
    cv_uploaded_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_candidates_status ON driver_candidates(status);
CREATE INDEX IF NOT EXISTS idx_driver_candidates_current_step ON driver_candidates(current_step);
CREATE INDEX IF NOT EXISTS idx_driver_candidates_candidate_number ON driver_candidates(candidate_number);
CREATE INDEX IF NOT EXISTS idx_driver_candidates_license_number ON driver_candidates(license_number);

-- Create function to generate candidate number
CREATE OR REPLACE FUNCTION generate_candidate_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    next_num INTEGER;
BEGIN
    year_prefix := 'CND-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-';

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(candidate_number FROM 'CND-\d{4}-(\d+)') AS INTEGER)
    ), 0) + 1
    INTO next_num
    FROM driver_candidates
    WHERE candidate_number LIKE year_prefix || '%';

    NEW.candidate_number := year_prefix || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate candidate number
DROP TRIGGER IF EXISTS trigger_generate_candidate_number ON driver_candidates;
CREATE TRIGGER trigger_generate_candidate_number
    BEFORE INSERT ON driver_candidates
    FOR EACH ROW
    WHEN (NEW.candidate_number IS NULL OR NEW.candidate_number = '')
    EXECUTE FUNCTION generate_candidate_number();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_driver_candidates_updated_at ON driver_candidates;
CREATE TRIGGER trigger_update_driver_candidates_updated_at
    BEFORE UPDATE ON driver_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_candidates_updated_at();

-- Create evaluation history table for audit trail
CREATE TABLE IF NOT EXISTS candidate_evaluation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES driver_candidates(id) ON DELETE CASCADE,
    evaluation_step evaluation_step NOT NULL,
    previous_status evaluation_status,
    new_status evaluation_status NOT NULL,
    evaluator_name TEXT,
    score INTEGER,
    notes TEXT,
    feedback TEXT,
    scheduled_date DATE,
    completed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create index for evaluation history
CREATE INDEX IF NOT EXISTS idx_evaluation_history_candidate_id ON candidate_evaluation_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_history_step ON candidate_evaluation_history(evaluation_step);

-- Enable Row Level Security
ALTER TABLE driver_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_evaluation_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for driver_candidates
DROP POLICY IF EXISTS "Authenticated users can view driver candidates" ON driver_candidates;
CREATE POLICY "Authenticated users can view driver candidates"
    ON driver_candidates FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert driver candidates" ON driver_candidates;
CREATE POLICY "Authenticated users can insert driver candidates"
    ON driver_candidates FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update driver candidates" ON driver_candidates;
CREATE POLICY "Authenticated users can update driver candidates"
    ON driver_candidates FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete driver candidates" ON driver_candidates;
CREATE POLICY "Authenticated users can delete driver candidates"
    ON driver_candidates FOR DELETE
    TO authenticated
    USING (true);

-- Create RLS policies for candidate_evaluation_history
DROP POLICY IF EXISTS "Authenticated users can view evaluation history" ON candidate_evaluation_history;
CREATE POLICY "Authenticated users can view evaluation history"
    ON candidate_evaluation_history FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert evaluation history" ON candidate_evaluation_history;
CREATE POLICY "Authenticated users can insert evaluation history"
    ON candidate_evaluation_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create function to record evaluation changes
CREATE OR REPLACE FUNCTION record_evaluation_change()
RETURNS TRIGGER AS $$
DECLARE
    prev_result JSONB;
    new_result JSONB;
    step evaluation_step;
BEGIN
    -- Check each evaluation step for changes
    FOR step IN SELECT unnest(ARRAY['interview', 'yard_test', 'road_test']::evaluation_step[])
    LOOP
        CASE step
            WHEN 'interview' THEN
                prev_result := OLD.interview_result;
                new_result := NEW.interview_result;
            WHEN 'yard_test' THEN
                prev_result := OLD.yard_test_result;
                new_result := NEW.yard_test_result;
            WHEN 'road_test' THEN
                prev_result := OLD.road_test_result;
                new_result := NEW.road_test_result;
        END CASE;

        -- If the result changed, record it
        IF (prev_result IS DISTINCT FROM new_result) AND new_result IS NOT NULL THEN
            INSERT INTO candidate_evaluation_history (
                candidate_id,
                evaluation_step,
                previous_status,
                new_status,
                evaluator_name,
                score,
                notes,
                feedback,
                scheduled_date,
                completed_date,
                created_by
            ) VALUES (
                NEW.id,
                step,
                (prev_result->>'status')::evaluation_status,
                (new_result->>'status')::evaluation_status,
                new_result->>'evaluator_name',
                (new_result->>'score')::INTEGER,
                new_result->>'notes',
                new_result->>'feedback',
                (new_result->>'scheduled_date')::DATE,
                (new_result->>'completed_date')::DATE,
                auth.uid()
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to record evaluation changes
DROP TRIGGER IF EXISTS trigger_record_evaluation_change ON driver_candidates;
CREATE TRIGGER trigger_record_evaluation_change
    AFTER UPDATE ON driver_candidates
    FOR EACH ROW
    EXECUTE FUNCTION record_evaluation_change();

-- Enable realtime for driver_candidates
ALTER PUBLICATION supabase_realtime ADD TABLE driver_candidates;

-- Create storage bucket for candidate CVs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'candidate-documents',
    'candidate-documents',
    false,
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create storage policies for candidate documents
DROP POLICY IF EXISTS "Authenticated users can upload candidate documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload candidate documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'candidate-documents');

DROP POLICY IF EXISTS "Authenticated users can view candidate documents" ON storage.objects;
CREATE POLICY "Authenticated users can view candidate documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'candidate-documents');

DROP POLICY IF EXISTS "Authenticated users can update candidate documents" ON storage.objects;
CREATE POLICY "Authenticated users can update candidate documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'candidate-documents')
    WITH CHECK (bucket_id = 'candidate-documents');

DROP POLICY IF EXISTS "Authenticated users can delete candidate documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete candidate documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'candidate-documents');

-- Add comments for documentation
COMMENT ON TABLE driver_candidates IS 'HR Driver Recruitment - Stores potential driver candidates progressing through evaluation';
COMMENT ON TABLE candidate_evaluation_history IS 'Audit trail of all evaluation changes for driver candidates';
COMMENT ON COLUMN driver_candidates.current_step IS 'Current evaluation step: interview, yard_test, or road_test';
COMMENT ON COLUMN driver_candidates.interview_result IS 'JSON object containing interview evaluation results';
COMMENT ON COLUMN driver_candidates.yard_test_result IS 'JSON object containing in-yard test evaluation results';
COMMENT ON COLUMN driver_candidates.road_test_result IS 'JSON object containing road test evaluation results';
