/**
 * Custom hook for managing saved routes in the database
 * Integrates with load management and route planning
 */

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SavedRoute {
  id: string;
  name: string;
  description: string | null;
  waypoints: RouteWaypoint[];
  total_distance_km: number;
  estimated_duration_mins: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  is_template: boolean;
  usage_count: number;
}

export interface RouteWaypoint {
  id: string;
  sequence: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'pickup' | 'delivery' | 'stop';
  geofence_id?: string;
  estimated_time_mins?: number;
}

export interface CreateRouteData {
  name: string;
  description?: string;
  waypoints: Omit<RouteWaypoint, 'id'>[];
  total_distance_km: number;
  estimated_duration_mins: number;
  is_template?: boolean;
}

export const useSavedRoutes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all saved routes
  const { data: routes = [], isLoading, error } = useQuery({
    queryKey: ['saved-routes'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('saved_routes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as SavedRoute[];
    },
    retry: false,
  });

  // Create new route
  const createRoute = useMutation({
    mutationFn: async (routeData: CreateRouteData) => {
      const { data: { user } } = await supabase.auth.getUser();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('saved_routes')
        .insert({
          name: routeData.name,
          description: routeData.description || null,
          waypoints: routeData.waypoints,
          total_distance_km: routeData.total_distance_km,
          estimated_duration_mins: routeData.estimated_duration_mins,
          created_by: user?.id || null,
          is_template: routeData.is_template || false,
          usage_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SavedRoute;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-routes'] });
      toast({
        title: "Route Saved",
        description: `"${data.name}" has been saved successfully.`,
      });
    },
    onError: (error) => {
      console.error('Failed to save route:', error);
      toast({
        title: "Error",
        description: "Failed to save route. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update existing route
  const updateRoute = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateRouteData> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('saved_routes')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SavedRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-routes'] });
      toast({
        title: "Route Updated",
        description: "Route has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Failed to update route:', error);
      toast({
        title: "Error",
        description: "Failed to update route. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete route
  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('saved_routes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-routes'] });
      toast({
        title: "Route Deleted",
        description: "Route has been removed from your saved routes.",
      });
    },
    onError: (error) => {
      console.error('Failed to delete route:', error);
      toast({
        title: "Error",
        description: "Failed to delete route. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Increment usage count when route is used
  const incrementUsageCount = useMutation({
    mutationFn: async (id: string) => {
      // Use RPC function from migration (not yet in generated types)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('increment_route_usage', {
        route_id: id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-routes'] });
    },
  });

  // Load route template for reuse
  const loadRouteTemplate = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      incrementUsageCount.mutate(routeId);
      return route;
    }
    return null;
  };

  return {
    routes,
    isLoading,
    error,
    createRoute: createRoute.mutate,
    isCreating: createRoute.isPending,
    updateRoute: updateRoute.mutate,
    isUpdating: updateRoute.isPending,
    deleteRoute: deleteRoute.mutate,
    isDeleting: deleteRoute.isPending,
    loadRouteTemplate,
  };
};