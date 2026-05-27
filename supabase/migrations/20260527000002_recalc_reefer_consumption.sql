-- Keep reefer_diesel_records derived fields in sync.
--
-- Whenever a row is inserted, updated, or deleted, recompute
-- previous_operating_hours, hours_operated and litres_per_hour for every
-- row belonging to the affected reefer_unit, based on the chronological
-- order of rows that have a non-null operating_hours reading.
--
-- This guarantees that editing an earlier transaction's hours or litres
-- propagates to the next transaction automatically.

create or replace function public.recalc_reefer_consumption(p_reefer_unit text)
returns void
language plpgsql
as $$
begin
  if p_reefer_unit is null then
    return;
  end if;

  with ordered as (
    select
      id,
      operating_hours,
      litres_filled,
      lag(operating_hours) over (
        partition by reefer_unit
        order by date, created_at, id
      ) as prev_hours
    from public.reefer_diesel_records
    where reefer_unit = p_reefer_unit
      and operating_hours is not null
  )
  update public.reefer_diesel_records r
  set
    previous_operating_hours = ordered.prev_hours,
    hours_operated = case
      when ordered.prev_hours is not null
       and r.operating_hours > ordered.prev_hours
      then r.operating_hours - ordered.prev_hours
      else null
    end,
    litres_per_hour = case
      when ordered.prev_hours is not null
       and r.operating_hours > ordered.prev_hours
       and coalesce(r.litres_filled, 0) > 0
      then r.litres_filled / (r.operating_hours - ordered.prev_hours)
      else null
    end
  from ordered
  where r.id = ordered.id
    and (
      r.previous_operating_hours is distinct from ordered.prev_hours
      or r.hours_operated is distinct from (
        case
          when ordered.prev_hours is not null
           and r.operating_hours > ordered.prev_hours
          then r.operating_hours - ordered.prev_hours
          else null
        end
      )
      or r.litres_per_hour is distinct from (
        case
          when ordered.prev_hours is not null
           and r.operating_hours > ordered.prev_hours
           and coalesce(r.litres_filled, 0) > 0
          then r.litres_filled / (r.operating_hours - ordered.prev_hours)
          else null
        end
      )
    );

  -- Clear derived fields on rows that have no operating_hours (they are not
  -- represented in the CTE above, so any stale values must be wiped).
  update public.reefer_diesel_records
  set
    previous_operating_hours = null,
    hours_operated = null,
    litres_per_hour = null
  where reefer_unit = p_reefer_unit
    and operating_hours is null
    and (
      previous_operating_hours is not null
      or hours_operated is not null
      or litres_per_hour is not null
    );
end;
$$;

create or replace function public.trg_recalc_reefer_consumption()
returns trigger
language plpgsql
as $$
begin
  -- Avoid recursion: the recalc itself issues UPDATEs against this table.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.recalc_reefer_consumption(old.reefer_unit);
    return old;
  end if;

  perform public.recalc_reefer_consumption(new.reefer_unit);
  if tg_op = 'UPDATE' and new.reefer_unit is distinct from old.reefer_unit then
    perform public.recalc_reefer_consumption(old.reefer_unit);
  end if;

  return new;
end;
$$;

drop trigger if exists reefer_diesel_records_recalc on public.reefer_diesel_records;
create trigger reefer_diesel_records_recalc
after insert or update or delete on public.reefer_diesel_records
for each row
execute function public.trg_recalc_reefer_consumption();

-- Backfill existing rows so historical data is consistent.
do $$
declare
  unit text;
begin
  for unit in
    select distinct reefer_unit
    from public.reefer_diesel_records
    where reefer_unit is not null
  loop
    perform public.recalc_reefer_consumption(unit);
  end loop;
end;
$$;
