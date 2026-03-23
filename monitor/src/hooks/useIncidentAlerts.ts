import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureAlert, resolveAlertsBySource } from '@/lib/alertUtils';

interface IncidentRow {
    id: string;
    incident_number: string;
    incident_type: string;
    incident_date: string;
    incident_time: string;
    status: string;
    severity_rating: number | null;
    description: string | null;
    location: string;
    driver_name: string | null;
    vehicle_number: string | null;
    vehicle_id: string | null;
    total_cost: number | null;
}

const SEVERITY_MAP: Record<number, 'critical' | 'high' | 'medium' | 'low'> = {
    5: 'critical',
    4: 'critical',
    3: 'high',
    2: 'medium',
    1: 'low',
};

function formatIncidentType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function useIncidentAlerts(enabled: boolean = true) {
    const processedIncidents = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!enabled) return;

        const syncIncidents = async () => {
            const { data: incidents, error } = await supabase
                .from('incidents')
                .select('id, incident_number, incident_type, incident_date, incident_time, status, severity_rating, description, location, driver_name, vehicle_number, vehicle_id, total_cost')
                .in('status', ['open', 'processing'])
                .order('incident_date', { ascending: false });

            if (error) {
                console.error('Error fetching incidents:', error);
                return;
            }

            for (const incident of incidents || []) {
                if (processedIncidents.current.has(incident.id)) continue;
                processedIncidents.current.add(incident.id);

                const severity = SEVERITY_MAP[incident.severity_rating ?? 2] ?? 'medium';
                const typeName = formatIncidentType(incident.incident_type);

                await ensureAlert({
                    sourceType: 'vehicle',
                    sourceId: incident.vehicle_id ?? incident.id,
                    sourceLabel: `Incident: ${incident.incident_number}`,
                    category: 'vehicle_fault',
                    severity,
                    title: `${typeName}: ${incident.incident_number}`,
                    message: `${typeName} at ${incident.location} on ${incident.incident_date}${incident.driver_name ? ` — Driver: ${incident.driver_name}` : ''}`,
                    fleetNumber: incident.vehicle_number,
                    metadata: {
                        incident_id: incident.id,
                        incident_number: incident.incident_number,
                        incident_type: incident.incident_type,
                        incident_date: incident.incident_date,
                        status: incident.status,
                        severity_rating: incident.severity_rating,
                        description: incident.description,
                        location: incident.location,
                        driver_name: incident.driver_name,
                        vehicle_number: incident.vehicle_number,
                        total_cost: incident.total_cost,
                        issue_type: 'incident',
                    },
                }).catch(err => console.error('Failed to create incident alert:', err));
            }
        };

        syncIncidents();

        const subscription = supabase
            .channel('incidents-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' },
                async (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        const newRow = payload.new as IncidentRow;
                        if (newRow.status === 'closed' || newRow.status === 'claimed') {
                            if (newRow.vehicle_id) {
                                await resolveAlertsBySource('vehicle', newRow.vehicle_id);
                            }
                            processedIncidents.current.delete(newRow.id);
                        } else {
                            processedIncidents.current.delete(newRow.id);
                        }
                    }
                    syncIncidents();
                }
            )
            .subscribe();

        const interval = setInterval(syncIncidents, 5 * 60 * 1000);

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [enabled]);
}
