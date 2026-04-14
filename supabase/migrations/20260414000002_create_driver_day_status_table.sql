-- Create driver_day_status table for manual day-by-day driver scheduling
CREATE TABLE IF NOT EXISTS driver_day_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_name TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT unique_driver_date UNIQUE (driver_name, date),
    CONSTRAINT valid_day_status CHECK (status IN ('at_work', 'on_trip', 'leave'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_day_status_driver_name ON driver_day_status(driver_name);
CREATE INDEX IF NOT EXISTS idx_driver_day_status_date ON driver_day_status(date);
CREATE INDEX IF NOT EXISTS idx_driver_day_status_driver_date ON driver_day_status(driver_name, date);

-- Enable RLS
ALTER TABLE driver_day_status ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can view driver day status"
    ON driver_day_status FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert driver day status"
    ON driver_day_status FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update driver day status"
    ON driver_day_status FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete driver day status"
    ON driver_day_status FOR DELETE
    TO authenticated
    USING (true);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_driver_day_status_updated_at
    BEFORE UPDATE ON driver_day_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
