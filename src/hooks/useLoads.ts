// src/hooks/useLoads.ts

import { useToast } from "@/hooks/use-toast";
import { useWialonLoadIntegration } from "@/hooks/useWialonLoadIntegration";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

// Base Load type from generated types
type LoadRow = Database["public"]["Tables"]["loads"]["Row"];

type LoadInsert = Database["public"]["Tables"]["loads"]["Insert"];
type LoadUpdate = Database["public"]["Tables"]["loads"]["Update"];

// Extend DB row with relations + optional Wialon overlay
export interface Load extends LoadRow {
  assigned_vehicle?: {
    id: string;
    wialon_unit_id: number;
    name: string;
    registration: string | null;
  } | null;
  // Real-time Wialon GPS (not in DB, injected via hook)
  wialon_gps?: {
    lat: number;
    lng: number;
    speed: number;
    heading?: number;
    // Timestamp as string (ISO format) to match the interface
    timestamp: string;
  };
}

export const useLoads = (filters?: {
  status?: string;
  priority?: string;
  customerId?: string;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: loads = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Load[]>({
    queryKey: ["loads", filters],
    queryFn: async () => {
      let query = supabase
        .from("loads")
        .select(`
          *,
          assigned_vehicle:wialon_vehicles!fk_assigned_vehicle(
            id,
            wialon_unit_id,
            name,
            registration
          )
        `)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq(
          "status",
          filters.status as Database["public"]["Enums"]["load_status"]
        );
      }
      if (filters?.priority) {
        query = query.eq(
          "priority",
          filters.priority as Database["public"]["Enums"]["load_priority"]
        );
      }
      if (filters?.customerId) {
        query = query.eq("customer_id", filters.customerId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // IMPORTANT: do NOT call hooks here – just return DB data
      return data as Load[];
    },
    retry: 1,
    staleTime: 30_000,
  });

  // NOTE: Removed the setInterval + useWialonLoadIntegration block.
  // If you want real-time Wialon data in lists, do that at the
  // component level with a separate context/hook, not from here.

  const createLoad = useMutation<Load, Error, LoadInsert>({
    mutationFn: async (newLoad) => {
      const { data, error } = await supabase
        .from("loads")
        .insert(newLoad)
        .select(`
          *,
          assigned_vehicle:wialon_vehicles!fk_assigned_vehicle(
            id,
            wialon_unit_id,
            name,
            registration
          )
        `)
        .single();

      if (error) throw error;
      return data as Load;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      toast({
        title: "Load Created",
        description: "New load created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLoad = useMutation<Load, Error, { id: string; updates: LoadUpdate }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from("loads")
        .update(updates)
        .eq("id", id)
        .select(`
          *,
          assigned_vehicle:wialon_vehicles!fk_assigned_vehicle(
            id,
            wialon_unit_id,
            name,
            registration
          )
        `)
        .single();

      if (error) throw error;
      return data as Load;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.setQueryData<Load | null>(["load", data.id], data);
      toast({
        title: "Load Updated",
        description: "Changes saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLoad = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from("loads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      toast({
        title: "Load Deleted",
        description: "Load removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignLoad = useMutation<
    Load,
    Error,
    { loadId: string; tripId?: string; vehicleId?: string; assignedBy: string }
  >({
    mutationFn: async ({ loadId, tripId, vehicleId, assignedBy }) => {
      const { data, error } = await supabase
        .from("loads")
        .update({
          assigned_trip_id: tripId || null,
          assigned_vehicle_id: vehicleId || null,
          assigned_at: new Date().toISOString(),
          assigned_by: assignedBy,
          status: "assigned" as const,
        })
        .eq("id", loadId)
        .select(`
          *,
          assigned_vehicle:wialon_vehicles!fk_assigned_vehicle(
            id,
            wialon_unit_id,
            name,
            registration
          )
        `)
        .single();

      if (error) throw error;
      return data as Load;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.setQueryData<Load | null>(["load", data.id], data);
      toast({
        title: "Vehicle Assigned",
        description: "Load is now in transit.",
      });
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const findNearestVehicles = async (
    loadId: string,
    maxDistance: number = 500,
    limit: number = 10
  ) => {
    const { data, error } = await supabase.rpc("find_nearest_vehicles", {
      p_load_id: loadId,
      p_max_distance_km: maxDistance,
      p_limit: limit,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }

    return data;
  };

  return {
    loads,
    isLoading,
    error,
    refetch,
    createLoad: createLoad.mutate,
    createLoadAsync: createLoad.mutateAsync,
    updateLoad: updateLoad.mutate,
    updateLoadAsync: updateLoad.mutateAsync,
    deleteLoad: deleteLoad.mutate,
    assignLoad: assignLoad.mutate,
    assignLoadAsync: assignLoad.mutateAsync,
    findNearestVehicles,
    isCreating: createLoad.isPending,
    isUpdating: updateLoad.isPending,
    isDeleting: deleteLoad.isPending,
    isAssigning: assignLoad.isPending,
  };
};

// Single load with real-time GPS
export const useLoad = (loadId: string | undefined) => {
  const queryClient = useQueryClient();
  const { syncState } = useWialonLoadIntegration(loadId || "");

  const query = useQuery<Load | null>({
    queryKey: ["load", loadId],
    queryFn: async () => {
      if (!loadId) return null;

      const { data, error } = await supabase
        .from("loads")
        .select(`
          *,
          assigned_vehicle:wialon_vehicles!fk_assigned_vehicle(
            id,
            wialon_unit_id,
            name,
            registration
          )
        `)
        .eq("id", loadId)
        .single();

      if (error) throw error;
      return data as Load;
    },
    enabled: !!loadId,
  });

  // Inject live Wialon GPS into single-load cache
  useEffect(() => {
    if (!loadId || !syncState?.currentLocation) return;

    queryClient.setQueryData<Load | null>(
      ["load", loadId],
      (old): Load | null => {
        if (!old) return old;
        return {
          ...old,
          wialon_gps: {
            lat: syncState.currentLocation.lat,
            lng: syncState.currentLocation.lng,
            speed: syncState.currentLocation.speed,
            heading: syncState.currentLocation.heading,
            timestamp: typeof syncState.currentLocation.timestamp === 'string'
              ? syncState.currentLocation.timestamp
              : syncState.currentLocation.timestamp.toISOString(),
          },
        };
      }
    );
  }, [loadId, syncState?.currentLocation, queryClient]);

  return query;
};

// Dashboard stats
export const useLoadStats = () => {
  return useQuery({
    queryKey: ["load-stats"],
    queryFn: async () => {
      const { data: loads, error } = await supabase
        .from("loads")
        .select("status, priority, quoted_price, currency");

      if (error) throw error;

      const stats = {
        total: loads.length,
        pending: loads.filter((l) => l.status === "pending").length,
        assigned: loads.filter((l) => l.status === "assigned").length,
        in_transit: loads.filter((l) => l.status === "in_transit").length,
        delivered: loads.filter((l) => l.status === "delivered").length,
        cancelled: loads.filter((l) => l.status === "cancelled").length,
        high_priority: loads.filter(
          (l) => l.priority === "high" || l.priority === "urgent"
        ).length,
        total_value_zar: loads
          .filter((l) => l.currency === "ZAR")
          .reduce((sum, l) => sum + (l.quoted_price || 0), 0),
        total_value_usd: loads
          .filter((l) => l.currency === "USD")
          .reduce((sum, l) => sum + (l.quoted_price || 0), 0),
      };

      return stats;
    },
    staleTime: 60_000,
  });
};