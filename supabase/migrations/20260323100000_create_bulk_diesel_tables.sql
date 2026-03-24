-- Bulk Diesel Suppliers: companies you order bulk diesel from to fill bunkers
CREATE TABLE IF NOT EXISTS bulk_diesel_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  location TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders placed with bulk diesel suppliers
CREATE TABLE IF NOT EXISTS bulk_diesel_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES bulk_diesel_suppliers(id) ON DELETE CASCADE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_liters NUMERIC NOT NULL CHECK (quantity_liters > 0),
  price_per_liter NUMERIC NOT NULL CHECK (price_per_liter > 0),
  total_cost NUMERIC GENERATED ALWAYS AS (quantity_liters * price_per_liter) STORED,
  delivery_date DATE,
  reference_number TEXT,
  bunker_id UUID REFERENCES fuel_bunkers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly price snapshots for trend comparison
CREATE TABLE IF NOT EXISTS bulk_diesel_price_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES bulk_diesel_suppliers(id) ON DELETE CASCADE,
  price_per_liter NUMERIC NOT NULL CHECK (price_per_liter > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (supplier_id, effective_date)
);

-- Enable RLS
ALTER TABLE bulk_diesel_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_diesel_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_diesel_price_entries ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for authenticated users, matching project pattern)
CREATE POLICY "Authenticated users can manage bulk_diesel_suppliers"
  ON bulk_diesel_suppliers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage bulk_diesel_orders"
  ON bulk_diesel_orders FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage bulk_diesel_price_entries"
  ON bulk_diesel_price_entries FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_bulk_diesel_orders_supplier ON bulk_diesel_orders(supplier_id);
CREATE INDEX idx_bulk_diesel_orders_date ON bulk_diesel_orders(order_date);
CREATE INDEX idx_bulk_diesel_price_entries_supplier ON bulk_diesel_price_entries(supplier_id);
CREATE INDEX idx_bulk_diesel_price_entries_date ON bulk_diesel_price_entries(effective_date);
