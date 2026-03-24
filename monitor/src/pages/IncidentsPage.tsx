import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, User, Truck } from "lucide-react";

interface Incident {
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
    total_cost: number | null;
}

function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function IncidentsPage() {
    const { data: incidents = [], isLoading } = useQuery({
        queryKey: ['incidents-page'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('incidents')
                .select('id, incident_number, incident_type, incident_date, incident_time, status, severity_rating, description, location, driver_name, vehicle_number, total_cost')
                .in('status', ['open', 'processing'])
                .order('incident_date', { ascending: false });
            if (error) throw error;
            return (data ?? []) as Incident[];
        },
        refetchInterval: 30000,
    });

    const stats = {
        total: incidents.length,
        open: incidents.filter(i => i.status === 'open').length,
        processing: incidents.filter(i => i.status === 'processing').length,
    };

    const statusClass = (status: string) => {
        if (status === 'open') return 'border-rose-200 text-rose-700 bg-rose-50';
        if (status === 'processing') return 'border-amber-200 text-amber-700 bg-amber-50';
        return 'border-slate-200 text-slate-600 bg-slate-50';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading incidents...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="monitor-page">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-blue-700/80">
                            Total Open
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                        <div className="text-xl font-bold text-blue-700">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-rose-200/80 bg-gradient-to-br from-rose-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-rose-700/80">
                            Open
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                        <div className="text-xl font-bold text-rose-700">{stats.open}</div>
                    </CardContent>
                </Card>
                <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/55 to-white">
                    <CardHeader className="pb-1 pt-2 px-3">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-amber-700/80">
                            Processing
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                        <div className="text-xl font-bold text-amber-700">{stats.processing}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Incidents List */}
            <div className="space-y-3">
                {incidents.length === 0 ? (
                    <Card className="monitor-soft-panel">
                        <CardContent className="p-8 text-center">
                            <p className="text-slate-500 text-sm">No open incidents</p>
                        </CardContent>
                    </Card>
                ) : (
                    incidents.map(incident => (
                        <Card key={incident.id} className={`monitor-soft-entry border-l-2 ${incident.status === 'open' ? 'border-l-rose-400' : 'border-l-amber-400'} hover:shadow-md transition-shadow`}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-slate-900">{incident.incident_number}</span>
                                            <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                                                {formatType(incident.incident_type)}
                                            </Badge>
                                            <Badge variant="outline" className={statusClass(incident.status)}>
                                                {incident.status}
                                            </Badge>
                                        </div>
                                        {incident.description && (
                                            <p className="text-sm text-slate-600 line-clamp-2">{incident.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {incident.location}
                                            </span>
                                            {incident.driver_name && (
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {incident.driver_name}
                                                </span>
                                            )}
                                            {incident.vehicle_number && (
                                                <span className="flex items-center gap-1">
                                                    <Truck className="h-3 w-3" />
                                                    {incident.vehicle_number}
                                                </span>
                                            )}
                                            <span>
                                                {format(new Date(incident.incident_date), 'dd MMM yyyy')} {incident.incident_time}
                                            </span>
                                        </div>
                                    </div>
                                    {incident.total_cost != null && incident.total_cost > 0 && (
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">Est. Cost</p>
                                            <p className="font-semibold text-rose-700">R {incident.total_cost.toLocaleString()}</p>
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