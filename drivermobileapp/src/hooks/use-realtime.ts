import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Debug logger
const debugLog = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.log(`🔌 [REALTIME][INFO] ${message}`, data || '');
  },
  error: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.error(`❌ [REALTIME][ERROR] ${message}`, data || '');
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.warn(`⚠️ [REALTIME][WARN] ${message}`, data || '');
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_MODE) return;
    console.debug(`🐛 [REALTIME][DEBUG] ${message}`, data || '');
  }
};

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
  
  debugLog.debug('useVehicles hook initialized');
  
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async (): Promise<Vehicle[]> => {
      debugLog.info('Fetching vehicles');
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, fleet_number, registration_number, make, model, vehicle_type, tonnage, active')
        .eq('active', true)
        .order('fleet_number');

      if (error) {
        debugLog.error('Error fetching vehicles', { error: error.message });
        console.error('Error fetching vehicles:', error);
        throw error;
      }

      debugLog.info(`Fetched ${data?.length || 0} vehicles`);
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
  
  debugLog.debug('useDriverAssignedVehicle hook initialized', { driverId });
  
  return useQuery({
    queryKey: ['driver-assigned-vehicle', driverId],
    queryFn: async (): Promise<Vehicle | null> => {
      if (!driverId) {
        debugLog.warn('No driverId provided, returning null');
        return null;
      }

      debugLog.info('Fetching assigned vehicle for driver', { driverId });

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

      if (assignmentError) {
        debugLog.error('Error fetching assignments', { error: assignmentError.message });
      }

      if (!assignmentError && assignments && assignments.length > 0) {
        debugLog.info(`Found ${assignments.length} active assignments`);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = assignments as any[];
        // Prefer truck over reefer/trailer
        const truckRow = rows.find((r: { vehicles?: { vehicle_type?: string } }) => {
          const vt = r.vehicles?.vehicle_type;
          return !vt || TRUCK_TYPES.includes(vt);
        }) || rows[0];

        const v = truckRow.vehicles as Record<string, unknown>;
        if (v) {
          debugLog.info('Returning assigned vehicle', {
            fleet_number: v.fleet_number,
            vehicle_type: v.vehicle_type
          });
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
      debugLog.debug('No assignments found, checking user metadata fallback');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const vehicleId = authUser?.user_metadata?.assigned_vehicle_id;
      if (vehicleId) {
        debugLog.info('Found vehicle in user metadata', { vehicleId });
        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id, fleet_number, registration_number, make, model, vehicle_type, tonnage, active')
          .eq('id', vehicleId)
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vehicleData = vehicle as any;
        if (!vehicleError && vehicleData) {
          debugLog.info('Returning vehicle from metadata', {
            fleet_number: vehicleData.fleet_number
          });
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

      debugLog.warn('No assigned vehicle found for driver', { driverId });
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
  
  debugLog.debug('useAssignVehicle hook initialized');
  
  return useMutation({
    mutationFn: async (vehicleId: string): Promise<void> => {
      debugLog.info('Assigning vehicle', { vehicleId });
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        debugLog.error('No authenticated user found');
        throw new Error('User not authenticated');
      }

      debugLog.debug('Current user', { userId: user.id, userEmail: user.email });

      // First, mark any existing assignments as not current
      debugLog.debug('Marking existing assignments as inactive');
      await supabase
        .from('driver_vehicle_assignments')
        .update({ is_active: false, unassigned_at: new Date().toISOString() } as never)
        .eq('driver_id', user.id)
        .eq('is_active', true);

      // Create new assignment
      debugLog.debug('Creating new assignment');
      const { error: insertError } = await supabase
        .from('driver_vehicle_assignments')
        .insert({
          driver_id: user.id,
          vehicle_id: vehicleId,
          is_active: true,
          assigned_at: new Date().toISOString(),
        } as never);

      if (insertError) {
        debugLog.warn('Assignment table insert failed, falling back to user metadata', { error: insertError.message });
        // Table might not exist, try updating user metadata instead
        console.log('Assignment table not available, using user metadata');

        const { error: updateError } = await supabase.auth.updateUser({
          data: { assigned_vehicle_id: vehicleId }
        });

        if (updateError) {
          debugLog.error('Failed to update user metadata', { error: updateError.message });
          throw updateError;
        }
        debugLog.info('Vehicle assigned via user metadata');
      } else {
        debugLog.info('Vehicle assigned successfully via assignments table');
      }
    },
    onSuccess: () => {
      debugLog.info('Assignment successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['driver-assigned-vehicle'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (error: Error) => {
      debugLog.error('Assignment failed', { error: error.message });
    },
  });
}

/**
 * Hook to unassign current vehicle from driver
 */
export function useUnassignVehicle() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  debugLog.debug('useUnassignVehicle hook initialized');

  return useMutation({
    mutationFn: async (): Promise<void> => {
      debugLog.info('Unassigning vehicle');
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        debugLog.error('No authenticated user found');
        throw new Error('User not authenticated');
      }

      debugLog.debug('Current user', { userId: user.id });

      // Mark current assignment as inactive
      debugLog.debug('Marking current assignment as inactive');
      await supabase
        .from('driver_vehicle_assignments')
        .update({ is_active: false, unassigned_at: new Date().toISOString() } as never)
        .eq('driver_id', user.id)
        .eq('is_active', true);

      // Also clear from user metadata
      debugLog.debug('Clearing user metadata');
      await supabase.auth.updateUser({
        data: { assigned_vehicle_id: null }
      });
      
      debugLog.info('Vehicle unassigned successfully');
    },
    onSuccess: () => {
      debugLog.info('Unassignment successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['driver-assigned-vehicle'] });
    },
    onError: (error: Error) => {
      debugLog.error('Unassignment failed', { error: error.message });
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
  
  debugLog.debug('useAssignedLoads hook initialized', { driverId, hasVehicle: !!vehicle });

  return useQuery({
    queryKey: ['assigned-loads', vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) {
        debugLog.debug('No vehicle ID, returning empty array');
        return [];
      }

      debugLog.info('Fetching assigned loads', { vehicleId: vehicle.id });
      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('assigned_vehicle_id', vehicle.id)
        .in('status', ['pending', 'assigned', 'in_transit', 'loading', 'offloading'])
        .order('pickup_datetime', { ascending: true });

      if (error) {
        debugLog.error('Error fetching assigned loads', { error: error.message });
        console.error('Error fetching assigned loads:', error);
        throw error;
      }

      debugLog.info(`Fetched ${data?.length || 0} assigned loads`);
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (filter && !filter.value) {
      debugLog.debug(`Skipping realtime subscription for ${tableName} - no filter value`);
      return;
    }

    debugLog.info(`Setting up realtime subscription for ${tableName}`, { filter });
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
          if (!mountedRef.current) return;
          debugLog.info(`[Realtime] ${tableName} change received`, { 
            eventType: payload.eventType,
            schema: payload.schema,
            table: payload.table
          });
          console.log(`[Realtime] ${tableName} change:`, payload.eventType);
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe((status) => {
        debugLog.debug(`Realtime subscription status for ${tableName}`, { status });
      });

    return () => {
      debugLog.info(`Cleaning up realtime subscription for ${tableName}`);
      mountedRef.current = false;
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!driverId || !fleetNumber) {
      debugLog.debug('Skipping diesel realtime sync', { hasDriverId: !!driverId, hasFleetNumber: !!fleetNumber });
      return;
    }

    debugLog.info('Setting up diesel realtime sync', { driverId, fleetNumber });
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
          if (!mountedRef.current) return;
          debugLog.info('Diesel records changed, invalidating queries', { fleetNumber });
          queryClient.invalidateQueries({ queryKey: ['diesel-records'] });
          queryClient.invalidateQueries({ queryKey: ['recent-diesel'] });
          queryClient.invalidateQueries({ queryKey: ['monthly-diesel-records'] });
          queryClient.invalidateQueries({ queryKey: ['recent-diesel-records'] });
        }
      )
      .subscribe((status) => {
        debugLog.debug('Diesel realtime subscription status', { status });
      });

    return () => {
      debugLog.info('Cleaning up diesel realtime sync');
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [driverId, fleetNumber, queryClient]);
}

/**
 * Real-time sync for trips - invalidates query cache on changes.
 * Watches the trips table filtered by fleet_vehicle_id so the driver
 * only receives updates for their assigned vehicle.
 */
export function useTripsRealtimeSync(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!vehicleId) {
      debugLog.debug('Skipping trips realtime sync - no vehicle ID');
      return;
    }

    debugLog.info('Setting up trips realtime sync', { vehicleId });
    const supabase = createClient();
    const channel = supabase
      .channel(`trips-sync-${vehicleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
          filter: `fleet_vehicle_id=eq.${vehicleId}`,
        },
        () => {
          if (!mountedRef.current) return;
          debugLog.info('Trips changed, invalidating queries', { vehicleId });
          queryClient.invalidateQueries({ queryKey: ['monthly-trips'] });
          queryClient.invalidateQueries({ queryKey: ['recent-trips'] });
        }
      )
      .subscribe((status) => {
        debugLog.debug('Trips realtime subscription status', { status });
      });

    return () => {
      debugLog.info('Cleaning up trips realtime sync');
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [vehicleId, queryClient]);
}

/**
 * @deprecated Use useTripsRealtimeSync(vehicleId) instead.
 * Kept for backward compatibility — maps driverId to a no-filter trips watch.
 */
export function useFreightRealtimeSync(driverId: string | undefined) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!driverId) {
      debugLog.debug('Skipping freight realtime sync - no driver ID');
      return;
    }

    debugLog.warn('useFreightRealtimeSync is deprecated, consider using useTripsRealtimeSync', { driverId });
    const supabase = createClient();
    const channel = supabase
      .channel(`trips-compat-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
        },
        () => {
          if (!mountedRef.current) return;
          debugLog.info('Freight (trips) changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['monthly-trips'] });
          queryClient.invalidateQueries({ queryKey: ['recent-trips'] });
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);
}

/**
 * Real-time sync for expense/cost entries - invalidates query cache on changes
 */
export function useExpenseRealtimeSync(driverId: string | undefined) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!driverId) {
      debugLog.debug('Skipping expense realtime sync - no driver ID');
      return;
    }

    debugLog.info('Setting up expense realtime sync', { driverId });
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
          if (!mountedRef.current) return;
          debugLog.info('Expense entries changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['expense-entries'] });
          queryClient.invalidateQueries({ queryKey: ['cost-entries'] }); // Dashboard query key
        }
      )
      .subscribe();

    return () => {
      debugLog.info('Cleaning up expense realtime sync');
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);
}

/**
 * Real-time subscription for vehicle assignment changes
 */
export function useVehicleAssignmentSubscription(userId: string | undefined) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!userId) {
      debugLog.debug('Skipping vehicle assignment subscription - no user ID');
      return;
    }

    debugLog.info('Setting up vehicle assignment subscription', { userId });
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
          if (!mountedRef.current) return;
          debugLog.info('Vehicle assignment changed, invalidating queries');
          console.log('Vehicle assignment changed, invalidating queries...');
          queryClient.invalidateQueries({ queryKey: ['assigned-vehicle'] });
          queryClient.invalidateQueries({ queryKey: ['driver-assigned-vehicle'] });
          queryClient.invalidateQueries({ queryKey: ['assigned-vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['driver-assignment'] });
        }
      )
      .subscribe((status) => {
        debugLog.debug('Vehicle assignment subscription status', { status });
      });

    return () => {
      debugLog.info('Cleaning up vehicle assignment subscription');
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/**
 * Real-time subscription for load assignment changes
 */
export function useLoadAssignmentSubscription(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!vehicleId) {
      debugLog.debug('Skipping load assignment subscription - no vehicle ID');
      return;
    }

    debugLog.info('Setting up load assignment subscription', { vehicleId });
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
          if (!mountedRef.current) return;
          debugLog.info('Load assignment changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['assigned-loads'] });
        }
      )
      .subscribe();

    return () => {
      debugLog.info('Cleaning up load assignment subscription');
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [vehicleId, queryClient]);
}