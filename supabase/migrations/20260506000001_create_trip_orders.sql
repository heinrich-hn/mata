-- Trip Orders + Order Documents
-- Allows multiple "orders" to be attached to a trip, each with one or more
-- uploaded documents (PDFs / images). Files live in the existing
-- 'trip-documents' storage bucket under path: orders/{trip_id}/{order_id}/{filename}

CREATE TABLE IF NOT EXISTS public.trip_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_orders_trip ON public.trip_orders(trip_id);

CREATE TABLE IF NOT EXISTS public.trip_order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_order_id UUID NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_order_documents_order
  ON public.trip_order_documents(trip_order_id);

-- Enable RLS
ALTER TABLE public.trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_order_documents ENABLE ROW LEVEL SECURITY;

-- Trip orders policies (authenticated users full access)
CREATE POLICY "Authenticated users can view trip orders"
  ON public.trip_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert trip orders"
  ON public.trip_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update trip orders"
  ON public.trip_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete trip orders"
  ON public.trip_orders FOR DELETE TO authenticated USING (true);

-- Trip order documents policies
CREATE POLICY "Authenticated users can view trip order documents"
  ON public.trip_order_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert trip order documents"
  ON public.trip_order_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update trip order documents"
  ON public.trip_order_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete trip order documents"
  ON public.trip_order_documents FOR DELETE TO authenticated USING (true);

-- Updated_at trigger for trip_orders
CREATE OR REPLACE FUNCTION public.set_trip_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trip_orders_updated_at ON public.trip_orders;
CREATE TRIGGER trg_trip_orders_updated_at
  BEFORE UPDATE ON public.trip_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_trip_orders_updated_at();

COMMENT ON TABLE public.trip_orders IS 'Customer orders attached to a trip. Each order may have multiple uploaded documents (PDFs/images) accessible to the assigned driver via the mobile app.';
COMMENT ON TABLE public.trip_order_documents IS 'PDF / image documents attached to a trip order. Files stored in the trip-documents bucket under orders/{trip_id}/{order_id}/.';
