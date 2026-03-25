-- Add audit trail columns to fuel_transactions
ALTER TABLE fuel_transactions
  ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Function to edit a refill transaction with audit trail + recalculate blended price
CREATE OR REPLACE FUNCTION edit_refill_transaction(
  p_transaction_id UUID,
  p_quantity_liters NUMERIC DEFAULT NULL,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_edited_by TEXT DEFAULT 'Unknown',
  p_edit_reason TEXT DEFAULT ''
)
RETURNS JSON AS $$
DECLARE
  v_tx RECORD;
  v_bunker RECORD;
  v_old_quantity NUMERIC;
  v_old_unit_cost NUMERIC;
  v_old_reference TEXT;
  v_old_notes TEXT;
  v_changes JSONB := '[]'::jsonb;
  v_edit_entry JSONB;
  v_existing_history JSONB;
  v_qty_diff NUMERIC;
  v_new_blended NUMERIC;
  v_replay_level NUMERIC := 0;
  v_replay_price NUMERIC := 0;
  v_replay_tx RECORD;
  v_replay_qty NUMERIC;
  v_replay_cost NUMERIC;
BEGIN
  -- Get the transaction
  SELECT * INTO v_tx FROM fuel_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  -- Only allow editing refill transactions
  IF v_tx.transaction_type != 'refill' THEN
    RETURN json_build_object('success', false, 'error', 'Only refill transactions can be edited');
  END IF;

  -- Store old values
  v_old_quantity := v_tx.quantity_liters;
  v_old_unit_cost := v_tx.unit_cost;
  v_old_reference := v_tx.reference_number;
  v_old_notes := v_tx.notes;

  -- Build change log
  IF p_quantity_liters IS NOT NULL AND p_quantity_liters != v_old_quantity THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'quantity_liters',
      'old_value', v_old_quantity,
      'new_value', p_quantity_liters
    );
  END IF;

  IF p_unit_cost IS NOT NULL AND p_unit_cost != COALESCE(v_old_unit_cost, 0) THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'unit_cost',
      'old_value', v_old_unit_cost,
      'new_value', p_unit_cost
    );
  END IF;

  IF p_reference_number IS NOT NULL AND p_reference_number != COALESCE(v_old_reference, '') THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'reference_number',
      'old_value', v_old_reference,
      'new_value', p_reference_number
    );
  END IF;

  IF p_notes IS NOT NULL AND p_notes != COALESCE(v_old_notes, '') THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'notes',
      'old_value', v_old_notes,
      'new_value', p_notes
    );
  END IF;

  IF jsonb_array_length(v_changes) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No changes detected');
  END IF;

  -- Build edit history entry
  v_edit_entry := jsonb_build_object(
    'timestamp', now(),
    'edited_by', p_edited_by,
    'reason', p_edit_reason,
    'changes', v_changes
  );

  v_existing_history := COALESCE(v_tx.edit_history, '[]'::jsonb);

  -- Update the transaction record
  UPDATE fuel_transactions SET
    quantity_liters = COALESCE(p_quantity_liters, quantity_liters),
    unit_cost = COALESCE(p_unit_cost, unit_cost),
    total_cost = COALESCE(p_quantity_liters, quantity_liters) * COALESCE(p_unit_cost, unit_cost, 0),
    reference_number = COALESCE(p_reference_number, reference_number),
    notes = COALESCE(p_notes, notes),
    edit_history = v_existing_history || v_edit_entry,
    last_edited_by = p_edited_by,
    last_edited_at = now()
  WHERE id = p_transaction_id;

  -- Adjust bunker current level by quantity difference
  v_qty_diff := COALESCE(p_quantity_liters, v_old_quantity) - v_old_quantity;
  IF v_qty_diff != 0 THEN
    UPDATE fuel_bunkers
    SET current_level_liters = current_level_liters + v_qty_diff,
        updated_at = now()
    WHERE id = v_tx.bunker_id;
  END IF;

  -- Recalculate blended price by replaying ALL transactions for this bunker chronologically
  -- Start fresh: replay from beginning
  v_replay_level := 0;
  v_replay_price := 0;

  FOR v_replay_tx IN
    SELECT transaction_type, quantity_liters AS qty, unit_cost AS cost
    FROM fuel_transactions
    WHERE bunker_id = v_tx.bunker_id
    ORDER BY transaction_date ASC, created_at ASC
  LOOP
    IF v_replay_tx.transaction_type = 'refill' THEN
      v_replay_qty := v_replay_tx.qty;
      v_replay_cost := COALESCE(v_replay_tx.cost, 0);
      IF (v_replay_level + v_replay_qty) > 0 THEN
        v_replay_price := (
          (v_replay_level * v_replay_price) + (v_replay_qty * v_replay_cost)
        ) / (v_replay_level + v_replay_qty);
      END IF;
      v_replay_level := v_replay_level + v_replay_qty;
    ELSIF v_replay_tx.transaction_type = 'dispense' THEN
      v_replay_level := GREATEST(v_replay_level - v_replay_tx.qty, 0);
      -- Price stays the same on dispense
    ELSIF v_replay_tx.transaction_type = 'adjustment' THEN
      -- Adjustments set level but don't change price
      v_replay_level := v_replay_tx.qty;
    END IF;
  END LOOP;

  v_new_blended := ROUND(COALESCE(v_replay_price, 0), 4);

  -- Update bunker with recalculated blended price
  UPDATE fuel_bunkers
  SET unit_cost = v_new_blended,
      updated_at = now()
  WHERE id = v_tx.bunker_id;

  -- Get updated bunker for response
  SELECT * INTO v_bunker FROM fuel_bunkers WHERE id = v_tx.bunker_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'changes_count', jsonb_array_length(v_changes),
    'new_blended_price', v_new_blended,
    'new_bunker_level', v_bunker.current_level_liters
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
