-- Migration: Add missing fields to maintenance_schedules, maintenance_schedule_history, and tyres tables
-- This migration adds fields that the application components expect but are currently missing

-- =====================================================
-- 1. Extend maintenance_schedules table
-- =====================================================

ALTER TABLE maintenance_schedules
  -- Basic information
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,

  -- Schedule configuration
  ADD COLUMN IF NOT EXISTS schedule_type TEXT CHECK (schedule_type IN ('one_time', 'recurring')),
  ADD COLUMN IF NOT EXISTS frequency TEXT CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  ADD COLUMN IF NOT EXISTS frequency_value INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,

  -- Tracking
  ADD COLUMN IF NOT EXISTS last_completed_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS estimated_duration_hours NUMERIC(10,2),

  -- Priority and categorization
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('inspection', 'service', 'repair', 'replacement', 'calibration')),
  ADD COLUMN IF NOT EXISTS maintenance_type TEXT,

  -- Assignment
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS assigned_team TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,

  -- Notifications
  ADD COLUMN IF NOT EXISTS alert_before_hours INTEGER[] DEFAULT ARRAY[24, 48, 168],
  ADD COLUMN IF NOT EXISTS notification_channels JSONB DEFAULT '{"email": true, "in_app": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_recipients JSONB DEFAULT '[]'::jsonb,

  -- Automation
  ADD COLUMN IF NOT EXISTS auto_create_job_card BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_template_id UUID REFERENCES job_card_templates(id) ON DELETE SET NULL,

  -- Odometer-based scheduling
  ADD COLUMN IF NOT EXISTS odometer_based BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS odometer_interval_km INTEGER,
  ADD COLUMN IF NOT EXISTS last_odometer_reading INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN maintenance_schedules.title IS 'Human-readable title for the maintenance schedule';
COMMENT ON COLUMN maintenance_schedules.schedule_type IS 'Whether this is a one-time or recurring schedule';
COMMENT ON COLUMN maintenance_schedules.priority IS 'Priority level for the maintenance task';
COMMENT ON COLUMN maintenance_schedules.category IS 'Category of maintenance work';
COMMENT ON COLUMN maintenance_schedules.odometer_based IS 'Whether scheduling is based on odometer readings';

-- Update existing records to have reasonable defaults
UPDATE maintenance_schedules
SET
  title = COALESCE(title, service_type),
  schedule_type = COALESCE(schedule_type, 'recurring'),
  priority = COALESCE(priority, 'medium')
WHERE title IS NULL OR schedule_type IS NULL OR priority IS NULL;

-- =====================================================
-- 2. Extend maintenance_schedule_history table
-- =====================================================

ALTER TABLE maintenance_schedule_history
  -- Relationships
  ADD COLUMN IF NOT EXISTS job_card_id UUID REFERENCES job_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inspection_id INTEGER REFERENCES inspection_reports(id) ON DELETE SET NULL,

  -- Dates
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),  -- Personnel
  ADD COLUMN IF NOT EXISTS completed_by TEXT,

  -- Metrics
  ADD COLUMN IF NOT EXISTS odometer_reading INTEGER,
  ADD COLUMN IF NOT EXISTS labor_hours NUMERIC(10,2),

  -- Structured data
  ADD COLUMN IF NOT EXISTS parts_used JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_faults JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN maintenance_schedule_history.parts_used IS 'JSON array of parts used during maintenance';
COMMENT ON COLUMN maintenance_schedule_history.linked_faults IS 'JSON array of fault IDs addressed by this maintenance';

-- =====================================================
-- 3. Extend tyres table (add position tracking)
-- =====================================================

ALTER TABLE tyres
  ADD COLUMN IF NOT EXISTS current_fleet_position TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT;

-- Add comments
COMMENT ON COLUMN tyres.current_fleet_position IS 'Current position in fleet format: e.g., "10T FL" (10-wheeler Truck, Front Left)';
COMMENT ON COLUMN tyres.position IS 'Simplified position code for filtering/grouping';

-- Create index for position-based queries
CREATE INDEX IF NOT EXISTS idx_tyres_current_fleet_position ON tyres(current_fleet_position) WHERE current_fleet_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tyres_position ON tyres(position) WHERE position IS NOT NULL;

-- =====================================================
-- 4. Create trigger to auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_maintenance_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS maintenance_history_updated_at ON maintenance_schedule_history;
CREATE TRIGGER maintenance_history_updated_at
  BEFORE UPDATE ON maintenance_schedule_history
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_history_timestamp();

-- =====================================================
-- 5. Add useful indexes for performance
-- =====================================================

-- Maintenance schedules indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_priority ON maintenance_schedules(priority) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_category ON maintenance_schedules(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_assigned_to ON maintenance_schedules(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next_due ON maintenance_schedules(next_due_date) WHERE is_active = true;

-- Maintenance history indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_history_job_card ON maintenance_schedule_history(job_card_id) WHERE job_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_history_inspection ON maintenance_schedule_history(inspection_id) WHERE inspection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_history_completed_date ON maintenance_schedule_history(completed_date) WHERE completed_date IS NOT NULL;

-- =====================================================
-- 6. Update RLS policies if needed
-- =====================================================

-- Ensure RLS is enabled (should already be, but verify)
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tyres ENABLE ROW LEVEL SECURITY;

-- Note: Existing RLS policies should continue to work with new columns
-- If you need to add specific policies for new fields, add them here

COMMENT ON TABLE maintenance_schedules IS 'Extended maintenance scheduling with comprehensive tracking and automation features';
COMMENT ON TABLE maintenance_schedule_history IS 'Extended maintenance history with job card linking and detailed metrics';
