import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    useFleetBreakdowns,
    type FleetBreakdown,
} from "@/hooks/useFleetBreakdowns";
import { format } from "date-fns";
import {
    AlertTriangle,
    Calendar,
    Loader2,
    MapPin,
    Phone,
    Truck,
    Wrench,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CallOutForm } from "./CallOutForm";

function getSeverityVariant(severity: string): "default" | "destructive" | "secondary" {
    switch (severity) {
        case "critical":
        case "high":
            return "destructive";
        case "medium":
            return "default";
        default:
            return "secondary";
    }
}

export function BreakdownsPanel() {
    const { data: breakdowns = [], isLoading } = useFleetBreakdowns();
    const navigate = useNavigate();
    const [callOutBreakdown, setCallOutBreakdown] = useState<FleetBreakdown | null>(null);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (breakdowns.length === 0) {
        return (
            <div className="text-center py-12">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-1">No Pending Breakdowns</h3>
                <p className="text-sm text-muted-foreground">
                    All breakdowns have been handled.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground px-1">
                {breakdowns.length} pending breakdown{breakdowns.length !== 1 ? "s" : ""}
            </p>

            {breakdowns.map((bd) => (
                <Card key={bd.id} className="shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-base">
                                    {bd.vehicle_fleet_number || bd.vehicle_registration || "Unknown Vehicle"}
                                </CardTitle>
                            </div>
                            <Badge variant={getSeverityVariant(bd.severity)} className="capitalize">
                                {bd.severity}
                            </Badge>
                        </div>
                        {bd.vehicle_registration && bd.vehicle_fleet_number && (
                            <CardDescription className="text-xs">{bd.vehicle_registration}</CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-sm">{bd.description}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(bd.breakdown_date), "dd MMM yyyy HH:mm")}
                                </span>
                                {bd.driver_name && (
                                    <span>{bd.driver_name}</span>
                                )}
                                {bd.location && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {bd.location}
                                    </span>
                                )}
                            </div>
                            {bd.category && (
                                <Badge variant="outline" className="capitalize text-xs mt-1">
                                    {bd.category.replace("_", " ")}
                                </Badge>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                    const params = new URLSearchParams();
                                    if (bd.vehicle_registration) params.set('vehicle', bd.vehicle_registration);
                                    params.set('breakdownId', bd.id);
                                    params.set('notes', `Breakdown: ${bd.description}${bd.location ? ` @ ${bd.location}` : ""}`);
                                    navigate(`/inspections/mobile?${params.toString()}`);
                                }}
                            >
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Schedule Inspection
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => setCallOutBreakdown(bd)}
                            >
                                <Phone className="h-4 w-4 mr-1" />
                                Call Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {callOutBreakdown && (
                <CallOutForm
                    breakdown={callOutBreakdown}
                    open={!!callOutBreakdown}
                    onClose={() => setCallOutBreakdown(null)}
                />
            )}
        </div>
    );
}
