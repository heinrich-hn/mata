-- Migration: Add procurement workflow tracking fields
-- This adds fields to track the full procurement lifecycle:
-- 1. Request created (created_at - existing)
-- 2. Sage requisition made
-- 3. Cash Manager approval
-- 4. Order placed with vendor (ordered_at - new)
-- 5. Received

-- Add new workflow tracking columns to parts_requests
ALTER TABLE parts_requests
ADD COLUMN IF NOT EXISTS sage_requisition_number TEXT,
ADD COLUMN IF NOT EXISTS sage_requisition_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sage_requisition_by TEXT,
ADD COLUMN IF NOT EXISTS cash_manager_reference TEXT,
ADD COLUMN IF NOT EXISTS cash_manager_approval_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cash_manager_approved_by TEXT,
ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ordered_by TEXT,
ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
ADD COLUMN IF NOT EXISTS received_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_by TEXT,
ADD COLUMN IF NOT EXISTS received_quantity INTEGER;

-- Add comments for clarity
COMMENT ON COLUMN parts_requests.sage_requisition_number IS 'Reference number from Sage ERP system';
COMMENT ON COLUMN parts_requests.sage_requisition_date IS 'Date when requisition was created in Sage';
COMMENT ON COLUMN parts_requests.sage_requisition_by IS 'User who created the Sage requisition';
COMMENT ON COLUMN parts_requests.cash_manager_reference IS 'Reference number from Cash Manager approval';
COMMENT ON COLUMN parts_requests.cash_manager_approval_date IS 'Date when approved in Cash Manager';
COMMENT ON COLUMN parts_requests.cash_manager_approved_by IS 'User who approved in Cash Manager';
COMMENT ON COLUMN parts_requests.ordered_at IS 'Date when order was placed with vendor';
COMMENT ON COLUMN parts_requests.ordered_by IS 'User who placed the order';
COMMENT ON COLUMN parts_requests.expected_delivery_date IS 'Expected date of delivery';
COMMENT ON COLUMN parts_requests.received_date IS 'Date when items were actually received';
COMMENT ON COLUMN parts_requests.received_by IS 'User who received the items';
COMMENT ON COLUMN parts_requests.received_quantity IS 'Actual quantity received (may differ from ordered)';

-- Create index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_parts_requests_status ON parts_requests(status);
CREATE INDEX IF NOT EXISTS idx_parts_requests_sage_requisition ON parts_requests(sage_requisition_number) WHERE sage_requisition_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_requests_cash_manager ON parts_requests(cash_manager_reference) WHERE cash_manager_reference IS NOT NULL;
