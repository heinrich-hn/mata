import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, MapPin, Truck, UserX } from "lucide-react";
import { useState } from "react";
import { ExportMenu } from "@/components/ExportMenu";
import { exportDriverBehavior } from "@/lib/monitorExport";

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

    // Group events by driver name
    const groups = groupByDriver(events);

    return (
        <div className="monitor-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Driver Behavior</h1>
                    <p className="text-sm text-slate-500 mt-1">Pending behavior events by driver</p>
                </div>
                <ExportMenu
                    disabled={events.length === 0}
                    onExport={(target) => exportDriverBehavior(events, target)}
                />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50/40 to-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Events</p>
                                <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-blue-100">
                                <UserX className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/40 to-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Pending Debrief</p>
                                <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.pending}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-amber-100">
                                <UserX className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Events grouped by driver */}
            {events.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-[0.8125rem] text-slate-400">No pending driver behavior events</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {groups.map(([driver, items]) => (
                        <DriverGroup key={driver} driverName={driver} count={items.length}>
                            {items.map(event => (
                                <EntryRow key={event.id}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 text-[0.6875rem]">
                                                    {formatType(event.event_type)}
                                                </Badge>
                                                {event.severity && (
                                                    <Badge className={cn('text-[0.6875rem] px-1.5 py-0 capitalize', severityBadge(event.severity))}>
                                                        {event.severity}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[0.8125rem] text-slate-700 mt-1">{event.description}</p>
                                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
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
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs text-slate-400">
                                                {format(new Date(event.event_date), 'dd MMM yyyy')}
                                                {event.event_time ? ` ${event.event_time}` : ''}
                                            </p>
                                            {event.points != null && (
                                                <p className="text-xs font-semibold text-blue-700 mt-0.5">{event.points} pts</p>
                                            )}
                                        </div>
                                    </div>
                                </EntryRow>
                            ))}
                        </DriverGroup>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function severityBadge(severity: string) {
    switch (severity) {
        case 'critical':
        case 'high':
            return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'medium':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'low':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        default:
            return 'bg-slate-100 text-slate-600 border-slate-200';
    }
}

function groupByDriver(items: BehaviorEvent[]) {
    const map = new Map<string, BehaviorEvent[]>();
    for (const item of items) {
        const key = item.driver_name || 'Unknown';
        const existing = map.get(key);
        if (existing) {
            existing.push(item);
        } else {
            map.set(key, [item]);
        }
    }
    return Array.from(map.entries());
}

// ── Collapsible driver group ──────────────────────────────────────────────

function DriverGroup({
    driverName,
    count,
    children,
}: {
    driverName: string;
    count: number;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(count === 1);

    return (
        <Card className="overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    open ? 'bg-blue-50' : 'hover:bg-slate-50'
                )}
            >
                <div className="p-1.5 rounded-md bg-blue-50">
                    <UserX className={cn('h-4 w-4', open ? 'text-blue-600' : 'text-blue-500')} />
                </div>
                <span className="font-semibold text-[0.8125rem] text-slate-900">{driverName}</span>
                <Badge className="ml-auto text-[0.6875rem] bg-blue-100 text-blue-700 border-blue-200">
                    {count} {count === 1 ? 'event' : 'events'}
                </Badge>
                <ChevronDown className={cn(
                    'h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0',
                    open && 'rotate-180'
                )} />
            </button>

            {open && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {children}
                </div>
            )}
        </Card>
    );
}

// ── Entry row (consistent with FaultsPage) ────────────────────────────────

function EntryRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-4 py-3 hover:bg-slate-50/70 transition-colors">
            {children}
        </div>
    );
}