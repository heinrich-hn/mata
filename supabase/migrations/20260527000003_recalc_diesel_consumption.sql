-- Keep diesel_records (horse / truck fills) derived fields in sync.
--
-- Whenever a row is inserted, updated, or deleted, recompute
-- previous_km_reading, distance_travelled and km_per_litre for every row
-- belonging to the affected fleet_number, based on the chronological order
-- of fills.
--
-- This mirrors the cascade implemented for reefer_diesel_records, so editing
-- an earlier transaction's km_reading, litres_filled or vehicle_litres_only
-- propagates to the next transaction automatically.

create or replace function public.recalc_diesel_consumption(p_fleet_number text)
returns void
language plpgsql
as $$
begin
  if p_fleet_number is null then
    return;
  end if;

  with ordered as (
    select
      id,
      km_reading,
      litres_filled,
      vehicle_litres_only,
      lag(km_reading) over (
        partition by fleet_number
        order by date, created_at, id
      ) as prev_km
    from public.diesel_records
    where fleet_number = p_fleet_number
      and km_reading is not null
  ),
  computed as (
    select
      id,
      prev_km,
      case
        when prev_km is not null and km_reading > prev_km
        then km_reading - prev_km
        else null
      end as new_distance,
      case
        when prev_km is not null
         and km_reading > prev_km
         and coalesce(vehicle_litres_only, litres_filled, 0) > 0
        then (km_reading - prev_km)::numeric
             / coalesce(vehicle_litres_only, litres_filled)
        else null
      end as new_kmpl
    from ordered
  )
  update public.diesel_records r
  set
    previous_km_reading = computed.prev_km,
    distance_travelled = computed.new_distance,
    km_per_litre = computed.new_kmpl
  from computed
  where r.id = computed.id
    and (
      r.previous_km_reading is distinct from computed.prev_km
      or r.distance_travelled is distinct from computed.new_distance
      or r.km_per_litre is distinct from computed.new_kmpl
    );
end;
$$;

create or replace function public.trg_recalc_diesel_consumption()
returns trigger
language plpgsql
as $$
begin
  -- Avoid recursion: this trigger issues UPDATEs against the same table.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.recalc_diesel_consumption(old.fleet_number);
    return old;
  end if;

  perform public.recalc_diesel_consumption(new.fleet_number);
  if tg_op = 'UPDATE' and new.fleet_number is distinct from old.fleet_number then
    perform public.recalc_diesel_consumption(old.fleet_number);
  end if;

  return new;
end;
$$;

drop trigger if exists diesel_records_recalc on public.diesel_records;
create trigger diesel_records_recalc
after insert or update or delete on public.diesel_records
for each row
execute function public.trg_recalc_diesel_consumption();

-- Backfill existing rows so historical data is consistent.
do $$
declare
  fleet text;
begin
  for fleet in
    select distinct fleet_number
    from public.diesel_records
    where fleet_number is not null
  loop
    perform public.recalc_diesel_consumption(fleet);
  end loop;
end;
$$;
