-- Per-driver and per-vehicle list of document types that should be tracked by
-- the document alert system. Document types not in this list are ignored by
-- DriverDocAlerts / VehicleDocAlerts (no missing-doc or expired-doc warnings).
--
-- Defaults preserve current behavior: the historically-required types are
-- pre-selected so existing drivers/vehicles keep alerting until adjusted.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS active_document_types text[]
  NOT NULL DEFAULT ARRAY['license', 'pdp', 'medical']::text[];

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS active_document_types text[]
  NOT NULL DEFAULT ARRAY['license_disk', 'roadworthy', 'insurance']::text[];

COMMENT ON COLUMN public.drivers.active_document_types IS
  'Document types (matching driver_documents.document_type) that are tracked by alert systems. Empty array disables all alerts for this driver.';

COMMENT ON COLUMN public.vehicles.active_document_types IS
  'Document categories (matching work_documents.document_category) that are tracked by alert systems. Empty array disables all alerts for this vehicle.';
