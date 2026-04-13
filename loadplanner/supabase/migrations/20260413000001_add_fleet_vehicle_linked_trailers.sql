-- Add linked trailer columns to fleet_vehicles table
-- A Horse vehicle can optionally link to a Reefer and/or Interlink trailer
-- These are self-referencing FKs used only for PDF export display
ALTER TABLE public.fleet_vehicles ADD COLUMN
IF NOT EXISTS linked_reefer_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.fleet_vehicles ADD COLUMN
IF NOT EXISTS linked_interlink_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL;
