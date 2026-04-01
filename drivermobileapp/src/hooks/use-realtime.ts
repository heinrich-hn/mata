import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

// NOTE: Do NOT create a module-level supabase client here.
// Always call createClient() inside hooks/components so the singleton
// is accessed after the auth session is available.

export interface Vehicle {
  id: string;
  fleet_number: string;
  registration_number: string;
  make: string;
  model: string;
  vehicle_type: string;
  tonnage?: number;
  active: boolean;
}

export interface DriverVehicleAssignment {
  id: string;
  driver_id: string;
  vehicle_id: string;
  assigned_at: string;
  is_active: boolean;
  unassigned_at?: string | null;
  notes?: string | null;
  vehicle?: Vehicle;
}

/**
 * Hook to fetch all available vehicles
 */
export function useVehicles() {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, fleet_number, registration_number, make, model, vehicle_type, tonnage, active')
        .eq('active', true)
        .order('fleet_number');

      if (error) {
        console.error('Error fetching vehicles:', error);
        throw error;
      }

      return (data || []).map((row: Record<string, unknown>): Vehicle => ({
        id: row.id as string,
        fleet_number: (row.fleet_number || '') as string,
        registration_number: row.registration_number as string,
        make: row.make as string,
        model: row.model as string,
        vehicle_type: row.vehicle_type as string,
        tonnage: row.tonnage as number | undefined,
        active: (row.active ?? true) as boolean,
      }));
    },
  });
}

/**
 * Hook to get the current driver's assigned vehicle.
 * Accepts the driver's auth user ID directly to avoid a redundant
 * supabase.auth.getUser() network round-trip on every render.
 */
export function useDriverAssignedVehicle(driverId?: string) {
  const supabase = useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ['driver-assigned-vehicle', driverId],
    queryFn: async (): Promise<Vehicle | null> => {
      if (!driverId) return null;

      const TRUCK_TYPES = ['truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck'];

      // Fetch all active assignments to find the truck
      const { data: assignments, error: assignmentError } = await supabase
        .from('driver_vehicle_assignments')
        .select(`
          *,
          vehicles (id, fleet_number, registration_number, make, model, vehicle_type, tonnage, active)
        `)
        .eq('driver_id', driverId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (!assignmentError && assignments && assignments.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = assignments as any[];
        // Prefer truck over reefer/trailer
        const truckRow = rows.find((r: { vehicles?: { vehicle_type?: string } }) => {
          const vt = r.vehicles?.vehicle_type;
          return !vt || TRUCK_TYPES.includes(vt);
        }) || rows[0];

        const v = truckRow.vehicles as Record<string, unknown>;
        if (v) {
          return {
            id: v.id as string,
            fleet_number: (v.fleet_number || '') as string,
            registration_number: v.registration_number as string,
            make: v.make as string,
            model: v.model as string,
            vehicle_type: v.vehicle_type as string,
            tonnage: v.tonnage as number | undefined,
            active: (v.active ?? true) as boolean,
          };
        }
      }

      // Fallback: Check user metadata for assigned vehicle
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const vehicleId = authUser?.user_metadata?.assigned_vehicle_id;
      if (vehicleId) {
        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id, fleet_number, registration_number, make, model, vehicle_type, tonnage, active')
          .eq('id', vehicleId)
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vehicleData = vehicle as any;
        if (!vehicleError && vehicleData) {
          return {
            id: vehicleData.id as string,
            fleet_number: (vehicleData.fleet_number || '') as string,
            registration_number: vehicleData.registration_number as string,
            make: vehicleData.make as string,
            model: vehicleData.model as string,
            vehicle_type: vehicleData.vehicle_type as string,
            tonnage: vehicleData.tonnage as number | undefined,
            active: (vehicleData.active ?? true) as boolean,
          };
        }
      }

      return null;
    },
    enabled: !!driverId,
  });
}

/**
 * Hook to assign a vehicle to the current driver
 */
