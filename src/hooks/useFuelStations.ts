import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface FuelStation {
  id: string;
  name: string;
  location?: string;
  address?: string;
  price_per_litre?: number;
  currency?: string;
  is_active: boolean;
  created_at: string;
}

// Fetch saved fuel stations from fuel_stations table
export const useFuelStations = (onlyActive = true) => {
  return useQuery<FuelStation[]>({
    queryKey: ['fuel_stations', onlyActive],
    queryFn: async (): Promise<FuelStation[]> => {
      try {
        let query = supabase
          .from('fuel_stations')
          .select('*')
          .order('name');

        if (onlyActive) {
          query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
          // Table might not exist yet, return empty array
          console.warn('Error fetching fuel stations:', error.message);
          return [];
        }

        return (data || []) as FuelStation[];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch unique fuel station names from diesel_records (historical stations)
export const useHistoricalFuelStations = () => {
  return useQuery<string[]>({
    queryKey: ['historical_fuel_stations'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('diesel_records')
        .select('fuel_station')
        .not('fuel_station', 'is', null)
        .order('fuel_station');

      if (error) throw error;

      // Get unique station names
      const uniqueStations = [...new Set((data || []).map(d => d.fuel_station).filter(Boolean))];
      return uniqueStations;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Add a new fuel station
export const useAddFuelStation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (station: Omit<FuelStation, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('fuel_stations')
        .insert([station])
        .select()
        .single();

      if (error) throw error;
      return data as FuelStation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_stations'] });
      toast.success('Filling station saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save station: ${error.message}`);
    },
  });
};

// Update a fuel station
export const useUpdateFuelStation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FuelStation> & { id: string }) => {
      const { data, error } = await supabase
        .from('fuel_stations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as FuelStation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_stations'] });
      toast.success('Station updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update station: ${error.message}`);
    },
  });
};

// Delete (deactivate) a fuel station
export const useDeleteFuelStation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fuel_stations')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_stations'] });
      toast.success('Station removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove station: ${error.message}`);
    },
  });
};