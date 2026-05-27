import { supabase } from '@/integrations/supabase/client';
import type { DieselConsumptionRecord, TrailerFuelData } from '@/types/operations';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export interface DieselWindowOptions {
  /** Inclusive ISO date (YYYY-MM-DD). Omit for no lower bound. */
  from?: string;
  /** Inclusive ISO date (YYYY-MM-DD). Omit for no upper bound. */
  to?: string;
  /** Restrict to a specific fleet_number. */
  fleet?: string;
  /** Disable the query (e.g. while inputs are not yet ready). */
  enabled?: boolean;
}

type Row = Record<string, unknown> & { trailer_fuel_data?: unknown };

const mapRow = (row: Row): DieselConsumptionRecord => ({
  ...(row as unknown as DieselConsumptionRecord),
  trailer_fuel_data: row.trailer_fuel_data as TrailerFuelData[] | undefined,
});

/**
 * Windowed fetch of `diesel_records` for the Diesel Management page.
 *
 * Instead of loading the whole table via OperationsContext, this hook pulls
 * only the rows inside the requested date window, optionally narrowed to a
 * single fleet. Combined with the `(fleet_number, date desc)` index this
 * keeps the page responsive as history grows.
 */
export const useDieselRecordsWindow = (options: DieselWindowOptions = {}) => {
  const { from, to, fleet, enabled = true } = options;

  return useQuery<DieselConsumptionRecord[]>({
    queryKey: ['diesel-records-window', { from: from ?? null, to: to ?? null, fleet: fleet ?? null }],
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase
        .from('diesel_records')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (from) query = query.gte('date', from);
      if (to) query = query.lte('date', to);
      if (fleet) query = query.eq('fleet_number', fleet);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
};