export function useAssignVehicle() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vehicleId: string): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // First, mark any existing assignments as not current
      await supabase
        .from('driver_vehicle_assignments')
        .update({ is_active: false, unassigned_at: new Date().toISOString() } as never)
        .eq('driver_id', user.id)
        .eq('is_active', true);

      // Create new assignment
      const { error: insertError } = await supabase
        .from('driver_vehicle_assignments')
        .insert({
          driver_id: user.id,
          vehicle_id: vehicleId,
          is_active: true,
          assigned_at: new Date().toISOString(),
        } as never);

      if (insertError) {
        // Table might not exist, try updating user metadata instead
        console.log('Assignment table not available, using user metadata');

        const { error: updateError } = await supabase.auth.updateUser({
          data: { assigned_vehicle_id: vehicleId }
        });

        if (updateError) {
          throw updateError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-assigned-vehicle'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

/**
 * Hook to unassign current vehicle from driver
 */
export function useUnassignVehicle() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Mark current assignment as inactive
      await supabase
        .from('driver_vehicle_assignments')
        .update({ is_active: false, unassigned_at: new Date().toISOString() } as never)
        .eq('driver_id', user.id)
        .eq('is_active', true);

      // Also clear from user metadata
      await supabase.auth.updateUser({
        data: { assigned_vehicle_id: null }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-assigned-vehicle'] });
    },
  });
}

/**
 * Hook to fetch loads assigned to the driver's vehicle.
 * Uses the realtime subscription (useLoadAssignmentSubscription) for live
 * updates instead of polling, to avoid a waterfall of sequential network calls.
 */
export function useAssignedLoads(driverId?: string) {
  const supabase = useMemo(() => createClient(), []);
  const { data: vehicle } = useDriverAssignedVehicle(driverId);

  return useQuery({
    queryKey: ['assigned-loads', vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('assigned_vehicle_id', vehicle.id)
        .in('status', ['pending', 'assigned', 'in_transit', 'loading', 'offloading'])
        .order('pickup_datetime', { ascending: true });

      if (error) {
        console.error('Error fetching assigned loads:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!vehicle?.id,
    // No polling — use useLoadAssignmentSubscription(vehicle?.id) alongside
    // this hook for real-time updates without the waterfall overhead.
  });
}

// ============================================
// Real-time Subscription Hooks
// ============================================

/**
 * Generic real-time subscription hook
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
  tableName: string,
  queryKey: string[],
  filter?: { column: string; value: string | undefined }
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (filter && !filter.value) return;

    const supabase = createClient();
    const channelName = filter
      ? `${tableName}-${filter.column}-${filter.value}`
      : `${tableName}-all`;

    const channel = supabase
      .channel(channelName)
      .on<T>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          console.log(`[Realtime] ${tableName} change:`, payload.eventType);
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, queryKey, filter?.value, queryClient]);
}

/**
 * Real-time sync for diesel records - invalidates query cache on changes.
 * Filtered to only watch records for the driver's fleet_number.
 */
export function useDieselRealtimeSync(driverId: string | undefined, fleetNumber?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!driverId || !fleetNumber) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`diesel-sync-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'diesel_records',
          filter: `fleet_number=eq.${fleetNumber}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['diesel-records'] });
          queryClient.invalidateQueries({ queryKey: ['recent-diesel'] });
          queryClient.invalidateQueries({ queryKey: ['monthly-diesel-records'] });
          queryClient.invalidateQueries({ queryKey: ['recent-diesel-records'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, fleetNumber, queryClient]);
}

/**
 * Real-time sync for freight entries - invalidates query cache on changes
 */
export function useFreightRealtimeSync(driverId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!driverId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`freight-sync-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_entries',
          filter: `driver_id=eq.${driverId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['freight-entries'] });
          queryClient.invalidateQueries({ queryKey: ['recent-freight'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);
}

/**
 * Real-time sync for expense/cost entries - invalidates query cache on changes
 */
export function useExpenseRealtimeSync(driverId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!driverId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`expense-sync-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cost_entries',
          filter: `driver_id=eq.${driverId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expense-entries'] });
          queryClient.invalidateQueries({ queryKey: ['cost-entries'] }); // Dashboard query key
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);
}

/**
 * Real-time subscription for vehicle assignment changes
 */
export function useVehicleAssignmentSubscription(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    // Watch driver_vehicle_assignments table for assignment changes
    const channel = supabase
      .channel(`vehicle-assignment-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_vehicle_assignments',
          filter: `driver_id=eq.${userId}`,
        },
        () => {
          console.log('Vehicle assignment changed, invalidating queries...');
          // Only invalidate the vehicle query — dependent queries will
          // automatically refetch when vehicle data changes (new query keys).
          queryClient.invalidateQueries({ queryKey: ['assigned-vehicle'] });
          queryClient.invalidateQueries({ queryKey: ['driver-assigned-vehicle'] });
          queryClient.invalidateQueries({ queryKey: ['assigned-vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['driver-assignment'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/**
 * Real-time subscription for load assignment changes
 */
export function useLoadAssignmentSubscription(vehicleId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!vehicleId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`loads-${vehicleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loads',
          filter: `assigned_vehicle_id=eq.${vehicleId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['assigned-loads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vehicleId, queryClient]);
}