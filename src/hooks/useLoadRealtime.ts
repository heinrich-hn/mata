// src/hooks/useLoadRealtime.ts

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

interface LoadRealtimeUpdate {
  id: string;
  load_number?: string;
  status?: string;
  assigned_vehicle_id?: string;
  current_latitude?: number;
  current_longitude?: number;
  current_speed_kmh?: number;
  total_km_traveled?: number;
  last_gps_update?: string;
  pickup_datetime?: string;
  delivery_datetime?: string;
  actual_pickup_datetime?: string;
  actual_delivery_datetime?: string;
}

interface UseLoadRealtimeOptions {
  loadId?: string;
  enableNotifications?: boolean;
  onUpdate?: (payload: RealtimePostgresChangesPayload<LoadRealtimeUpdate>) => void;
}

interface HistoricalTrackPoint {
  id: string;
  load_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  recorded_at: string;
}

/**
 * Hook for real-time load updates via Supabase subscriptions
 * Automatically invalidates React Query cache and shows toast notifications
 */
export const useLoadRealtime = (options: UseLoadRealtimeOptions = {}) => {
  const { loadId, enableNotifications = true, onUpdate } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getStatusEmoji = (status?: string): string => {
    const emojiMap: Record<string, string> = {
      'Pending': '⏳',
      'Assigned': '📋',
      'In Transit': '🚛',
      'At Pickup': '📦',
      'At Delivery': '🏢',
      'Delivered': '✅',
      'Completed': '✅',
      'Cancelled': '❌',
      'On Hold': '⏸️',
    };

    return emojiMap[status || ''] || '📄';
  };

  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<LoadRealtimeUpdate>) => {
    const newLoad = payload.new as LoadRealtimeUpdate;

    if (enableNotifications) {
      toast({
        title: '🚛 New Load Created',
        description: `Load ${newLoad.load_number || newLoad.id} has been created`,
      });
    }
  }, [enableNotifications, toast]);

  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<LoadRealtimeUpdate>) => {
    const oldData = payload.old as LoadRealtimeUpdate;
    const newData = payload.new as LoadRealtimeUpdate;

    if (!enableNotifications) return;

    // Status change notification
    if (oldData.status !== newData.status) {
      const statusEmoji = getStatusEmoji(newData.status);
      toast({
        title: `${statusEmoji} Load Status Updated`,
        description: `Load ${newData.load_number || newData.id}: ${oldData.status} → ${newData.status}`,
      });
    }

    // Vehicle assignment notification
    if (oldData.assigned_vehicle_id !== newData.assigned_vehicle_id) {
      toast({
        title: '🚚 Vehicle Assigned',
        description: `Load ${newData.load_number || newData.id} has been assigned to a vehicle`,
      });
    }

    // Pickup completion notification
    if (!oldData.actual_pickup_datetime && newData.actual_pickup_datetime) {
      toast({
        title: '📦 Pickup Complete',
        description: `Load ${newData.load_number || newData.id} picked up at ${new Date(
          newData.actual_pickup_datetime
        ).toLocaleTimeString()}`,
      });
    }

    // Delivery completion notification
    if (!oldData.actual_delivery_datetime && newData.actual_delivery_datetime) {
      toast({
        title: '✅ Delivery Complete',
        description: `Load ${newData.load_number || newData.id} delivered at ${new Date(
          newData.actual_delivery_datetime
        ).toLocaleTimeString()}`,
      });
    }

    // GPS tracking update (silent - no toast)
    if (
      oldData.current_latitude !== newData.current_latitude ||
      oldData.current_longitude !== newData.current_longitude
    ) {
      console.log('GPS position updated:', {
        load: newData.id,
        lat: newData.current_latitude,
        lng: newData.current_longitude,
        speed: newData.current_speed_kmh,
        distance: newData.total_km_traveled
      });
    }
  }, [enableNotifications, toast]);

  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<LoadRealtimeUpdate>) => {
    const deletedLoad = payload.old as LoadRealtimeUpdate;

    if (enableNotifications) {
      toast({
        title: '🗑️ Load Deleted',
        description: `Load ${deletedLoad.load_number || deletedLoad.id} has been removed`,
        variant: 'destructive',
      });
    }
  }, [enableNotifications, toast]);

  const invalidateQueries = useCallback((payload: RealtimePostgresChangesPayload<LoadRealtimeUpdate>) => {
    const loadIdFromPayload = (payload.new as LoadRealtimeUpdate)?.id || (payload.old as LoadRealtimeUpdate)?.id;

    // Invalidate all load-related queries
    queryClient.invalidateQueries({ queryKey: ['loads'] });

    if (loadIdFromPayload) {
      queryClient.invalidateQueries({ queryKey: ['load', loadIdFromPayload] });
    }

    // If status changed, invalidate status-filtered queries
    if (payload.eventType === 'UPDATE' && (payload.old as LoadRealtimeUpdate).status !== (payload.new as LoadRealtimeUpdate).status) {
      queryClient.invalidateQueries({ queryKey: ['loads', 'status'] });
    }

    // If vehicle assigned, invalidate vehicle-related queries
    if (
      payload.eventType === 'UPDATE' &&
      (payload.old as LoadRealtimeUpdate).assigned_vehicle_id !== (payload.new as LoadRealtimeUpdate).assigned_vehicle_id
    ) {
      queryClient.invalidateQueries({ queryKey: ['vehicle-loads'] });
    }
  }, [queryClient]);

  useEffect(() => {
    // Build channel name based on whether we're tracking a specific load
    const channelName = loadId ? `load-${loadId}` : 'loads-all';

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loads',
          ...(loadId && { filter: `id=eq.${loadId}` })
        },
        (payload: RealtimePostgresChangesPayload<LoadRealtimeUpdate>) => {
          console.log('Load realtime update:', payload);

          // Call custom update handler if provided
          if (onUpdate) {
            onUpdate(payload);
          }

          // Handle different event types
          switch (payload.eventType) {
            case 'INSERT':
              handleInsert(payload);
              break;
            case 'UPDATE':
              handleUpdate(payload);
              break;
            case 'DELETE':
              handleDelete(payload);
              break;
          }

          // Invalidate relevant queries
          invalidateQueries(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId, enableNotifications, onUpdate, handleInsert, handleUpdate, handleDelete, invalidateQueries]);

  // New: Function to fetch historical track
  const fetchHistoricalTrack = useCallback(async (from: Date, to: Date = new Date()): Promise<HistoricalTrackPoint[]> => {
    if (!loadId) throw new Error('loadId is required for historical tracking');

    const { data, error } = await supabase
      .from('delivery_tracking')
      .select('id, load_id, latitude, longitude, speed, heading, altitude, recorded_at')
      .eq('load_id', loadId)
      .gte('recorded_at', from.toISOString())
      .lte('recorded_at', to.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    return (data || []) as HistoricalTrackPoint[];
  }, [loadId]);

  return { fetchHistoricalTrack };
};

/**
 * Hook specifically for tracking a single load's real-time updates
 */
export const useSingleLoadRealtime = (
  loadId: string,
  options: Omit<UseLoadRealtimeOptions, 'loadId'> = {}
) => {
  return useLoadRealtime({ ...options, loadId });
};

/**
 * Hook for tracking all loads in real-time (for dashboards, lists, etc.)
 */
export const useAllLoadsRealtime = (
  options: Omit<UseLoadRealtimeOptions, 'loadId'> = {}
) => {
  return useLoadRealtime(options);
};