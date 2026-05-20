-- Vehicle fines tracking
-- Logs traffic / parking / regulatory fines issued against a vehicle (optionally tied to a driver)

CREATE TABLE IF NOT EXISTS public.vehicle_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  fine_number text,
  fine_type text NOT NULL DEFAULT 'traffic_violation',
  -- e.g. speeding, parking, traffic_violation, overloading, license, other
  issued_date date NOT NULL,
  due_date date,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  location text,
  issuing_authority text,
  description text,
  status text NOT NULL DEFAULT 'unpaid',
  -- unpaid, paid, disputed, waived, cancelled
  paid_date date,
  paid_by text, -- 'driver' | 'company'
  reference_number text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_fines_vehicle_id_idx ON public.vehicle_fines (vehicle_id);
CREATE INDEX IF NOT EXISTS vehicle_fines_driver_id_idx ON public.vehicle_fines (driver_id);
CREATE INDEX IF NOT EXISTS vehicle_fines_status_idx ON public.vehicle_fines (status);
CREATE INDEX IF NOT EXISTS vehicle_fines_issued_date_idx ON public.vehicle_fines (issued_date DESC);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_vehicle_fines_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicle_fines_updated_at ON public.vehicle_fines;
CREATE TRIGGER trg_vehicle_fines_updated_at
BEFORE UPDATE ON public.vehicle_fines
FOR EACH ROW EXECUTE FUNCTION public.set_vehicle_fines_updated_at();

-- RLS: any authenticated user can read/write (matches pattern of other operational tables)
ALTER TABLE public.vehicle_fines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_fines_select_authenticated" ON public.vehicle_fines;
CREATE POLICY "vehicle_fines_select_authenticated"
  ON public.vehicle_fines FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "vehicle_fines_insert_authenticated" ON public.vehicle_fines;
CREATE POLICY "vehicle_fines_insert_authenticated"
  ON public.vehicle_fines FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_fines_update_authenticated" ON public.vehicle_fines;
CREATE POLICY "vehicle_fines_update_authenticated"
  ON public.vehicle_fines FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_fines_delete_authenticated" ON public.vehicle_fines;
CREATE POLICY "vehicle_fines_delete_authenticated"
  ON public.vehicle_fines FOR DELETE
  TO authenticated USING (true);

COMMENT ON TABLE public.vehicle_fines IS 'Fines issued against vehicles (traffic, parking, regulatory). Optionally tied to the driver responsible.';
