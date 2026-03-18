/**
 * Seamless Wialon-Load Integration Hook
 * Provides real-time synchronization between Wialon GPS data and load management
 */

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWialon } from '@/integrations/wialon/useWialon';
import {
    advancedRouteTrackingService,
    type PredictiveETA,
    type RouteDeviation,
    type RouteWaypoint,
} from '@/services/advancedRouteTracking';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LoadWialonSync {
  loadId: string;
  vehicleId: string;
  vehicleName: string;
  wialonUnitId?: string;
  currentLocation?: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    timestamp: Date;
  };
  routeDeviation?: RouteDeviation;
  predictiveETA?: PredictiveETA;
  plannedRoute?: RouteWaypoint[];
  isTracking: boolean;
  autoSyncEnabled: boolean;
}

export interface GeofenceEvent {
  type: 'entry' | 'exit';
  geofenceId: string;
  geofenceName: string;
  timestamp: Date;
  loadId: string;
  vehicleId: string;
  suggestedStatusUpdate?: string;
}

export interface AutoStatusUpdateRule {
  geofenceType: 'pickup' | 'delivery' | 'waypoint' | 'border' | 'warehouse';
  eventType: 'entry' | 'exit';
  currentStatus: string;
  newStatus: string;
  requiresConfirmation: boolean;
}

const defaultAutoStatusRules: AutoStatusUpdateRule[] = [
  {
    geofenceType: 'pickup',
    eventType: 'entry',
    currentStatus: 'in_transit',
    newStatus: 'arrived_pickup',
    requiresConfirmation: false,
  },
  {
    geofenceType: 'pickup',
    eventType: 'exit',
    currentStatus: 'arrived_pickup',
    newStatus: 'loaded',
    requiresConfirmation: true,
  },
  {
    geofenceType: 'delivery',
    eventType: 'entry',
    currentStatus: 'in_transit',
    newStatus: 'arrived_delivery',
    requiresConfirmation: false,
  },
  {
    geofenceType: 'delivery',
    eventType: 'exit',
    currentStatus: 'arrived_delivery',
    newStatus: 'delivered',
    requiresConfirmation: true,
  },
  {
    geofenceType: 'border',
    eventType: 'entry',
    currentStatus: 'in_transit',
    newStatus: 'border_crossing',
    requiresConfirmation: false,
  },
  {
    geofenceType: 'warehouse',
    eventType: 'entry',
    currentStatus: 'in_transit',
    newStatus: 'at_warehouse',
    requiresConfirmation: false,
  },
];

