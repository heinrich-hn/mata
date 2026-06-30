-- Add optional USD cost-per-night to truck stop orders.
-- Safe for databases where 20260701000000_add_truck_stop_orders.sql was already applied.
ALTER TABLE public.truck_stop_orders
    ADD COLUMN IF NOT EXISTS cost_per_night NUMERIC(10, 2);

COMMENT ON COLUMN public.truck_stop_orders.cost_per_night IS
  'Optional USD cost per night at the truck stop.';
