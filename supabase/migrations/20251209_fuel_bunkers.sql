-- Fuel Bunkers Management Tables
-- Run this migration in Supabase SQL Editor

-- 1. Create fuel_bunkers table (tanks/depots that store fuel)
CREATE TABLE IF NOT EXISTS fuel_bunkers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  fuel_type TEXT NOT NULL DEFAULT 'Diesel', -- Diesel, Petrol, LPG, CNG, Electric
  capacity_liters NUMERIC(12, 2) NOT NULL DEFAULT 0,
  current_level_liters NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10, 4) DEFAULT 0, -- Cost per liter
  min_level_alert NUMERIC(12, 2) DEFAULT 0, -- Alert when below this level
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create fuel_transactions table (records all fuel movements)
CREATE TABLE IF NOT EXISTS fuel_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bunker_id UUID NOT NULL REFERENCES fuel_bunkers(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'refill' (adding to bunker), 'dispense' (taking from bunker), 'adjustment'
  quantity_liters NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(10, 4),
  total_cost NUMERIC(12, 2),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_fleet_number TEXT,
  odometer_reading NUMERIC(12, 2),
  driver_name TEXT,
  notes TEXT,
  reference_number TEXT, -- Invoice/receipt number for refills
  transaction_date TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create fuel_bunker_adjustments table (for manual adjustments/audits)
CREATE TABLE IF NOT EXISTS fuel_bunker_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bunker_id UUID NOT NULL REFERENCES fuel_bunkers(id) ON DELETE CASCADE,
  old_level NUMERIC(12, 2) NOT NULL,
  new_level NUMERIC(12, 2) NOT NULL,
  adjustment_quantity NUMERIC(12, 2) NOT NULL, -- Can be negative
  reason TEXT,
  adjusted_by TEXT,
  adjusted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_bunker ON fuel_transactions(bunker_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_date ON fuel_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle ON fuel_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_bunkers_active ON fuel_bunkers(is_active);
CREATE INDEX IF NOT EXISTS idx_fuel_bunker_adjustments_bunker ON fuel_bunker_adjustments(bunker_id);

-- 5. Enable RLS
ALTER TABLE fuel_bunkers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_bunker_adjustments ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies (allow authenticated users)
CREATE POLICY "Allow authenticated users to read fuel_bunkers"
  ON fuel_bunkers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert fuel_bunkers"
  ON fuel_bunkers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update fuel_bunkers"
  ON fuel_bunkers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete fuel_bunkers"
  ON fuel_bunkers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read fuel_transactions"
  ON fuel_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert fuel_transactions"
  ON fuel_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update fuel_transactions"
  ON fuel_transactions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete fuel_transactions"
  ON fuel_transactions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read fuel_bunker_adjustments"
  ON fuel_bunker_adjustments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert fuel_bunker_adjustments"
  ON fuel_bunker_adjustments FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Create function to dispense fuel (automatically deducts from bunker)
CREATE OR REPLACE FUNCTION dispense_fuel(
  p_bunker_id UUID,
  p_quantity_liters NUMERIC,
  p_vehicle_id UUID DEFAULT NULL,
  p_vehicle_fleet_number TEXT DEFAULT NULL,
  p_odometer_reading NUMERIC DEFAULT NULL,
  p_driver_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_bunker RECORD;
  v_new_level NUMERIC;
  v_transaction_id UUID;
  v_total_cost NUMERIC;
BEGIN
  -- Get bunker info
  SELECT * INTO v_bunker FROM fuel_bunkers WHERE id = p_bunker_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bunker not found or inactive');
  END IF;

  -- Check if enough fuel available
  IF v_bunker.current_level_liters < p_quantity_liters THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient fuel. Available: ' || v_bunker.current_level_liters || 'L, Requested: ' || p_quantity_liters || 'L'
    );
  END IF;

  -- Calculate new level and cost
  v_new_level := v_bunker.current_level_liters - p_quantity_liters;
  v_total_cost := p_quantity_liters * COALESCE(v_bunker.unit_cost, 0);

  -- Update bunker level
  UPDATE fuel_bunkers
  SET current_level_liters = v_new_level, updated_at = now()
  WHERE id = p_bunker_id;

  -- Create transaction record
  INSERT INTO fuel_transactions (
    bunker_id, transaction_type, quantity_liters, unit_cost, total_cost,
    vehicle_id, vehicle_fleet_number, odometer_reading, driver_name, notes
  ) VALUES (
    p_bunker_id, 'dispense', p_quantity_liters, v_bunker.unit_cost, v_total_cost,
    p_vehicle_id, p_vehicle_fleet_number, p_odometer_reading, p_driver_name, p_notes
  ) RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'dispensed_liters', p_quantity_liters,
    'new_bunker_level', v_new_level,
    'total_cost', v_total_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to refill bunker
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

  -- Use provided cost or existing bunker cost
  v_final_unit_cost := COALESCE(p_unit_cost, v_bunker.unit_cost, 0);
  v_total_cost := p_quantity_liters * v_final_unit_cost;

  -- Update bunker level and cost
  UPDATE fuel_bunkers
  SET
    current_level_liters = v_new_level,
    unit_cost = v_final_unit_cost,
    updated_at = now()
  WHERE id = p_bunker_id;

  -- Create transaction record
  INSERT INTO fuel_transactions (
    bunker_id, transaction_type, quantity_liters, unit_cost, total_cost,
    reference_number, notes
  ) VALUES (
    p_bunker_id, 'refill', p_quantity_liters, v_final_unit_cost, v_total_cost,
    p_reference_number, p_notes
  ) RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'added_liters', p_quantity_liters,
    'new_bunker_level', v_new_level,
    'total_cost', v_total_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to adjust bunker level (for audits/corrections)
CREATE OR REPLACE FUNCTION adjust_bunker_level(
  p_bunker_id UUID,
  p_new_level NUMERIC,
  p_reason TEXT DEFAULT NULL,
  p_adjusted_by TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_bunker RECORD;
  v_adjustment_qty NUMERIC;
BEGIN
  -- Get bunker info
  SELECT * INTO v_bunker FROM fuel_bunkers WHERE id = p_bunker_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bunker not found');
  END IF;

  -- Check new level doesn't exceed capacity
  IF p_new_level > v_bunker.capacity_liters THEN
    RETURN json_build_object('success', false, 'error', 'New level exceeds bunker capacity');
  END IF;

  IF p_new_level < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Level cannot be negative');
  END IF;

  v_adjustment_qty := p_new_level - v_bunker.current_level_liters;

  -- Record adjustment
  INSERT INTO fuel_bunker_adjustments (
    bunker_id, old_level, new_level, adjustment_quantity, reason, adjusted_by
  ) VALUES (
    p_bunker_id, v_bunker.current_level_liters, p_new_level, v_adjustment_qty, p_reason, p_adjusted_by
  );

  -- Update bunker level
  UPDATE fuel_bunkers
  SET current_level_liters = p_new_level, updated_at = now()
  WHERE id = p_bunker_id;

  RETURN json_build_object(
    'success', true,
    'old_level', v_bunker.current_level_liters,
    'new_level', p_new_level,
    'adjustment', v_adjustment_qty
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create trigger to auto-update timestamp
CREATE OR REPLACE FUNCTION update_fuel_bunker_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fuel_bunkers_updated_at ON fuel_bunkers;
CREATE TRIGGER fuel_bunkers_updated_at
  BEFORE UPDATE ON fuel_bunkers
  FOR EACH ROW
  EXECUTE FUNCTION update_fuel_bunker_timestamp();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION dispense_fuel TO authenticated;
GRANT EXECUTE ON FUNCTION refill_bunker TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_bunker_level TO authenticated;
