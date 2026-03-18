// src/components/loads/calendar/VehicleAllocationView.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, CheckCircle2, Truck } from "lucide-react";

interface VehicleAllocation {
  vehicle: {
    id: string;
    fleet_number: string;
    name: string;
  };
  assignedLoads: number;
  totalCapacity: number;
  utilizedCapacity: number;
  utilizationPercentage: number;
  status: "available" | "partial" | "full" | "overbooked";
  upcomingEvents: number;
}

export const VehicleAllocationView = ({ date }: { date: Date }) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ["vehicle-allocations", date.toISOString()],
    queryFn: async () => {
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("wialon_vehicles")
        .select("id, fleet_number, name")
        .order("fleet_number");

      if (vehiclesError) throw vehiclesError;

      const { data: events, error: eventsError } = await supabase
        .from("calendar_events")
        .select(
          `
          *,
          load:loads(weight_kg, status)
        `
        )
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString());

      if (eventsError) throw eventsError;

      const vehicleAllocations: VehicleAllocation[] = (vehicles || []).map(
        (vehicle) => {
          const vehicleEvents = (events || []).filter(
            (e) => e.assigned_vehicle_id === vehicle.id
          );

          const assignedLoads = vehicleEvents.filter(
            (e) =>
              e.load_id &&
              (e.event_type === "pickup" || e.event_type === "delivery")
          ).length;

          const totalWeight = vehicleEvents
            .filter((e) => e.load?.weight_kg)
            .reduce((sum, e) => sum + (e.load?.weight_kg || 0), 0);

          const maxCapacity = 25_000;
          const utilizationPercentage = Math.min(
            (totalWeight / maxCapacity) * 100,
            100
          );

          let status: VehicleAllocation["status"] = "available";
          if (utilizationPercentage >= 100) status = "overbooked";
          else if (utilizationPercentage >= 90) status = "full";
          else if (utilizationPercentage >= 50) status = "partial";

          return {
            vehicle,
            assignedLoads,
            totalCapacity: maxCapacity,
            utilizedCapacity: totalWeight,
            utilizationPercentage,
            status,
            upcomingEvents: vehicleEvents.length,
          };
        }
      );

      return vehicleAllocations;
    },
  });

  const getStatusColor = (status: VehicleAllocation["status"]) => {
    switch (status) {
      case "available":
        return "text-green-600 bg-green-50";
      case "partial":
        return "text-blue-600 bg-blue-50";
      case "full":
        return "text-orange-600 bg-orange-50";
      case "overbooked":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: VehicleAllocation["status"]) => {
    switch (status) {
      case "available":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "partial":
        return <Truck className="h-5 w-5 text-blue-600" />;
      case "full":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case "overbooked":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Truck className="h-5 w-5 text-gray-600" />;
    }
  };

  const getProgressClass = (percentage: number) => {
    if (percentage >= 100) return "[&>div]:bg-red-500";
    if (percentage >= 90) return "[&>div]:bg-orange-500";
    if (percentage >= 50) return "[&>div]:bg-blue-500";
    return "[&>div]:bg-green-500";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center text-muted-foreground">
            Loading vehicle allocations...
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = {
    total: allocations.length,
    available: allocations.filter((a) => a.status === "available").length,
    partial: allocations.filter((a) => a.status === "partial").length,
    full: allocations.filter((a) => a.status === "full").length,
    overbooked: allocations.filter((a) => a.status === "overbooked").length,
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Vehicles</div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-green-600">Available</div>
            <div className="text-2xl font-bold text-green-600">
              {summary.available}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-blue-600">Partial</div>
            <div className="text-2xl font-bold text-blue-600">
              {summary.partial}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-orange-600">Full</div>
            <div className="text-2xl font-bold text-orange-600">
              {summary.full}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-red-600">Overbooked</div>
            <div className="text-2xl font-bold text-red-600">
              {summary.overbooked}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Vehicle Allocation - {date.toLocaleDateString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allocations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No vehicles found</p>
              </div>
            ) : (
              allocations.map((allocation) => (
                <div
                  key={allocation.vehicle.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(allocation.status)}
                      <div>
                        <div className="font-semibold">
                          {allocation.vehicle.fleet_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {allocation.vehicle.name}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "capitalize",
                        getStatusColor(allocation.status)
                      )}
                    >
                      {allocation.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">
                        Assigned Loads
                      </div>
                      <div className="font-semibold">
                        {allocation.assignedLoads}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Capacity Used</div>
                      <div className="font-semibold">
                        {allocation.utilizedCapacity.toLocaleString()} kg
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Upcoming Events
                      </div>
                      <div className="font-semibold">
                        {allocation.upcomingEvents}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="font-semibold">
                        {allocation.utilizationPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={allocation.utilizationPercentage}
                      className={cn("h-2", getProgressClass(allocation.utilizationPercentage))}
                    />
                    <div className="text-xs text-muted-foreground">
                      {allocation.utilizedCapacity.toLocaleString()} /{" "}
                      {allocation.totalCapacity.toLocaleString()} kg
                    </div>
                  </div>

                  {allocation.status === "overbooked" && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        Warning: Vehicle is overbooked! Review load assignments.
                      </span>
                    </div>
                  )}
                  {allocation.status === "full" && (
                    <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Capacity nearly full. Limit reached at 90%.</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
