-- Migration: Create inventory adjustment RPC function with transaction logging
-- Date: 2025-11-12
-- Purpose: Automate inventory quantity adjustments with full audit trail

-- Create the RPC function to adjust inventory quantity
CREATE OR REPLACE FUNCTION adjust_inventory_quantity(
  p_inventory_id UUID,
  p_quantity_change INTEGER,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_quantity INTEGER;
  v_new_quantity INTEGER;
  v_inventory_name TEXT;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Get current inventory details
  SELECT quantity_on_hand, item_name
  INTO v_current_quantity, v_inventory_name
  FROM inventory
  WHERE id = p_inventory_id;

  -- Check if inventory item exists
  IF v_current_quantity IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Inventory item not found'
    );
  END IF;

  -- Calculate new quantity
  v_new_quantity := v_current_quantity + p_quantity_change;

  -- Prevent negative inventory
  IF v_new_quantity < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient inventory. Current: %s, Requested change: %s', v_current_quantity, p_quantity_change)
    );
  END IF;

  -- Update inventory quantity
  UPDATE inventory
  SET
    quantity_on_hand = v_new_quantity,
    updated_at = NOW()
  WHERE id = p_inventory_id;

  -- Log the transaction in inventory_transactions table
  INSERT INTO inventory_transactions (
    inventory_id,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    reason,
    reference_type,
    reference_id,
    performed_by,
    transaction_date
  )
  VALUES (
    p_inventory_id,
    CASE
      WHEN p_quantity_change > 0 THEN 'adjustment_in'
      ELSE 'adjustment_out'
    END,
    p_quantity_change,
    v_current_quantity,
    v_new_quantity,
    p_reason,
    p_reference_type,
    p_reference_id,
    COALESCE(p_performed_by, auth.uid()),
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Build success response
  v_result := jsonb_build_object(
    'success', true,
    'inventory_id', p_inventory_id,
    'inventory_name', v_inventory_name,
    'quantity_before', v_current_quantity,
    'quantity_after', v_new_quantity,
    'quantity_change', p_quantity_change,
    'transaction_id', v_transaction_id
  );

  -- Log the action
  RAISE NOTICE 'Inventory adjusted: % (%) % -> % (change: %)',
    v_inventory_name, p_inventory_id, v_current_quantity, v_new_quantity, p_quantity_change;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION adjust_inventory_quantity TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION adjust_inventory_quantity IS
'Adjusts inventory quantity with full transaction logging.
Parameters:
- p_inventory_id: UUID of inventory item
- p_quantity_change: Amount to change (positive = increase, negative = decrease)
- p_reason: Description of why adjustment is being made
- p_reference_type: Optional reference type (e.g., ''tyre_removal'', ''manual_adjustment'')
- p_reference_id: Optional reference ID (e.g., tyre_id, job_card_id)
- p_performed_by: Optional user ID (defaults to current authenticated user)

Returns JSONB with success status and transaction details.';

-- Create a convenience function to increment inventory (returns to stock)
CREATE OR REPLACE FUNCTION increment_inventory(
  p_inventory_id UUID,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT 'Returned to inventory',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN adjust_inventory_quantity(
    p_inventory_id,
    ABS(p_quantity), -- Ensure positive
    p_reason,
    p_reference_type,
    p_reference_id,
    auth.uid()
  );
END;
$$;

-- Create a convenience function to decrement inventory (remove from stock)
CREATE OR REPLACE FUNCTION decrement_inventory(
  p_inventory_id UUID,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT 'Removed from inventory',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN adjust_inventory_quantity(
    p_inventory_id,
    -ABS(p_quantity), -- Ensure negative
    p_reason,
    p_reference_type,
    p_reference_id,
    auth.uid()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_inventory TO authenticated;

-- Add comments
COMMENT ON FUNCTION increment_inventory IS 'Convenience function to add items back to inventory (positive adjustment)';
COMMENT ON FUNCTION decrement_inventory IS 'Convenience function to remove items from inventory (negative adjustment)';
