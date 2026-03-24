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

    const typeBadgeClasses = [
        "bg-blue-50 text-blue-700 border-blue-200",
        "bg-amber-50 text-amber-700 border-amber-200",
        "bg-rose-50 text-rose-700 border-rose-200",
        "bg-emerald-50 text-emerald-700 border-emerald-200",
    ];

    const severityClasses = (severity?: string | null) => {
        switch (severity) {
            case 'critical':
            case 'high':
                return "border-l-rose-400";
            case 'medium':
                return "border-l-amber-400";
            case 'low':
                return "border-l-emerald-400";
            default:
                return "border-l-blue-300";
        }
    };

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
        <div className="monitor-page">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-blue-700/80">
                            Total Events
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                        <div className="text-xl font-bold text-blue-700">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-amber-700/80">
                            Pending Debrief
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                        <div className="text-xl font-bold text-amber-700">{stats.pending}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Event type breakdown */}
            {Object.keys(byType).length > 0 && (
                <Card className="monitor-soft-panel">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500">
                            By Event Type
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                                <Badge
                                    key={type}
                                    variant="secondary"
                                    className={`text-xs ${typeBadgeClasses[count % typeBadgeClasses.length]}`}
                                >
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
                    <Card className="monitor-soft-panel">
                        <CardContent className="p-8 text-center">
                            <p className="text-slate-500 text-sm">No pending driver behavior events</p>
                        </CardContent>
                    </Card>
                ) : (
                    events.map(event => (
                        <Card key={event.id} className={`monitor-soft-entry border-l-2 ${severityClasses(event.severity)} hover:shadow-md transition-shadow`}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-slate-900">{event.driver_name}</span>
                                            <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
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
                                            <p className="text-xs text-slate-500">Points</p>
                                            <p className="font-semibold text-blue-700">{event.points}</p>
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