-- Update refill_bunker to calculate blended (weighted average) price
-- Blended price = (existing_volume * existing_price + new_volume * new_price) / total_volume
CREATE OR REPLACE FUNCTION refill_bunker(
  p_bunker_id UUID,
  p_quantity_liters NUMERIC,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_bunker RECORD;
  v_new_level NUMERIC;
  v_transaction_id UUID;
  v_total_cost NUMERIC;
  v_final_unit_cost NUMERIC;
  v_blended_cost NUMERIC;
  v_existing_cost NUMERIC;
  v_new_cost NUMERIC;
BEGIN
  -- Get bunker info
  SELECT * INTO v_bunker FROM fuel_bunkers WHERE id = p_bunker_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bunker not found');
  END IF;

  -- Calculate new level
  v_new_level := v_bunker.current_level_liters + p_quantity_liters;

  -- Check capacity
  IF v_new_level > v_bunker.capacity_liters THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Exceeds capacity. Max additional: ' || (v_bunker.capacity_liters - v_bunker.current_level_liters) || 'L'
    );
  END IF;

  -- Determine the new delivery unit cost
  v_new_cost := COALESCE(p_unit_cost, v_bunker.unit_cost, 0);
  v_existing_cost := COALESCE(v_bunker.unit_cost, 0);

  -- Calculate blended (weighted average) price
  IF v_new_level > 0 THEN
    v_blended_cost := (
      (v_bunker.current_level_liters * v_existing_cost) +
      (p_quantity_liters * v_new_cost)
    ) / v_new_level;
  ELSE
    v_blended_cost := v_new_cost;
  END IF;

  -- Round to 4 decimal places
  v_blended_cost := ROUND(v_blended_cost, 4);

  -- Total cost for this transaction only (at the delivery price)
  v_total_cost := p_quantity_liters * v_new_cost;

  -- Update bunker level and blended cost
  UPDATE fuel_bunkers
  SET
    current_level_liters = v_new_level,
    unit_cost = v_blended_cost,
    updated_at = now()
  WHERE id = p_bunker_id;

  -- Create transaction record (stores the delivery price, not the blended price)
  INSERT INTO fuel_transactions (
    bunker_id, transaction_type, quantity_liters, unit_cost, total_cost,
    reference_number, notes
  ) VALUES (
    p_bunker_id, 'refill', p_quantity_liters, v_new_cost, v_total_cost,
    p_reference_number, p_notes
  ) RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'added_liters', p_quantity_liters,
    'new_bunker_level', v_new_level,
    'total_cost', v_total_cost,
    'blended_unit_cost', v_blended_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
