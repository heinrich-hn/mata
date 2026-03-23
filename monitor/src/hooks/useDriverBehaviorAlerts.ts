import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureAlert } from '@/lib/alertUtils';

interface BehaviorEvent {
    id: string;
    driver_name: string;
    fleet_number: string | null;
    event_type: string;
    event_date: string;
    severity: string | null;
    description: string;
    location: string | null;
    status: string | null;
    points: number | null;
}

const SEVERITY_MAP: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
};

function formatEventType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function useDriverBehaviorAlerts(enabled: boolean = true) {
    const processedEvents = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!enabled) return;

        const syncEvents = async () => {
            const { data: events, error } = await supabase
                .from('driver_behavior_events')
                .select('id, driver_name, fleet_number, event_type, event_date, severity, description, location, status, points')
                .in('status', ['pending', 'identified'])
                .order('event_date', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Error fetching driver behavior events:', error);
                return;
            }

            for (const event of (events as BehaviorEvent[]) || []) {
                if (processedEvents.current.has(event.id)) continue;
                processedEvents.current.add(event.id);

                const severity = SEVERITY_MAP[event.severity ?? ''] ?? 'medium';
                const typeName = formatEventType(event.event_type);

                await ensureAlert({
                    sourceType: 'driver',
                    sourceId: event.id,
                    sourceLabel: event.driver_name,
                    category: 'driver_behavior',
                    severity,
                    title: `${typeName}: ${event.driver_name}`,
                    message: `${event.description}${event.location ? ` at ${event.location}` : ''} on ${event.event_date}`,
                    fleetNumber: event.fleet_number,
                    metadata: {
                        event_id: event.id,
                        driver_name: event.driver_name,
                        fleet_number: event.fleet_number,
                        event_type: event.event_type,
                        event_date: event.event_date,
                        severity: event.severity,
                        location: event.location,
                        points: event.points,
                        status: event.status,
                        issue_type: 'driver_behavior',
                    },
                }).catch(err => console.error('Failed to create driver behavior alert:', err));
            }
        };

        syncEvents();

        const subscription = supabase
            .channel('driver-behavior-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_behavior_events' },
                async (payload) => {
                    const newRow = payload.new as BehaviorEvent | undefined;
                    if (newRow?.id) {
                        processedEvents.current.delete(newRow.id);
                    }
                    syncEvents();
                }
            )
            .subscribe();

        const interval = setInterval(syncEvents, 10 * 60 * 1000);

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [enabled]);
}
