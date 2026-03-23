import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Truck } from "lucide-react";

interface BehaviorEvent {
    id: string;
    driver_name: string;
    fleet_number: string | null;
    event_type: string;
    event_date: string;
    event_time: string | null;
    severity: string | null;
    description: string;
    location: string | null;
    status: string | null;
    points: number | null;
}

function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function DriverBehaviorPage() {
    const { data: events = [], isLoading } = useQuery({
        queryKey: ['driver-behavior-page'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('driver_behavior_events')
                .select('id, driver_name, fleet_number, event_type, event_date, event_time, severity, description, location, status, points')
                .in('status', ['pending', 'identified'])
                .order('event_date', { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data ?? []) as BehaviorEvent[];
        },
        refetchInterval: 60000,
    });

    const stats = {
        total: events.length,
        pending: events.filter(e => e.status === 'pending').length,
    };

    // Group by event type
    const byType = events.reduce((acc, e) => {
        const type = formatType(e.event_type);
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading driver behavior events...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Stats Cards - Neutral colors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500">
                            Total Events
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500">
                            Pending Debrief
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.pending}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Event type breakdown */}
            {Object.keys(byType).length > 0 && (
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500">
                            By Event Type
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                                <Badge key={type} variant="secondary" className="text-sm bg-slate-100 text-slate-600 border-slate-200">
                                    {type}: {count}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Events List */}
            <div className="space-y-3">
                {events.length === 0 ? (
                    <Card className="border-slate-200">
                        <CardContent className="p-8 text-center">
                            <p className="text-slate-500 text-sm">No pending driver behavior events</p>
                        </CardContent>
                    </Card>
                ) : (
                    events.map(event => (
                        <Card key={event.id} className="border-slate-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-900">{event.driver_name}</span>
                                            <Badge variant="outline" className="border-slate-200 text-slate-600">
                                                {formatType(event.event_type)}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2">{event.description}</p>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            {event.fleet_number && (
                                                <span className="flex items-center gap-1">
                                                    <Truck className="h-3 w-3" />
                                                    {event.fleet_number}
                                                </span>
                                            )}
                                            {event.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {event.location}
                                                </span>
                                            )}
                                            <span>
                                                {format(new Date(event.event_date), 'dd MMM yyyy')}
                                                {event.event_time ? ` ${event.event_time}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    {event.points != null && (
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400">Points</p>
                                            <p className="font-semibold text-slate-900">{event.points}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}