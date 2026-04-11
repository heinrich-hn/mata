import { COST_CATEGORIES } from '@/constants/costCategories';
import { DEFAULT_ROUTE_EXPENSES } from '@/constants/routePredefinedExpenses';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Types for route predefined expenses
export interface RouteExpenseItem {
  id?: string;
  route_config_id?: string;
  category: string;
  sub_category: string;
  amount: number;
  currency: string;
  description?: string;
  is_required: boolean;
  display_order?: number;
}

export interface RouteExpenseConfig {
  id: string;
  route: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  expenses: RouteExpenseItem[];
}

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

// Helper functions
export const getMainCategories = (): string[] => {
  return Object.keys(COST_CATEGORIES);
};

export const getSubCategories = (category: string): string[] => {
  const categories = COST_CATEGORIES[category as keyof typeof COST_CATEGORIES];
  return categories ? [...categories] : [];
};

// Calculate total cost from expenses (for display purposes)
export const calculateTotalCost = (expenses: RouteExpenseItem[]): { usd: number; zar: number } => {
  return expenses.reduce(
    (acc, expense) => {
      if (expense.currency === 'USD') {
        acc.usd += expense.amount;
      } else {
        acc.zar += expense.amount;
      }
      return acc;
    },
    { usd: 0, zar: 0 }
  );
};

// Format total cost for display
export const formatTotalCost = (expenses: RouteExpenseItem[]): string => {
  const totals = calculateTotalCost(expenses);
  const parts: string[] = [];
  if (totals.usd > 0) parts.push(`$${totals.usd.toLocaleString()}`);
  if (totals.zar > 0) parts.push(`R${totals.zar.toLocaleString()}`);
  return parts.join(' + ') || '$0';
};

// Transform DEFAULT_ROUTE_EXPENSES to RouteExpenseConfig format for fallback
const transformDefaultExpenses = (): RouteExpenseConfig[] => {
  return DEFAULT_ROUTE_EXPENSES.map((route, index) => ({
    id: `default-${index}`,
    route: route.route,
    description: route.description,
    is_active: route.is_active,
    expenses: route.expenses.map((expense, expIndex) => ({
      id: `default-${index}-${expIndex}`,
      route_config_id: `default-${index}`,
      category: expense.category,
      sub_category: expense.sub_category,
      amount: expense.amount,
      currency: expense.currency,
      description: expense.description,
      is_required: expense.is_required,
    })),
  }));
};

// Fetch all route expense configurations with their items
export const useRoutePredefinedExpenses = () => {
  return useQuery({
    queryKey: ['route-predefined-expenses'],
    queryFn: async (): Promise<RouteExpenseConfig[]> => {
      // Fetch route configs
      const { data: configs, error: configError } = await supabase
        .from('route_expense_configs' as never)
        .select('*')
        .eq('is_active', true)
        .order('route', { ascending: true });

      if (configError) {
        // If table doesn't exist, fall back to default expenses
        if (configError.code === '42P01' || configError.message?.includes('does not exist')) {
          console.warn('route_expense_configs table not found, using defaults');
          return transformDefaultExpenses();
        }
        throw configError;
      }

      if (!configs || configs.length === 0) {
        // No configs in database, fall back to defaults
        return transformDefaultExpenses();
      }

      // Fetch all expense items for these configs
      const configIds = (configs as DbRouteExpenseConfig[]).map((c) => c.id);
      const { data: items, error: itemsError } = await supabase
        .from('route_expense_items' as never)
        .select('*')
        .in('route_config_id', configIds)
        .order('display_order', { ascending: true });

      if (itemsError && !itemsError.message?.includes('does not exist')) {
        throw itemsError;
      }

      const itemsByConfig = ((items as DbRouteExpenseItem[]) || []).reduce(
        (acc, item) => {
          if (!acc[item.route_config_id]) {
            acc[item.route_config_id] = [];
          }
          acc[item.route_config_id].push({
            id: item.id,
            route_config_id: item.route_config_id,
            category: item.category,
            sub_category: item.sub_category,
            amount: item.amount,
            currency: item.currency,
            description: item.description || undefined,
            is_required: item.is_required,
            display_order: item.display_order,
          });
          return acc;
        },
        {} as Record<string, RouteExpenseItem[]>
      );

      return (configs as DbRouteExpenseConfig[]).map((config) => ({
        id: config.id,
        route: config.route,
        description: config.description || undefined,
        is_active: config.is_active,
        created_at: config.created_at,
        updated_at: config.updated_at,
        expenses: itemsByConfig[config.id] || [],
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get a specific route's expenses
export const useRouteExpenses = (route: string) => {
  const { data: configs = [] } = useRoutePredefinedExpenses();
  return configs.find((c) => c.route === route);
};

// Add a new route expense configuration
export const useAddRouteExpenseConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      route: string;
      description?: string;
      expenses: Omit<RouteExpenseItem, 'id' | 'route_config_id'>[];
    }) => {
      // Insert the config first
      const { data: config, error: configError } = await supabase
        .from('route_expense_configs' as never)
        .insert([
          {
            route: data.route,
            description: data.description || null,
            is_active: true,
          },
        ] as never)
        .select()
        .single();

      if (configError) throw configError;

      const configId = (config as DbRouteExpenseConfig).id;

      // Insert expense items if any
      if (data.expenses.length > 0) {
        const itemsToInsert = data.expenses.map((expense, index) => ({
          route_config_id: configId,
          category: expense.category,
          sub_category: expense.sub_category,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description || null,
          is_required: expense.is_required,
          display_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('route_expense_items' as never)
          .insert(itemsToInsert as never);

        if (itemsError) throw itemsError;
      }

      return config as DbRouteExpenseConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-predefined-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['route-toll-costs'] }); // Keep backward compat
      toast({
        title: 'Route Added',
        description: 'New route expense configuration has been added successfully.',
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

// Update a route expense configuration
export const useUpdateRouteExpenseConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      description?: string;
      expenses: Omit<RouteExpenseItem, 'route_config_id'>[];
    }) => {
      // Update the config
      const { error: configError } = await supabase
        .from('route_expense_configs' as never)
        .update({ description: data.description || null } as never)
        .eq('id', data.id);

      if (configError) throw configError;

      // Delete existing expense items
      const { error: deleteError } = await supabase
        .from('route_expense_items' as never)
        .delete()
        .eq('route_config_id', data.id);

      if (deleteError && !deleteError.message?.includes('does not exist')) {
        throw deleteError;
      }

      // Insert new expense items
      if (data.expenses.length > 0) {
        const itemsToInsert = data.expenses.map((expense, index) => ({
          route_config_id: data.id,
          category: expense.category,
          sub_category: expense.sub_category,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description || null,
          is_required: expense.is_required,
          display_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('route_expense_items' as never)
          .insert(itemsToInsert as never);

        if (itemsError) throw itemsError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-predefined-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['route-toll-costs'] }); // Keep backward compat
      toast({
        title: 'Route Updated',
        description: 'Route expense configuration has been updated. Changes will apply to future trips only.',
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

// Delete a route expense configuration
export const useDeleteRouteExpenseConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('route_expense_configs' as never)
        .update({ is_active: false } as never)
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-predefined-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['route-toll-costs'] }); // Keep backward compat
      toast({
        title: 'Route Deleted',
        description: 'Route expense configuration has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete route expense configuration',
        variant: 'destructive',
      });
    },
  });
};