-- Procurement Workflow Overhaul
-- Adds columns for procurement_started tracking, allocation, and quotes storage

-- Add procurement_started flag to distinguish new requests from active procurement
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS procurement_started boolean DEFAULT false;

-- Add allocation tracking for after receipt
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS allocated_to_job_card boolean DEFAULT false;
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS allocated_at timestamptz;

-- Add quotes JSONB column for multiple quote uploads
-- Stores array of: {file_url, file_name, vendor_name, price, uploaded_at}
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS quotes jsonb DEFAULT '[]'::jsonb;

-- Update existing received items that have a job_card_id to be marked as allocated (historical data)
UPDATE parts_requests 
SET allocated_to_job_card = true, allocated_at = received_date
WHERE status = 'received' AND job_card_id IS NOT NULL AND received_date IS NOT NULL;

-- Update existing items that have ir_number or sage_requisition_number to be marked as procurement_started
UPDATE parts_requests 
SET procurement_started = true 
WHERE ir_number IS NOT NULL OR sage_requisition_number IS NOT NULL OR status IN ('approved', 'ordered', 'received', 'fulfilled');
