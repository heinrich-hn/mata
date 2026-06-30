-- Create truck_stop_orders table
-- A truck stop order assigns a truck stop (selected from a curated list) to a
-- specific truck (fleet vehicle), driver, and existing trip (load).
CREATE TABLE IF NOT EXISTS public.truck_stop_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    truck_stop VARCHAR(255) NOT NULL,
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    fleet_vehicle_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
    recipient_name VARCHAR(255),
    recipient_phone VARCHAR(50),
    cost_per_night NUMERIC(10, 2),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_truck_stop_orders_load_id ON public.truck_stop_orders(load_id);
CREATE INDEX IF NOT EXISTS idx_truck_stop_orders_driver_id ON public.truck_stop_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_truck_stop_orders_fleet_vehicle_id ON public.truck_stop_orders(fleet_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_truck_stop_orders_status ON public.truck_stop_orders(status);
CREATE INDEX IF NOT EXISTS idx_truck_stop_orders_created_at ON public.truck_stop_orders(created_at DESC);

-- Enable RLS
ALTER TABLE public.truck_stop_orders ENABLE ROW LEVEL SECURITY;

-- Policies for truck_stop_orders
CREATE POLICY "Enable read access for authenticated users" ON public.truck_stop_orders
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.truck_stop_orders
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.truck_stop_orders
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public.truck_stop_orders
    FOR DELETE TO authenticated USING (true);

-- Service role policy
CREATE POLICY "Service role full access to truck_stop_orders" ON public.truck_stop_orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_truck_stop_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER truck_stop_orders_updated_at
    BEFORE UPDATE ON public.truck_stop_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_truck_stop_orders_updated_at();

COMMENT ON TABLE public.truck_stop_orders IS
  'Truck stop orders assigning a truck stop to a specific truck, driver, and existing trip.';