export function useWialonLoadIntegration(loadId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { vehicleLocations, isConnected, refreshUnits } = useWialon();

  const [syncState, setSyncState] = useState<LoadWialonSync | null>(null);
  const [autoStatusRules] = useState<AutoStatusUpdateRule[]>(defaultAutoStatusRules);
  const [pendingStatusUpdates, setPendingStatusUpdates] = useState<
    Array<{ loadId: string; newStatus: string; geofenceEvent: GeofenceEvent }>
  >([]);

  const lastDeviationCheck = useRef<Date>(new Date());
  const lastETAUpdate = useRef<Date>(new Date());
  const deviationCheckInterval = 30000; // 30 seconds
  const etaUpdateInterval = 60000; // 1 minute

  // Fetch load details with vehicle and route information
  const { data: loadData, refetch: refetchLoad } = useQuery({
    queryKey: ['load-wialon-sync', loadId],
    queryFn: async () => {
      const { data: load, error } = await supabase
        .from('loads')
        .select(
          `
          *,
          vehicle:vehicles(*),
          route_optimizations(*)
        `
        )
        .eq('id', loadId)
        .single();

      if (error) throw error;
      return load;
    },
    enabled: !!loadId,
  });

  // Fetch planned route waypoints
  const { data: routeWaypoints } = useQuery({
    queryKey: ['load-route-waypoints', loadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_waypoints')
        .select('*')
        .eq('route_id', loadId)
        .order('sequence_order');

      if (error) throw error;
      // Map database fields to RouteWaypoint type
      return (data || []).map(wp => ({
        lat: wp.latitude ?? 0,
        lng: wp.longitude ?? 0,
        type: wp.is_fuel_stop ? 'fuel' : 'route' as 'route' | 'pickup' | 'delivery' | 'rest' | 'fuel',
        sequence: wp.sequence_order,
        eta: undefined,
      })) as RouteWaypoint[];
    },
    enabled: !!loadId,
  });

  // Update load status mutation
  const updateLoadStatusMutation = useMutation({
    mutationFn: async ({
      newStatus,
      reason,
      geofenceId,
    }: {
      newStatus: string;
      reason?: string;
      geofenceId?: string;
    }) => {
      const { data, error } = await supabase
        .from('loads')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', loadId)
        .select()
        .single();

      if (error) throw error;

      // Log status change event (geofenceId stored in notes field)
      await supabase.from('delivery_events').insert({
        load_id: loadId,
        vehicle_id: loadData?.vehicle?.[0]?.id || loadData?.assigned_vehicle_id || '',
        event_type: 'status_change',
        description: `Status changed to ${newStatus}${reason ? `: ${reason}` : ''}`,
        notes: geofenceId ? `Geofence: ${geofenceId}` : null,
        event_timestamp: new Date().toISOString(),
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load-wialon-sync', loadId] });
      queryClient.invalidateQueries({ queryKey: ['loads'] });
      toast({
        title: 'Status Updated',
        description: 'Load status has been updated successfully',
      });
    },
    onError: error => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update ETA mutation
  const updateETAMutation = useMutation({
    mutationFn: async (eta: PredictiveETA) => {
      const { data, error } = await supabase
        .from('delivery_eta')
        .upsert({
          load_id: loadId,
          estimated_arrival: eta.estimatedArrival.toISOString(),
          confidence_level: eta.confidence, // ✅ Correct column name
          factors: eta.factors, // ✅ Requires migration to add this column
          optimistic_eta: eta.alternativeETAs.optimistic.toISOString(), // ✅ Requires migration
          pessimistic_eta: eta.alternativeETAs.pessimistic.toISOString(), // ✅ Requires migration
          calculated_at: new Date().toISOString(), // ✅ Correct column name
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-eta', loadId] });
    },
  });

  // Log route deviation event
  const logDeviationMutation = useMutation({
    mutationFn: async (deviation: RouteDeviation) => {
      const { data, error } = await supabase.from('delivery_events').insert({
        load_id: loadId,
        vehicle_id: loadData?.vehicle?.[0]?.id || loadData?.assigned_vehicle_id || '',
        event_type: 'route_deviation',
        description: `Route deviation detected: ${deviation.deviationDistance.toFixed(0)}m (${deviation.severity})`,
        latitude: deviation.location.lat,
        longitude: deviation.location.lng,
        notes: JSON.stringify({
          severity: deviation.severity,
          deviationDistance: deviation.deviationDistance,
          alternativeRoute: deviation.alternativeRoute,
        }),
        event_timestamp: new Date().toISOString(),
      });

      if (error) throw error;
      return data;
    },
  });

  // Sync current vehicle location with Wialon
  useEffect(() => {
    if (!loadData || !isConnected || !vehicleLocations.length) return;

    // Vehicle is returned as array from join query
    const vehicle = Array.isArray(loadData.vehicle) ? loadData.vehicle[0] : loadData.vehicle;
    if (!vehicle) return;

    // Find matching Wialon vehicle by fleet_number or registration_number
    const wialonVehicle = vehicleLocations.find(
      v =>
        v.vehicleName?.toLowerCase().includes(vehicle.fleet_number?.toLowerCase() || '') ||
        v.vehicleName?.toLowerCase().includes(vehicle.registration_number?.toLowerCase() || '')
    );

    if (!wialonVehicle) {
      setSyncState(prev =>
        prev
          ? { ...prev, isTracking: false }
          : {
              loadId,
              vehicleId: vehicle.id,
              vehicleName: vehicle.fleet_number || vehicle.registration_number,
              isTracking: false,
              autoSyncEnabled: true,
            }
      );
      return;
    }

    // Update sync state with current location
    setSyncState(prev => ({
      loadId,
      vehicleId: vehicle.id,
      vehicleName: vehicle.fleet_number || vehicle.registration_number,
      wialonUnitId: wialonVehicle.unitId,
      currentLocation: {
        lat: wialonVehicle.latitude,
        lng: wialonVehicle.longitude,
        speed: wialonVehicle.speed || 0,
        heading: wialonVehicle.heading || 0,
        timestamp: wialonVehicle.timestamp,
      },
      plannedRoute: routeWaypoints,
      routeDeviation: prev?.routeDeviation,
      predictiveETA: prev?.predictiveETA,
      isTracking: true,
      autoSyncEnabled: prev?.autoSyncEnabled ?? true,
    }));

    // Save tracking data to database (use correct field names)
    if (wialonVehicle) {
      supabase
        .from('delivery_tracking')
        .insert({
          load_id: loadId,
          vehicle_id: vehicle.id,
          latitude: wialonVehicle.latitude,
          longitude: wialonVehicle.longitude,
          speed: wialonVehicle.speed,
          heading: wialonVehicle.heading,
          altitude: wialonVehicle.altitude,
          recorded_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.error('Failed to save tracking data:', error);
        });
    }
  }, [loadData, vehicleLocations, isConnected, loadId, routeWaypoints]);

  // Continuous route deviation monitoring
  useEffect(() => {
    if (
      !syncState?.isTracking ||
      !syncState.currentLocation ||
      !routeWaypoints ||
      routeWaypoints.length === 0
    ) {
      return;
    }

    const now = new Date();
    if (now.getTime() - lastDeviationCheck.current.getTime() < deviationCheckInterval) {
      return;
    }

    lastDeviationCheck.current = now;

    // Check for route deviation
    const deviation = advancedRouteTrackingService.calculateRouteDeviation(
      {
        vehicleId: syncState.vehicleId,
        vehicleName: syncState.vehicleName,
        latitude: syncState.currentLocation.lat,
        longitude: syncState.currentLocation.lng,
        speed: syncState.currentLocation.speed,
        heading: syncState.currentLocation.heading,
        altitude: 0,
        satelliteCount: 0,
        isMoving: (syncState.currentLocation.speed || 0) > 0,
        timestamp: syncState.currentLocation.timestamp,
      },
      routeWaypoints,
      loadId
    );

    if (deviation) {
      setSyncState(prev => (prev ? { ...prev, routeDeviation: deviation } : null));
      logDeviationMutation.mutate(deviation);

      // Show notification for significant deviations
      if (deviation.severity === 'high' || deviation.severity === 'critical') {
        toast({
          title: 'Route Deviation Detected',
          description: `Vehicle is ${deviation.deviationDistance.toFixed(0)}m off route`,
          variant: 'destructive',
        });
      }
    } else if (syncState.routeDeviation) {
      // Clear deviation if back on route
      setSyncState(prev => (prev ? { ...prev, routeDeviation: undefined } : null));
      toast({
        title: 'Back on Route',
        description: 'Vehicle has returned to planned route',
      });
    }
  }, [
    syncState,
    routeWaypoints,
    loadId,
    toast,
    logDeviationMutation,
    deviationCheckInterval,
  ]);

  // Predictive ETA updates
  useEffect(() => {
    if (
      !syncState?.isTracking ||
      !syncState.currentLocation ||
      !loadData?.destination_lat ||
      !loadData?.destination_lng
    ) {
      return;
    }

    const now = new Date();
    if (now.getTime() - lastETAUpdate.current.getTime() < etaUpdateInterval) {
      return;
    }

    lastETAUpdate.current = now;

    // Calculate predictive ETA
    advancedRouteTrackingService
      .calculatePredictiveETA(
        loadId,
        {
          vehicleId: syncState.vehicleId,
          vehicleName: syncState.vehicleName,
          latitude: syncState.currentLocation.lat,
          longitude: syncState.currentLocation.lng,
          speed: syncState.currentLocation.speed,
          heading: syncState.currentLocation.heading,
          altitude: 0,
          satelliteCount: 0,
          isMoving: (syncState.currentLocation.speed || 0) > 0,
          timestamp: syncState.currentLocation.timestamp,
        },
        {
          lat: loadData.destination_lat,
          lng: loadData.destination_lng,
        },
        routeWaypoints
      )
      .then(eta => {
        setSyncState(prev => (prev ? { ...prev, predictiveETA: eta } : null));
        updateETAMutation.mutate(eta);
      })
      .catch(error => {
        console.error('Failed to calculate predictive ETA:', error);
      });
  }, [
    syncState,
    loadData,
    routeWaypoints,
    loadId,
    updateETAMutation,
    etaUpdateInterval,
  ]);

  // Geofence monitoring with auto status updates
  const handleGeofenceEvent = useCallback(
    (event: GeofenceEvent) => {
      if (!syncState?.autoSyncEnabled) return;

      // Find matching auto-status rule
      const rule = autoStatusRules.find(
        r =>
          r.eventType === event.type &&
          r.currentStatus === loadData?.status &&
          event.geofenceName.toLowerCase().includes(r.geofenceType)
      );

      if (!rule) return;

      if (rule.requiresConfirmation) {
        // Add to pending updates for user confirmation
        setPendingStatusUpdates(prev => [
          ...prev,
          {
            loadId: event.loadId,
            newStatus: rule.newStatus,
            geofenceEvent: event,
          },
        ]);

        toast({
          title: 'Status Update Recommended',
          description: `Suggest changing status to "${rule.newStatus}" based on ${event.type} of ${event.geofenceName}. Check pending updates.`,
        });
      } else {
        // Auto-update without confirmation
        updateLoadStatusMutation.mutate({
          newStatus: rule.newStatus,
          reason: `Auto-updated based on geofence ${event.type}`,
          geofenceId: event.geofenceId,
        });
      }
    },
    [syncState, autoStatusRules, loadData, updateLoadStatusMutation, toast]
  );

  // Subscribe to geofence events
  useEffect(() => {
    if (!loadId) return;

    const channel = supabase
      .channel(`geofence-events-${loadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'geofence_events',
          filter: `load_id=eq.${loadId}`,
        },
        payload => {
          const event: GeofenceEvent = {
            type: payload.new.event_type,
            geofenceId: payload.new.geofence_zone_id, // ✅ Correct column name
            geofenceName: payload.new.geofence_name || 'Unknown', // May not exist in payload
            timestamp: new Date(payload.new.event_timestamp), // ✅ Correct column name
            loadId: payload.new.load_id,
            vehicleId: payload.new.vehicle_id,
          };
          handleGeofenceEvent(event);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId, handleGeofenceEvent]);

  const toggleAutoSync = useCallback(() => {
    setSyncState(prev =>
      prev ? { ...prev, autoSyncEnabled: !prev.autoSyncEnabled } : null
    );
  }, []);

  const manualRefresh = useCallback(async () => {
    await refreshUnits();
    await refetchLoad();
  }, [refreshUnits, refetchLoad]);

  return {
    syncState,
    isTracking: syncState?.isTracking ?? false,
    pendingStatusUpdates,
    toggleAutoSync,
    manualRefresh,
    updateStatus: updateLoadStatusMutation.mutate,
    isUpdatingStatus: updateLoadStatusMutation.isPending,
  };
}