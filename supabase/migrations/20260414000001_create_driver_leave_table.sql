-- Create driver_leave table for tracking driver leave/time-off
CREATE TABLE IF NOT EXISTS driver_leave (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'annual',
    status TEXT NOT NULL DEFAULT 'approved',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_leave_type CHECK (leave_type IN ('annual', 'sick', 'family', 'unpaid', 'other')),
    CONSTRAINT valid_status CHECK (status IN ('planned', 'approved', 'rejected'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_leave_driver_name ON driver_leave(driver_name);
CREATE INDEX IF NOT EXISTS idx_driver_leave_start_date ON driver_leave(start_date);
CREATE INDEX IF NOT EXISTS idx_driver_leave_date_range ON driver_leave(start_date, end_date);

-- Enable RLS
ALTER TABLE driver_leave ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can view driver leave"
    ON driver_leave FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert driver leave"
    ON driver_leave FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update driver leave"
    ON driver_leave FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete driver leave"
    ON driver_leave FOR DELETE
    TO authenticated
    USING (true);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_driver_leave_updated_at
    BEFORE UPDATE ON driver_leave
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
