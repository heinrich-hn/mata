import
  {
    DEFAULT_ROUTE_EXPENSES,
    RouteExpense,
    RoutePredefinedExpenses,
  } from '@/constants/routePredefinedExpenses';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Database types
interface DbRouteExpenseConfig {
  id: string;
  route: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbRouteExpenseItem {
  id: string;
  route_config_id: string;
  category: string;
  sub_category: string;
  amount: number;
  currency: string;
  description: string | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Combined type for fetched data
interface DbRouteExpenseConfigWithItems extends DbRouteExpenseConfig {
  route_expense_items: DbRouteExpenseItem[];
}

// Transform DB data to application type
const transformToRoutePredefinedExpenses = (
  config: DbRouteExpenseConfigWithItems
): RoutePredefinedExpenses => ({
  id: config.id,
  route: config.route,
  description: config.description || undefined,
  is_active: config.is_active,
  expenses: config.route_expense_items.map((item) => ({
    id: item.id,
    category: item.category,
    sub_category: item.sub_category,
    amount: item.amount,
    currency: item.currency,
    description: item.description || undefined,
    is_required: item.is_required,
  })),
  created_at: config.created_at,
  updated_at: config.updated_at,
});

// Hook to fetch all route expense configurations
export const useRouteExpenseConfigs = () => {
  return useQuery({
    queryKey: ['route-expense-configs'],
    queryFn: async (): Promise<RoutePredefinedExpenses[]> => {
      try {
        const { data, error } = await supabase
          .from('route_expense_configs')
          .select(`
            *,
            route_expense_items (*)
          `)
          .eq('is_active', true)
          .order('route');

        if (error) {
          console.warn('Route expense configs table not found, using defaults:', error.message);
          return DEFAULT_ROUTE_EXPENSES;
        }

        if (!data || data.length === 0) {
          return DEFAULT_ROUTE_EXPENSES;
        }

        return (data as unknown as DbRouteExpenseConfigWithItems[]).map(transformToRoutePredefinedExpenses);
      } catch {
        console.warn('Error fetching route expense configs, using defaults');
        return DEFAULT_ROUTE_EXPENSES;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook to fetch expenses for a specific route
export const useRouteExpenses = (route: string | undefined | null) => {
  return useQuery({
    queryKey: ['route-expenses', route],
    queryFn: async (): Promise<RoutePredefinedExpenses | null> => {
      if (!route) return null;

      try {
        const { data, error } = await supabase
          .from('route_expense_configs')
          .select(`
            *,
            route_expense_items (*)
          `)
          .ilike('route', route)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !data) {
          // Try to find in defaults
          const defaultRoute = DEFAULT_ROUTE_EXPENSES.find(
            (r) => r.route.toUpperCase() === route.toUpperCase()
          );
          return defaultRoute || null;
        }

        return transformToRoutePredefinedExpenses(data as unknown as DbRouteExpenseConfigWithItems);
      } catch {
        const defaultRoute = DEFAULT_ROUTE_EXPENSES.find(
          (r) => r.route.toUpperCase() === route.toUpperCase()
        );
        return defaultRoute || null;
      }
    },
    enabled: !!route,
  });
};

// Hook to add a new route expense configuration
export const useAddRouteExpenseConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Omit<RoutePredefinedExpenses, 'id' | 'created_at' | 'updated_at'>) => {
      // Insert the config
      const { data: configData, error: configError } = await supabase
        .from('route_expense_configs')
        .insert({
          route: config.route.toUpperCase(),
          description: config.description || null,
          is_active: config.is_active,
        })
        .select()
        .single();

      if (configError) throw configError;

      // Insert expense items
      if (config.expenses.length > 0) {
        const expenseItems = config.expenses.map((expense, index) => ({
          route_config_id: configData.id,
          category: expense.category,
          sub_category: expense.sub_category,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description || null,
          is_required: expense.is_required,
          display_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('route_expense_items')
          .insert(expenseItems);

        if (itemsError) throw itemsError;
      }

      return configData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-expense-configs'] });
      toast({
        title: 'Success',
        description: 'Route expense configuration added successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add route expense configuration',
        variant: 'destructive',
      });
    },
  });
};

// Hook to update a route expense configuration
export const useUpdateRouteExpenseConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<RoutePredefinedExpenses, 'id' | 'created_at' | 'updated_at'>>;
    }) => {
      // Update config
      const { error: configError } = await supabase
        .from('route_expense_configs')
        .update({
          description: updates.description,
          is_active: updates.is_active,
        })
        .eq('id', id);

      if (configError) throw configError;

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-expense-configs'] });
      toast({
        title: 'Success',
        description: 'Route expense configuration updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update route expense configuration',
        variant: 'destructive',
      });
    },
  });
};

// Hook to add an expense item to a route
export const useAddExpenseItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      routeConfigId,
      expense,
    }: {
      routeConfigId: string;
      expense: Omit<RouteExpense, 'id'>;
    }) => {
      const { data, error } = await supabase
        .from('route_expense_items')
        .insert({
          route_config_id: routeConfigId,
          category: expense.category,
          sub_category: expense.sub_category,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description || null,
          is_required: expense.is_required,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-expense-configs'] });
      queryClient.invalidateQueries({ queryKey: ['route-expenses'] });
      toast({
        title: 'Success',
        description: 'Expense item added successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add expense item',
        variant: 'destructive',
      });
    },
  });
};

// Hook to update an expense item
export const useUpdateExpenseItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<RouteExpense, 'id'>>;
    }) => {
      const { error } = await supabase
        .from('route_expense_items')
        .update({
          amount: updates.amount,
          currency: updates.currency,
          description: updates.description,
          is_required: updates.is_required,
        })
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-expense-configs'] });
      queryClient.invalidateQueries({ queryKey: ['route-expenses'] });
      toast({
        title: 'Success',
        description: 'Expense item updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update expense item',
        variant: 'destructive',
      });
    },
  });
};

// Hook to delete an expense item
export const useDeleteExpenseItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('route_expense_items').delete().eq('id', id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-expense-configs'] });
      queryClient.invalidateQueries({ queryKey: ['route-expenses'] });
      toast({
        title: 'Success',
        description: 'Expense item deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete expense item',
        variant: 'destructive',
      });
    },
  });
};