import type { ReeferDieselRecord } from '@/components/diesel/ReeferDieselEntryModal';
import { useToast } from '@/hooks/use-toast';
import { requestGoogleSheetsSync } from '@/hooks/useGoogleSheetsSync';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Define database row type since table is new (migration pending)
export interface ReeferDieselRecordRow {
  id: string;
  reefer_unit: string;
  date: string;
  fuel_station: string;
  litres_filled: number;
  cost_per_litre: number | null;
  total_cost: number;
  currency: string;
  operating_hours: number | null;
  previous_operating_hours: number | null;
  hours_operated: number | null;
  litres_per_hour: number | null;
  linked_diesel_record_id: string | null;
  linked_horse: string | null;
  linked_horse_id: string | null;
  trip_id: string | null;
  cost_entry_ids: string[] | null;
  driver_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Linked diesel record info (for display purposes)
export interface LinkedDieselRecordInfo {
  id: string;
  fleet_number: string;
  driver_name: string | null;
  date: string;
  litres_filled: number;
  total_cost: number;
  fuel_station: string;
  trip_id: string | null;
}

export interface ReeferConsumptionSummary {
  reefer_unit: string;
  total_litres_filled: number;
  total_cost: number;
  total_hours_operated: number;
  avg_litres_per_hour: number;
  fill_count: number;
  first_fill_date: string;
  last_fill_date: string;
}

export interface ReeferConsumptionByTruck {
  fleet_number: string;
  driver_name: string | null;
  reefer_units: string[];
  total_reefer_litres: number;
  total_reefer_cost: number;
  total_truck_cost: number;
  combined_cost: number;
  fill_count: number;
}

interface UseReeferDieselRecordsOptions {
  reeferUnit?: string;
  linkedDieselId?: string;
  startDate?: string;
  endDate?: string;
}

const getReeferTable = () => supabase.from('reefer_diesel_records');

interface DieselRecordRow {
  id: string;
  fleet_number: string;
  cost_per_litre: number | null;
  litres_filled: number | null;
  total_cost: number | null;
  driver_name: string | null;
  date: string;
  [key: string]: unknown;
}

export const useReeferDieselRecords = (options: UseReeferDieselRecordsOptions = {}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch reefer diesel records
  const {
    data: records = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reefer-diesel-records', options],
    queryFn: async () => {
      let query = getReeferTable()
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options.reeferUnit) {
        query = query.eq('reefer_unit', options.reeferUnit);
      }

      if (options.linkedDieselId) {
        query = query.eq('linked_diesel_record_id', options.linkedDieselId);
      }

      if (options.startDate) {
        query = query.gte('date', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('date', options.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ReeferDieselRecordRow[];
    },
  });

  // Create reefer diesel record
  const createMutation = useMutation({
    mutationFn: async (record: ReeferDieselRecord) => {
      const { id: _id, ...insertData } = record;
      const { data, error } = await getReeferTable()
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data as ReeferDieselRecordRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reefer-diesel-records'] });
      queryClient.invalidateQueries({ queryKey: ['reefer-consumption-summary'] });
      queryClient.invalidateQueries({ queryKey: ['reefer-consumption-by-horse'] });
      toast({ title: 'Success', description: 'Reefer diesel record added' });
      requestGoogleSheetsSync('diesel');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update reefer diesel record
  const updateMutation = useMutation({
    mutationFn: async (record: ReeferDieselRecord) => {
      if (!record.id) throw new Error('Record ID is required for update');

      const { id, ...updateData } = record;
      const { data, error } = await getReeferTable()
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ReeferDieselRecordRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reefer-diesel-records'] });
      queryClient.invalidateQueries({ queryKey: ['reefer-consumption-summary'] });
      queryClient.invalidateQueries({ queryKey: ['reefer-consumption-by-horse'] });
      toast({ title: 'Success', description: 'Reefer diesel record updated' });
      requestGoogleSheetsSync('diesel');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete reefer diesel record
  const deleteMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await getReeferTable()
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      return recordId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reefer-diesel-records'] });
      queryClient.invalidateQueries({ queryKey: ['reefer-consumption-summary'] });
      queryClient.invalidateQueries({ queryKey: ['reefer-consumption-by-truck'] });
      toast({ title: 'Success', description: 'Reefer diesel record deleted' });
      requestGoogleSheetsSync('diesel');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Link reefer record to truck diesel transaction
  const linkToDieselRecordMutation = useMutation({
    mutationFn: async ({ recordId, dieselRecordId }: { recordId: string; dieselRecordId: string | null }) => {
      const { data, error } = await getReeferTable()
        .update({ linked_diesel_record_id: dieselRecordId })
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw error;
      return data as ReeferDieselRecordRow;
    },
    onSuccess: (_, { dieselRecordId }) => {
      queryClient.invalidateQueries({ queryKey: ['reefer-diesel-records'] });
      queryClient.invalidateQueries({ queryKey: ['reefer-consumption-by-truck'] });
      toast({
        title: 'Success',
        description: dieselRecordId
          ? 'Reefer record linked to truck diesel transaction'
          : 'Reefer record unlinked',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    records,
    isLoading,
    error,
    refetch,
    createRecord: createMutation.mutate,
    createRecordAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateRecord: updateMutation.mutate,
    updateRecordAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteRecord: deleteMutation.mutate,
    deleteRecordAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    linkToDieselRecord: linkToDieselRecordMutation.mutate,
    isLinkingToDieselRecord: linkToDieselRecordMutation.isPending,
    linkToVehicleAsync: async ({ recordId, dieselRecordId, fleetNumber }: { recordId: string; dieselRecordId: string; fleetNumber: string }) => {
      const { data, error } = await getReeferTable()
        .update({ linked_diesel_record_id: dieselRecordId, linked_horse: fleetNumber })
        .eq('id', recordId)
        .select()
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['reefer-diesel-records'] });
      return data as ReeferDieselRecordRow;
    },
    unlinkFromVehicleAsync: async ({ recordId }: { recordId: string }) => {
      const { data, error } = await getReeferTable()
        .update({ linked_diesel_record_id: null, linked_horse: null, linked_horse_id: null, trip_id: null, cost_entry_ids: null })
        .eq('id', recordId)
        .select()
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['reefer-diesel-records'] });
      return data as ReeferDieselRecordRow;
    },
  };
};

// Hook for reefer consumption summary (per reefer unit)
// L/hr is calculated by: total litres / (max hour meter - min hour meter)
export const useReeferConsumptionSummary = () => {
  return useQuery({
    queryKey: ['reefer-consumption-summary'],
    queryFn: async () => {
      const { data, error } = await getReeferTable()
        .select('*')
        .order('reefer_unit');

      if (error) throw error;

      // Group by reefer unit and track hour meter readings for L/hr calculation
      interface SummaryAccumulator extends ReeferConsumptionSummary {
        min_operating_hours: number | null;
        max_operating_hours: number | null;
      }
      const summaryMap = new Map<string, SummaryAccumulator>();

      ((data || []) as ReeferDieselRecordRow[]).forEach((record) => {
        const existing = summaryMap.get(record.reefer_unit);
        const opHours = record.operating_hours;

        if (existing) {
          existing.total_litres_filled += record.litres_filled || 0;
          existing.total_cost += record.total_cost || 0;
          existing.fill_count += 1;

          // Track min/max hour meter readings for this reefer
          if (opHours !== null && opHours !== undefined) {
            if (existing.min_operating_hours === null || opHours < existing.min_operating_hours) {
              existing.min_operating_hours = opHours;
            }
            if (existing.max_operating_hours === null || opHours > existing.max_operating_hours) {
              existing.max_operating_hours = opHours;
            }
          }

          if (record.date < existing.first_fill_date) {
            existing.first_fill_date = record.date;
          }
          if (record.date > existing.last_fill_date) {
            existing.last_fill_date = record.date;
          }
        } else {
          summaryMap.set(record.reefer_unit, {
            reefer_unit: record.reefer_unit,
            total_litres_filled: record.litres_filled || 0,
            total_cost: record.total_cost || 0,
            total_hours_operated: 0, // Will be calculated below
            avg_litres_per_hour: 0,
            fill_count: 1,
            first_fill_date: record.date,
            last_fill_date: record.date,
            min_operating_hours: opHours ?? null,
            max_operating_hours: opHours ?? null,
          });
        }
      });

      // Calculate hours operated (max - min hour meter) and avg L/hr
      const results: ReeferConsumptionSummary[] = [];
      summaryMap.forEach((summary) => {
        // Hours operated = difference between max and min hour meter readings
        if (summary.min_operating_hours !== null && summary.max_operating_hours !== null) {
          summary.total_hours_operated = summary.max_operating_hours - summary.min_operating_hours;
        }

        // Calculate L/hr = total litres / hours operated
        if (summary.total_hours_operated > 0) {
          summary.avg_litres_per_hour = summary.total_litres_filled / summary.total_hours_operated;
        }

        // Remove internal tracking fields before returning
        const { min_operating_hours: _min_operating_hours, max_operating_hours: _max_operating_hours, ...cleanSummary } = summary;
        results.push(cleanSummary);
      });

      return results;
    },
  });
};

// Hook for consumption grouped by linked truck diesel record
export const useReeferConsumptionByTruck = () => {
  return useQuery({
    queryKey: ['reefer-consumption-by-truck'],
    queryFn: async () => {
      // First get reefer records with linked diesel records
      const { data: reeferData, error: reeferError } = await getReeferTable()
        .select('*')
        .not('linked_diesel_record_id', 'is', null);

      if (reeferError) throw reeferError;

      // Get unique diesel record IDs
      const dieselRecordIds = [...new Set(
        ((reeferData || []) as ReeferDieselRecordRow[])
          .map(r => r.linked_diesel_record_id)
          .filter(Boolean) as string[]
      )];

      if (dieselRecordIds.length === 0) return [];

      // Fetch the linked diesel records
      const { data: dieselData, error: dieselError } = await supabase
        .from('diesel_records')
        .select('*')
        .in('id', dieselRecordIds);

      if (dieselError) throw dieselError;

      // Create a map of diesel records by ID
      const dieselMap = new Map((dieselData || []).map((d: DieselRecordRow) => [d.id, d]));

      // Group reefer records by linked diesel record
      const summaryMap = new Map<string, ReeferConsumptionByTruck>();

      ((reeferData || []) as ReeferDieselRecordRow[]).forEach((record) => {
        if (!record.linked_diesel_record_id) return;

        const dieselRecord = dieselMap.get(record.linked_diesel_record_id) as DieselRecordRow | undefined;
        if (!dieselRecord) return;

        const key = dieselRecord.fleet_number;
        const existing = summaryMap.get(key);

        // Calculate reefer cost using the linked diesel record's cost_per_litre
        // This ensures the reefer cost reflects the actual unit price at fill-up
        const linkedCostPerLitre = dieselRecord.cost_per_litre || record.cost_per_litre || 0;
        const reeferCost = (record.litres_filled || 0) * linkedCostPerLitre;

        if (existing) {
          existing.total_reefer_litres += record.litres_filled || 0;
          existing.total_reefer_cost += reeferCost;
          existing.combined_cost = existing.total_truck_cost + existing.total_reefer_cost;
          existing.fill_count += 1;
          if (!existing.reefer_units.includes(record.reefer_unit)) {
            existing.reefer_units.push(record.reefer_unit);
          }
        } else {
          summaryMap.set(key, {
            fleet_number: dieselRecord.fleet_number,
            driver_name: dieselRecord.driver_name,
            reefer_units: [record.reefer_unit],
            total_reefer_litres: record.litres_filled || 0,
            total_reefer_cost: reeferCost,
            total_truck_cost: dieselRecord.total_cost || 0,
            combined_cost: (dieselRecord.total_cost || 0) + reeferCost,
            fill_count: 1,
          });
        }
      });

      return Array.from(summaryMap.values());
    },
  });
};

// Hook to fetch available truck diesel records for linking
export const useTruckDieselRecordsForLinking = (options: {
  startDate?: string;
  endDate?: string;
  fleetNumber?: string;
} = {}) => {
  return useQuery({
    queryKey: ['truck-diesel-for-linking', options],
    queryFn: async () => {
      let query = supabase
        .from('diesel_records')
        .select('id, fleet_number, driver_name, date, litres_filled, total_cost, fuel_station, trip_id')
        .order('date', { ascending: false })
        .limit(100);

      if (options.startDate) {
        query = query.gte('date', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('date', options.endDate);
      }
      if (options.fleetNumber) {
        query = query.eq('fleet_number', options.fleetNumber);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as LinkedDieselRecordInfo[];
    },
  });
};