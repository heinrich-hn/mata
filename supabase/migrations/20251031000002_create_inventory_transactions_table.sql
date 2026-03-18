-- Migration: Create inventory_transactions audit log table
-- Phase 1 - Migration 2 of 4
-- Date: 2025-10-31
-- Description: Create table to track all inventory movements (reserve, deduct, release, restock)

BEGIN;

-- Create inventory_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  parts_request_id UUID REFERENCES parts_requests(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN ('reserve', 'deduct', 'release', 'restock', 'adjustment')
  ),
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id 
  ON inventory_transactions(inventory_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_parts_request_id 
  ON inventory_transactions(parts_request_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at 
  ON inventory_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type
  ON inventory_transactions(transaction_type);

-- Enable Row Level Security
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Users can insert inventory transactions" ON inventory_transactions;

-- Policy: Authenticated users can read all transactions
CREATE POLICY "Users can view inventory transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert transactions
CREATE POLICY "Users can insert inventory transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMIT;

-- Verification query
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_transactions'
ORDER BY ordinal_position;
