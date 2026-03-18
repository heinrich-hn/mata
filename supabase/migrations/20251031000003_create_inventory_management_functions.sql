-- Migration: Create database functions for inventory management
-- Phase 1 - Migration 3 of 4
-- Date: 2025-10-31
-- Description: Create functions for checking availability, reserving, deducting, and releasing inventory

BEGIN;

-- ============================================================================
-- Function 1: Check inventory availability
-- ============================================================================
CREATE OR REPLACE FUNCTION check_inventory_availability(
  p_inventory_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_quantity INTEGER;
BEGIN
  -- Get current quantity from inventory
  SELECT quantity INTO v_current_quantity
  FROM inventory
  WHERE id = p_inventory_id;
  
  -- Return false if inventory item not found
  IF v_current_quantity IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Return true if we have enough stock
  RETURN v_current_quantity >= p_quantity;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Function 2: Reserve inventory (log reservation without deducting)
-- ============================================================================
CREATE OR REPLACE FUNCTION reserve_inventory(
  p_parts_request_id UUID,
  p_inventory_id UUID,
  p_quantity INTEGER,
  p_performed_by TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_quantity INTEGER;
  v_available BOOLEAN;
BEGIN
  -- Lock the inventory row to prevent concurrent modifications
  SELECT quantity INTO v_current_quantity
  FROM inventory
  WHERE id = p_inventory_id
  FOR UPDATE;
  
  -- Check if sufficient quantity available
  IF v_current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory. Required: %, Available: %', 
      p_quantity, v_current_quantity;
  END IF;
  
  -- Log reservation (does NOT change inventory.quantity yet)
  INSERT INTO inventory_transactions (
    inventory_id,
    parts_request_id,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    performed_by,
    notes
  ) VALUES (
    p_inventory_id,
    p_parts_request_id,
    'reserve',
    -p_quantity,
    v_current_quantity,
    v_current_quantity, -- No change to actual inventory yet
    p_performed_by,
    'Inventory reserved for parts request'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function 3: Deduct inventory (actually remove from stock when approved)
-- ============================================================================
CREATE OR REPLACE FUNCTION deduct_inventory(
  p_parts_request_id UUID,
  p_inventory_id UUID,
  p_quantity INTEGER,
  p_performed_by TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_quantity INTEGER;
BEGIN
  -- Lock the inventory row to prevent concurrent modifications
  SELECT quantity INTO v_current_quantity
  FROM inventory
  WHERE id = p_inventory_id
  FOR UPDATE;
  
  -- Check if sufficient quantity available
  IF v_current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory. Required: %, Available: %', 
      p_quantity, v_current_quantity;
  END IF;
  
  -- Actually deduct from inventory
  UPDATE inventory
  SET quantity = quantity - p_quantity
  WHERE id = p_inventory_id;
  
  -- Log the deduction
  INSERT INTO inventory_transactions (
    inventory_id,
    parts_request_id,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    performed_by,
    notes
  ) VALUES (
    p_inventory_id,
    p_parts_request_id,
    'deduct',
    -p_quantity,
    v_current_quantity,
    v_current_quantity - p_quantity,
    p_performed_by,
    'Inventory deducted for approved parts request'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function 4: Release inventory reservation (when request cancelled/rejected)
-- ============================================================================
CREATE OR REPLACE FUNCTION release_inventory_reservation(
  p_parts_request_id UUID,
  p_inventory_id UUID,
  p_quantity INTEGER,
  p_performed_by TEXT,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_quantity INTEGER;
BEGIN
  -- Get current quantity (no need to lock since we're not changing it)
  SELECT quantity INTO v_current_quantity
  FROM inventory
  WHERE id = p_inventory_id;
  
  -- Log the release (does NOT change inventory.quantity)
  INSERT INTO inventory_transactions (
    inventory_id,
    parts_request_id,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    performed_by,
    notes
  ) VALUES (
    p_inventory_id,
    p_parts_request_id,
    'release',
    p_quantity,
    v_current_quantity,
    v_current_quantity, -- No change to actual inventory
    p_performed_by,
    COALESCE(p_reason, 'Reservation released')
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_inventory_availability TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION release_inventory_reservation TO authenticated;

COMMIT;

-- Verification query
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'check_inventory_availability',
    'reserve_inventory',
    'deduct_inventory',
    'release_inventory_reservation'
  )
ORDER BY routine_name;
