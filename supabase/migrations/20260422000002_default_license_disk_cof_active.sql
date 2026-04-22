-- 1. Change the default so new vehicles get license_disk, cof, and insurance active.
ALTER TABLE public.vehicles
  ALTER COLUMN active_document_types SET DEFAULT ARRAY['license_disk', 'cof', 'insurance']::text[];

-- 2. For existing vehicles: ensure license_disk and cof are present in the array.
--    Also remove 'roadworthy' since COF replaces it.
UPDATE public.vehicles
SET active_document_types = array_remove(
  CASE
    WHEN NOT ('license_disk' = ANY(active_document_types))
         AND NOT ('cof' = ANY(active_document_types))
      THEN active_document_types || ARRAY['license_disk','cof']
    WHEN NOT ('license_disk' = ANY(active_document_types))
      THEN active_document_types || ARRAY['license_disk']
    WHEN NOT ('cof' = ANY(active_document_types))
      THEN active_document_types || ARRAY['cof']
    ELSE active_document_types
  END,
  'roadworthy'
);
