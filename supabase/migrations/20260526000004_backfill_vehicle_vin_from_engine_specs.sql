-- Backfill: the Add/Edit Vehicle dialogs historically wrote the VIN value into
-- vehicles.engine_specs. Move that data into the proper vehicles.vin column so
-- future inserts/updates (which now write to vin) line up with existing rows.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vin TEXT;

DO $$
BEGIN
  EXECUTE $sql$
    UPDATE public.vehicles
    SET vin = engine_specs
    WHERE vin IS NULL
      AND engine_specs IS NOT NULL
      AND length(btrim(engine_specs)) > 0
  $sql$;
END
$$;

UPDATE public.vehicles
SET engine_specs = NULL
WHERE engine_specs IS NOT NULL
  AND vin IS NOT NULL
  AND btrim(engine_specs) = btrim(vin);
