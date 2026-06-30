-- Require a reason when creating high-volume diesel orders
CREATE OR REPLACE FUNCTION public.enforce_diesel_order_reason_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fleet_vehicle_id IS NOT NULL
     AND NEW.quantity_liters > 200
     AND COALESCE(NULLIF(BTRIM(NEW.notes), ''), '') = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A reason is required for diesel orders above 200L.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS diesel_orders_require_reason_on_insert ON public.diesel_orders;

CREATE TRIGGER diesel_orders_require_reason_on_insert
  BEFORE INSERT ON public.diesel_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_diesel_order_reason_on_insert();

COMMENT ON FUNCTION public.enforce_diesel_order_reason_on_insert() IS
  'Enforces a reason (notes) for newly created diesel orders above 200L.';
