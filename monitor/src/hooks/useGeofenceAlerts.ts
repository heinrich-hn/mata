import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureAlert } from '@/lib/alertUtils';

interface GeofenceEvent {
    id: string;
    event_type: string;
    event_timestamp: string;
    vehicle_id: string;
    geofence_zone_id: string;
    latitude: number;
    longitude: number;
    dwell_duration_minutes: number | null;
    notification_sent: boolean | null;
}

interface GeofenceZone {
    id: string;
    name: string;
    zone_type: string | null;
}

export function useGeofenceAlerts(enabled: boolean = true) {
    const processedEvents = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!enabled) return;

        const syncEvents = async () => {
            // Get recent geofence events from the last 24h
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const { data: events, error } = await supabase
                .from('geofence_events')
                .select('id, event_type, event_timestamp, vehicle_id, geofence_zone_id, latitude, longitude, dwell_duration_minutes, notification_sent')
                .gte('event_timestamp', since)
                .order('event_timestamp', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Error fetching geofence events:', error);
                return;
            }

            if (!events?.length) return;

            // Fetch zone names
            const zoneIds = [...new Set(events.map(e => e.geofence_zone_id))];
            const { data: zones } = await supabase
                .from('geofences')
                .select('id, name, zone_type')
                .in('id', zoneIds);

            const zoneMap = new Map((zones as GeofenceZone[] || []).map(z => [z.id, z]));

            // Fetch vehicle fleet numbers
            const vehicleIds = [...new Set(events.map(e => e.vehicle_id))];
            const { data: vehicles } = await supabase
                .from('vehicles')
                .select('id, fleet_number')
                .in('id', vehicleIds);

            const vehicleMap = new Map((vehicles || []).map(v => [v.id, v.fleet_number]));

            for (const event of events as GeofenceEvent[]) {
                if (processedEvents.current.has(event.id)) continue;
                processedEvents.current.add(event.id);

                const zone = zoneMap.get(event.geofence_zone_id);
                const fleetNumber = vehicleMap.get(event.vehicle_id);
                const zoneName = zone?.name ?? 'Unknown Zone';
                const eventLabel = event.event_type === 'entered' ? 'Entry' :
                    event.event_type === 'exited' ? 'Exit' : 'Dwell';

                const severity = event.event_type === 'dwell' && (event.dwell_duration_minutes ?? 0) > 60
                    ? 'high' as const
                    : 'medium' as const;

                await ensureAlert({
                    sourceType: 'geofence',
                    sourceId: event.id,
                    sourceLabel: fleetNumber ?? event.vehicle_id,
                    category: 'geofence_breach',
                    severity,
                    title: `Geofence ${eventLabel}: ${zoneName}`,
                    message: `Vehicle ${fleetNumber ?? event.vehicle_id} ${event.event_type} ${zoneName} at ${new Date(event.event_timestamp).toLocaleString()}${event.dwell_duration_minutes ? ` (${event.dwell_duration_minutes} min)` : ''}`,
                    fleetNumber,
                    metadata: {
                        event_id: event.id,
                        event_type: event.event_type,
                        event_timestamp: event.event_timestamp,
                        vehicle_id: event.vehicle_id,
                        fleet_number: fleetNumber,
                        zone_id: event.geofence_zone_id,
                        zone_name: zoneName,
                        zone_type: zone?.zone_type,
                        latitude: event.latitude,
                        longitude: event.longitude,
                        dwell_duration_minutes: event.dwell_duration_minutes,
                        issue_type: 'geofence_breach',
                    },
                }).catch(err => console.error('Failed to create geofence alert:', err));
            }
        };

        syncEvents();

        const subscription = supabase
            .channel('geofence-events-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'geofence_events' },
                () => syncEvents()
            )
            .subscribe();

        const interval = setInterval(syncEvents, 5 * 60 * 1000);

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [enabled]);
}
