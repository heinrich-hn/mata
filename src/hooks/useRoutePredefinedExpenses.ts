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
  rate_type: 'per_load' | 'per_km';
  rate_amount: number;
  rate_currency: string;
  created_at?: string;
  updated_at?: string;
  expenses: RouteExpenseItem[];
}

export interface RouteRateHistoryEntry {
  id: string;
  route_config_id: string;
  rate_type: 'per_load' | 'per_km';
  rate_amount: number;
  rate_currency: string;
  previous_rate_type: 'per_load' | 'per_km' | null;
  previous_rate_amount: number | null;
  previous_rate_currency: string | null;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
}

// Database types
interface DbRouteExpenseConfig {
  id: string;
  route: string;
  description: string | null;
  is_active: boolean;
  rate_type: 'per_load' | 'per_km' | null;
  rate_amount: number | null;
  rate_currency: string | null;
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
    rate_type: 'per_load' as const,
    rate_amount: 0,
    rate_currency: 'USD',
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
        rate_type: (config.rate_type ?? 'per_load') as 'per_load' | 'per_km',
        rate_amount: Number(config.rate_amount ?? 0),
        rate_currency: config.rate_currency ?? 'USD',
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
      rate_type?: 'per_load' | 'per_km';
      rate_amount?: number;
      rate_currency?: string;
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
            rate_type: data.rate_type || 'per_load',
            rate_amount: data.rate_amount ?? 0,
            rate_currency: data.rate_currency || 'USD',
          },
        ] as never)
        .select()
        .single();

      if (configError) throw configError;

      const configId = (config as DbRouteExpenseConfig).id;

      // Seed initial rate-history entry so the timeline always reflects the starting rate.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from('route_rate_history' as never)
          .insert([
            {
              route_config_id: configId,
              rate_type: data.rate_type || 'per_load',
              rate_amount: data.rate_amount ?? 0,
              rate_currency: data.rate_currency || 'USD',
              previous_rate_type: null,
              previous_rate_amount: null,
              previous_rate_currency: null,
              changed_by: user?.email || null,
              notes: 'Initial rate',
            },
          ] as never);
      } catch (e) {
        console.warn('Failed to seed rate history:', e);
      }

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
      rate_type?: 'per_load' | 'per_km';
      rate_amount?: number;
      rate_currency?: string;
      rate_change_notes?: string;
      expenses: Omit<RouteExpenseItem, 'route_config_id'>[];
    }) => {
      // Read the current rate so we can record a delta in history if it changed.
      const { data: existing } = await supabase
        .from('route_expense_configs' as never)
        .select('rate_type, rate_amount, rate_currency')
        .eq('id', data.id)
        .single();

      const prev = existing as Pick<DbRouteExpenseConfig, 'rate_type' | 'rate_amount' | 'rate_currency'> | null;

      // Update the config
      const updatePayload: Record<string, unknown> = {
        description: data.description || null,
      };
      if (data.rate_type !== undefined) updatePayload.rate_type = data.rate_type;
      if (data.rate_amount !== undefined) updatePayload.rate_amount = data.rate_amount;
      if (data.rate_currency !== undefined) updatePayload.rate_currency = data.rate_currency;

      const { error: configError } = await supabase
        .from('route_expense_configs' as never)
        .update(updatePayload as never)
        .eq('id', data.id);

      if (configError) throw configError;

      // If any rate field changed, append a history entry so future loads can be traced.
      if (prev && (
        (data.rate_type !== undefined && data.rate_type !== prev.rate_type) ||
        (data.rate_amount !== undefined && Number(data.rate_amount) !== Number(prev.rate_amount ?? 0)) ||
        (data.rate_currency !== undefined && data.rate_currency !== prev.rate_currency)
      )) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase
            .from('route_rate_history' as never)
            .insert([
              {
                route_config_id: data.id,
                rate_type: data.rate_type ?? prev.rate_type ?? 'per_load',
                rate_amount: data.rate_amount ?? Number(prev.rate_amount ?? 0),
                rate_currency: data.rate_currency ?? prev.rate_currency ?? 'USD',
                previous_rate_type: prev.rate_type,
                previous_rate_amount: prev.rate_amount,
                previous_rate_currency: prev.rate_currency,
                changed_by: user?.email || null,
                notes: data.rate_change_notes || null,
              },
            ] as never);
        } catch (e) {
          console.warn('Failed to log rate history:', e);
        }
      }

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

// Fetch rate change history for a route configuration
export const useRouteRateHistory = (configId: string | null) => {
  return useQuery({
    queryKey: ['route-rate-history', configId],
    enabled: !!configId && !configId.startsWith('default-'),
    queryFn: async (): Promise<RouteRateHistoryEntry[]> => {
      const { data, error } = await supabase
        .from('route_rate_history' as never)
        .select('*')
        .eq('route_config_id', configId as string)
        .order('changed_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return [];
        }
        throw error;
      }

      return ((data as unknown as RouteRateHistoryEntry[]) || []).map((row) => ({
        ...row,
        rate_amount: Number(row.rate_amount),
        previous_rate_amount:
          row.previous_rate_amount === null ? null : Number(row.previous_rate_amount),
      }));
    },
  });
};