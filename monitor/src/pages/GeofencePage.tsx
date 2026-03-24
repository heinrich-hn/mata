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
    entered: 'bg-green-50 text-green-700 border-green-200',
    exited: 'bg-blue-50 text-blue-700 border-blue-200',
    dwell: 'bg-amber-50 text-amber-700 border-amber-200',
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
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading geofence events...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="monitor-page">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Geofence Events</h1>
                    <p className="text-sm text-slate-500">Zone entry, exit, and dwell events (last 24h)</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-200/80 bg-gradient-to-br from-slate-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3"><CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Events</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2 pt-0"><div className="text-xl font-bold text-slate-900">{stats.total}</div></CardContent>
                </Card>
                <Card className="border-green-200/80 bg-gradient-to-br from-green-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3"><CardTitle className="text-xs font-medium uppercase tracking-wider text-green-700/80">Entries</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2 pt-0"><div className="text-xl font-bold text-green-700">{stats.entries}</div></CardContent>
                </Card>
                <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3"><CardTitle className="text-xs font-medium uppercase tracking-wider text-blue-700/80">Exits</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2 pt-0"><div className="text-xl font-bold text-blue-700">{stats.exits}</div></CardContent>
                </Card>
                <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3"><CardTitle className="text-xs font-medium uppercase tracking-wider text-amber-700/80">Dwells</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2 pt-0"><div className="text-xl font-bold text-amber-700">{stats.dwells}</div></CardContent>
                </Card>
            </div>

            <div className="space-y-3">
                {events.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-slate-500">No geofence events in the last 24 hours</CardContent></Card>
                ) : (
                    events.map(event => {
                        const fleet = Array.isArray(event.vehicles) ? event.vehicles[0]?.fleet_number : event.vehicles?.fleet_number;
                        const zone = Array.isArray(event.geofences) ? event.geofences[0] : event.geofences;
                        return (
                            <Card key={event.id} className={`border-slate-200 hover:shadow-md transition-shadow border-l-2 ${event.event_type === 'entered' ? 'border-l-green-400' :
                                event.event_type === 'exited' ? 'border-l-blue-400' :
                                    event.event_type === 'dwell' ? 'border-l-amber-400' : 'border-l-slate-300'
                                }`}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline" className={EVENT_COLORS[event.event_type] ?? ''}>
                                                {event.event_type}
                                            </Badge>
                                            <div>
                                                <p className="font-medium">{zone?.name ?? 'Unknown Zone'}</p>
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    {fleet && <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{fleet}</span>}
                                                    {zone?.zone_type && <Badge variant="secondary" className="text-xs">{zone.zone_type}</Badge>}
                                                    <span>{format(new Date(event.event_timestamp), 'dd MMM yyyy HH:mm')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {event.dwell_duration_minutes != null && event.dwell_duration_minutes > 0 && (
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500">Dwell</p>
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
