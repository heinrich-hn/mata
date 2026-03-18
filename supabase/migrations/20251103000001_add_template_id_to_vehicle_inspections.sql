-- Add template_id column to vehicle_inspections table
ALTER TABLE vehicle_inspections
ADD COLUMN template_id uuid REFERENCES inspection_templates
(id);

-- Add index for better query performance
CREATE INDEX idx_vehicle_inspections_template_id ON vehicle_inspections(template_id);

-- Add comment for documentation
COMMENT ON COLUMN vehicle_inspections.template_id IS 'Reference to the inspection template used for this inspection';
