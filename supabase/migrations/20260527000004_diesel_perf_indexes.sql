-- Cover the two hottest read patterns for diesel and reefer records:
-- chronological scans filtered by fleet/reefer. These indexes make
-- date-windowed queries (last 30/90 days for one fleet) cheap regardless
-- of how large the tables grow.

create index if not exists idx_diesel_records_fleet_date
  on public.diesel_records (fleet_number, date desc);

create index if not exists idx_diesel_records_date
  on public.diesel_records (date desc);

create index if not exists idx_reefer_diesel_records_unit_date
  on public.reefer_diesel_records (reefer_unit, date desc);

create index if not exists idx_reefer_diesel_records_date
  on public.reefer_diesel_records (date desc);
