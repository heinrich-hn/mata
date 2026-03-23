import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Truck } from "lucide-react";

interface GeofenceEventRow {
    id: string;
    event_type: string;
    event_timestamp: string;
    vehicle_id: string;
    geofence_zone_id: string;
    dwell_duration_minutes: number | null;
    vehicles: { fleet_number: string | null } | null;
    geofences: { name: string; zone_type: string | null } | null;
}

const EVENT_COLORS: Record<string, string> = {
    entered: 'bg-green-500/10 text-green-500 border-green-500/20',
    exited: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    dwell: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

export default function GeofencePage() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: events = [], isLoading } = useQuery({
        queryKey: ['geofence-page', since.slice(0, 13)], // bucket by hour
        queryFn: async () => {
            const { data, error } = await supabase
                .from('geofence_events')
                .select(`
          id, event_type, event_timestamp, vehicle_id, geofence_zone_id,
          dwell_duration_minutes,
          vehicles:vehicle_id (fleet_number),
          geofences:geofence_zone_id (name, zone_type)
        `)
                .gte('event_timestamp', since)
                .order('event_timestamp', { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data ?? []) as unknown as GeofenceEventRow[];
        },
        refetchInterval: 60000,
    });

    const stats = {
        total: events.length,
        entries: events.filter(e => e.event_type === 'entered').length,
        exits: events.filter(e => e.event_type === 'exited').length,
        dwells: events.filter(e => e.event_type === 'dwell').length,
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Geofence Events</h1>
                    <p className="text-sm text-muted-foreground">Zone entry, exit, and dwell events (last 24h)</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-500">{stats.entries}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Exits</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-500">{stats.exits}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Dwells</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-amber-500">{stats.dwells}</div></CardContent>
                </Card>
            </div>

            <div className="space-y-3">
                {events.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">No geofence events in the last 24 hours</CardContent></Card>
                ) : (
                    events.map(event => {
                        const fleet = Array.isArray(event.vehicles) ? event.vehicles[0]?.fleet_number : event.vehicles?.fleet_number;
                        const zone = Array.isArray(event.geofences) ? event.geofences[0] : event.geofences;
                        return (
                            <Card key={event.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline" className={EVENT_COLORS[event.event_type] ?? ''}>
                                                {event.event_type}
                                            </Badge>
                                            <div>
                                                <p className="font-medium">{zone?.name ?? 'Unknown Zone'}</p>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    {fleet && <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{fleet}</span>}
                                                    {zone?.zone_type && <Badge variant="secondary" className="text-xs">{zone.zone_type}</Badge>}
                                                    <span>{format(new Date(event.event_timestamp), 'dd MMM yyyy HH:mm')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {event.dwell_duration_minutes != null && event.dwell_duration_minutes > 0 && (
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Dwell</p>
                                                <p className="font-semibold">{event.dwell_duration_minutes} min</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
