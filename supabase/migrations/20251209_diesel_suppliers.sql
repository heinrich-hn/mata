-- Diesel Suppliers Management Tables
-- Run this migration in Supabase SQL Editor

-- 1. Create diesel_suppliers table (external filling stations/depots)
CREATE TABLE IF NOT EXISTS diesel_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  province TEXT,
  country TEXT DEFAULT 'South Africa',
  google_maps_url TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  fuel_type TEXT DEFAULT 'Diesel',
  current_price_per_liter NUMERIC(10, 4) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  is_preferred BOOLEAN DEFAULT false,
  is_avoided BOOLEAN DEFAULT false,
  avoid_reason TEXT,
  min_purchase_liters NUMERIC(12, 2),
  operating_hours TEXT,
  has_truck_facilities BOOLEAN DEFAULT true,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create supplier_price_history table (monthly price tracking)
CREATE TABLE IF NOT EXISTS supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES diesel_suppliers(id) ON DELETE CASCADE,
  price_per_liter NUMERIC(10, 4) NOT NULL,
  effective_date DATE NOT NULL,
  end_date DATE,
  price_change NUMERIC(10, 4), -- Difference from previous price
  price_change_percent NUMERIC(6, 2), -- Percentage change
  updated_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create route_fuel_stops table (planned fuel stops for routes)
CREATE TABLE IF NOT EXISTS route_fuel_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  total_distance_km NUMERIC(10, 2),
  stop_order INTEGER NOT NULL,
  supplier_id UUID NOT NULL REFERENCES diesel_suppliers(id) ON DELETE CASCADE,
  distance_from_origin_km NUMERIC(10, 2),
  distance_to_next_stop_km NUMERIC(10, 2),
  recommended_liters NUMERIC(10, 2),
  estimated_cost NUMERIC(12, 2),
  is_mandatory BOOLEAN DEFAULT false, -- Must stop here
  is_recommended BOOLEAN DEFAULT true, -- Recommended for best price
  skip_reason TEXT, -- Why to skip this station
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create fuel_strategy_analysis table (aggregated analysis)
CREATE TABLE IF NOT EXISTS fuel_strategy_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  analysis_type TEXT NOT NULL, -- 'cheapest', 'avoid', 'route_optimization'
  supplier_id UUID REFERENCES diesel_suppliers(id) ON DELETE SET NULL,
  route_name TEXT,
  recommendation TEXT NOT NULL,
  potential_savings NUMERIC(12, 2),
  current_spend NUMERIC(12, 2),
  optimized_spend NUMERIC(12, 2),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_diesel_suppliers_location ON diesel_suppliers(location);
CREATE INDEX IF NOT EXISTS idx_diesel_suppliers_price ON diesel_suppliers(current_price_per_liter);
CREATE INDEX IF NOT EXISTS idx_diesel_suppliers_province ON diesel_suppliers(province);
CREATE INDEX IF NOT EXISTS idx_diesel_suppliers_active ON diesel_suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_diesel_suppliers_preferred ON diesel_suppliers(is_preferred);
CREATE INDEX IF NOT EXISTS idx_supplier_price_history_supplier ON supplier_price_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_price_history_date ON supplier_price_history(effective_date);
CREATE INDEX IF NOT EXISTS idx_route_fuel_stops_route ON route_fuel_stops(route_name);
CREATE INDEX IF NOT EXISTS idx_route_fuel_stops_supplier ON route_fuel_stops(supplier_id);

-- Enable RLS
ALTER TABLE diesel_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_fuel_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_strategy_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users)
CREATE POLICY "Allow authenticated read diesel_suppliers" ON diesel_suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert diesel_suppliers" ON diesel_suppliers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update diesel_suppliers" ON diesel_suppliers
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete diesel_suppliers" ON diesel_suppliers
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read supplier_price_history" ON supplier_price_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert supplier_price_history" ON supplier_price_history
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update supplier_price_history" ON supplier_price_history
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete supplier_price_history" ON supplier_price_history
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read route_fuel_stops" ON route_fuel_stops
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert route_fuel_stops" ON route_fuel_stops
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update route_fuel_stops" ON route_fuel_stops
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete route_fuel_stops" ON route_fuel_stops
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read fuel_strategy_analysis" ON fuel_strategy_analysis
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert fuel_strategy_analysis" ON fuel_strategy_analysis
  FOR INSERT TO authenticated WITH CHECK (true);

