import { DEFAULT_ROUTE_TOLL_COSTS, RouteTollCost } from '@/constants/routeTollCosts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface DbRouteTollCost {
  id: string;
  route: string;
  toll_fee: number;
  currency: 'USD' | 'ZAR';
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch all route toll costs from database
export const useRouteTollCosts = () => {
  return useQuery({
    queryKey: ['route-toll-costs'],
    queryFn: async (): Promise<DbRouteTollCost[]> => {
      const { data, error } = await supabase
        .from('route_toll_costs' as never)
        .select('*')
        .eq('is_active', true)
        .order('route', { ascending: true });

      if (error) {
        // If table doesn't exist, return defaults
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('route_toll_costs table not found, using defaults');
          return DEFAULT_ROUTE_TOLL_COSTS.map((r, index) => ({
            id: `default-${index}`,
            route: r.route,
            toll_fee: r.toll_fee,
            currency: r.currency,
            description: r.description || null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
        }
        throw error;
      }

      // If no data in database, return defaults
      if (!data || data.length === 0) {
        return DEFAULT_ROUTE_TOLL_COSTS.map((r, index) => ({
          id: `default-${index}`,
          route: r.route,
          toll_fee: r.toll_fee,
          currency: r.currency,
          description: r.description || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
      }

      return data as DbRouteTollCost[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get a specific route toll cost
export const useRouteTollCost = (route: string) => {
  const { data: routes = [] } = useRouteTollCosts();
  return routes.find((r) => r.route === route);
};

// Add a new route toll cost
export const useAddRouteTollCost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newRoute: Omit<RouteTollCost, 'id'>) => {
      const { data, error } = await supabase
        .from('route_toll_costs' as never)
        .insert([{
          route: newRoute.route,
          toll_fee: newRoute.toll_fee,
          currency: newRoute.currency,
          description: newRoute.description || null,
          is_active: true,
        }] as never)
        .select()
        .single();

      if (error) throw error;
      return data as DbRouteTollCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-toll-costs'] });
      toast({
        title: 'Route Added',
        description: 'New route toll cost has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add route toll cost',
        variant: 'destructive',
      });
    },
  });
};

// Update an existing route toll cost
export const useUpdateRouteTollCost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbRouteTollCost> & { id: string }) => {
      const { data, error } = await supabase
        .from('route_toll_costs' as never)
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DbRouteTollCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-toll-costs'] });
      toast({
        title: 'Route Updated',
        description: 'Route toll cost has been updated. Changes will apply to future trips only.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update route toll cost',
        variant: 'destructive',
      });
    },
  });
};

// Delete (soft delete) a route toll cost
export const useDeleteRouteTollCost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('route_toll_costs' as never)
        .update({ is_active: false } as never)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-toll-costs'] });
      toast({
        title: 'Route Removed',
        description: 'Route toll cost has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove route toll cost',
        variant: 'destructive',
      });
    },
  });
};