-- Function to update supplier price and log history
CREATE OR REPLACE FUNCTION update_supplier_price(
  p_supplier_id UUID,
  p_new_price NUMERIC(10, 4),
  p_updated_by TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_price NUMERIC(10, 4);
  v_price_change NUMERIC(10, 4);
  v_price_change_percent NUMERIC(6, 2);
BEGIN
  -- Get current price
  SELECT current_price_per_liter INTO v_old_price
  FROM diesel_suppliers WHERE id = p_supplier_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Supplier not found');
  END IF;

  -- Calculate change
  v_price_change := p_new_price - v_old_price;
  v_price_change_percent := CASE
    WHEN v_old_price > 0 THEN ROUND((v_price_change / v_old_price) * 100, 2)
    ELSE 0
  END;

  -- Close previous price record
  UPDATE supplier_price_history
  SET end_date = CURRENT_DATE - 1
  WHERE supplier_id = p_supplier_id AND end_date IS NULL;

  -- Insert new price history
  INSERT INTO supplier_price_history (
    supplier_id, price_per_liter, effective_date,
    price_change, price_change_percent, updated_by, notes
  ) VALUES (
    p_supplier_id, p_new_price, CURRENT_DATE,
    v_price_change, v_price_change_percent, p_updated_by, p_notes
  );

  -- Update supplier's current price
  UPDATE diesel_suppliers
  SET current_price_per_liter = p_new_price, updated_at = now()
  WHERE id = p_supplier_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_price', v_old_price,
    'new_price', p_new_price,
    'change', v_price_change,
    'change_percent', v_price_change_percent
  );
END;
$$;

-- Function to get cheapest suppliers by province
CREATE OR REPLACE FUNCTION get_cheapest_suppliers_by_province(
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  province TEXT,
  supplier_id UUID,
  supplier_name TEXT,
  location TEXT,
  price_per_liter NUMERIC,
  rank_in_province INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.province,
    ds.id,
    ds.name,
    ds.location,
    ds.current_price_per_liter,
    ROW_NUMBER() OVER (PARTITION BY ds.province ORDER BY ds.current_price_per_liter ASC)::INTEGER
  FROM diesel_suppliers ds
  WHERE ds.is_active = true AND ds.is_avoided = false
  ORDER BY ds.province, ds.current_price_per_liter ASC;
END;
$$;

-- Function to analyze fuel strategy for a route
CREATE OR REPLACE FUNCTION analyze_route_fuel_strategy(
  p_origin TEXT,
  p_destination TEXT,
  p_total_distance_km NUMERIC,
  p_tank_capacity_liters NUMERIC DEFAULT 500,
  p_consumption_per_km NUMERIC DEFAULT 0.35 -- liters per km
)
RETURNS TABLE (
  stop_order INTEGER,
  supplier_id UUID,
  supplier_name TEXT,
  location TEXT,
  price_per_liter NUMERIC,
  recommended_liters NUMERIC,
  estimated_cost NUMERIC,
  distance_from_origin NUMERIC,
  rationale TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This is a simplified version - in production, you'd use actual route data
  -- For now, return cheapest suppliers sorted by price
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY ds.current_price_per_liter ASC)::INTEGER,
    ds.id,
    ds.name,
    ds.location,
    ds.current_price_per_liter,
    LEAST(p_tank_capacity_liters, p_total_distance_km * p_consumption_per_km / 3)::NUMERIC AS rec_liters,
    (LEAST(p_tank_capacity_liters, p_total_distance_km * p_consumption_per_km / 3) * ds.current_price_per_liter)::NUMERIC AS est_cost,
    0::NUMERIC AS dist_origin,
    CASE
      WHEN ds.current_price_per_liter = (SELECT MIN(current_price_per_liter) FROM diesel_suppliers WHERE is_active = true)
        THEN 'BEST PRICE - Fill maximum here'
      WHEN ds.current_price_per_liter < 20.00 THEN 'Good price - Consider filling here'
      ELSE 'Higher price - Fill minimum only'
    END AS rationale
  FROM diesel_suppliers ds
  WHERE ds.is_active = true AND ds.is_avoided = false
  ORDER BY ds.current_price_per_liter ASC
  LIMIT 10;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_diesel_suppliers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_diesel_suppliers_timestamp
  BEFORE UPDATE ON diesel_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_diesel_suppliers_timestamp();

CREATE TRIGGER update_route_fuel_stops_timestamp
  BEFORE UPDATE ON route_fuel_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_diesel_suppliers_timestamp();
