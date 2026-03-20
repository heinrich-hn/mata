import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface VehicleStats {
  totalVehicles: number;
  totalPositions: number;
  filledPositions: number;
  emptyPositions: number;
}

interface Inspection {
  id: string;
  inspection_number: string;
  inspection_date: string;
  vehicle_id: string | null;
  has_fault: boolean | null;
}

interface Vehicle {
  id: string;
  fleet_number: string | null;
  registration_number: string | null;
}

interface QuickActionButtonProps {
  label: string;
  description?: string;
  onClick: () => void;
  variant?: "default" | "outline";
}

const StatCard = ({ value, label, color = "text-foreground", bgGradient }: {
  value: number;
  label: string;
  color?: string;
  bgGradient?: string;
}) => (
  <Card className={cn("border border-border/40 shadow-sm rounded-2xl", bgGradient && `bg-gradient-to-br ${bgGradient}`)}>
    <CardContent className="p-4">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
    </CardContent>
  </Card>
);

const QuickActionButton = ({ label, description, onClick }: QuickActionButtonProps) => (
  <Button
    variant="outline"
    className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl border-2 hover:bg-accent active:scale-[0.97] transition-all w-full group"
    onClick={onClick}
  >
    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
      <span className="text-lg font-bold text-primary">+</span>
    </div>
    <div className="text-center">
      <span className="text-sm font-semibold block">{label}</span>
      {description && (
        <span className="text-[10px] text-muted-foreground">{description}</span>
      )}
    </div>
  </Button>
);

const InspectionCardSkeleton = () => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </CardContent>
  </Card>
);

const MobileTyresTab = () => {
  const navigate = useNavigate();

  // Vehicle tyre stats
  const { data: vehicleStats, isLoading: statsLoading } = useQuery<VehicleStats>({
    queryKey: ["tyre-vehicle-stats-mobile"],
    queryFn: async () => {
      const [positionsResult, vehiclesResult] = await Promise.all([
        supabase.from("fleet_tyre_positions").select("id, tyre_code").limit(2000),
        supabase.from("vehicles").select("id").limit(500),
      ]);

      const positions = positionsResult.data || [];
      const totalVehicles = vehiclesResult.data?.length || 0;
      const filledPositions = positions.filter(p => p.tyre_code && !p.tyre_code.startsWith("NEW_CODE_")).length;
      const emptyPositions = positions.length - filledPositions;

      return {
        totalVehicles,
        totalPositions: positions.length,
        filledPositions,
        emptyPositions
      };
    },
    refetchInterval: 60000,
  });

  // Recent tyre inspections
  const { data: recentInspections = [], isLoading: inspectionsLoading } = useQuery<Inspection[]>({
    queryKey: ["tyre-inspections-recent-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("id, inspection_number, inspection_date, vehicle_id, has_fault")
        .eq("inspection_type", "tyre")
        .order("inspection_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Vehicles lookup
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["vehicles-lookup-tyres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number");
      if (error) throw error;
      return data || [];
    },
  });

  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  const getInstallationProgress = () => {
    if (!vehicleStats || vehicleStats.totalPositions === 0) return 0;
    return Math.round((vehicleStats.filledPositions / vehicleStats.totalPositions) * 100);
  };

  return (
    <div className="px-4 py-4 space-y-6 pb-safe-bottom">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickActionButton
          label="Tyre Inspection"
          description="Record new inspection"
          onClick={() => navigate("/inspections/tyre")}
        />
        <QuickActionButton
          label="Vehicle Store"
          description="Manage positions"
          onClick={() => navigate("/tyre-management")}
        />
      </div>

      {/* Stats Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Overview
          </h2>
          {vehicleStats && vehicleStats.totalPositions > 0 && (
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
              {getInstallationProgress()}% installed
            </Badge>
          )}
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              value={vehicleStats?.totalVehicles || 0}
              label="Vehicles"
            />
            <StatCard
              value={vehicleStats?.filledPositions || 0}
              label="Installed"
              color="text-emerald-600"
              bgGradient="from-emerald-50 to-emerald-100/60"
            />
            <StatCard
              value={vehicleStats?.emptyPositions || 0}
              label="Empty"
              color="text-amber-600"
              bgGradient="from-amber-50 to-amber-100/60"
            />
          </div>
        )}

        {/* Progress Bar */}
        {vehicleStats && vehicleStats.totalPositions > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Installation Progress</span>
              <span>{vehicleStats.filledPositions} / {vehicleStats.totalPositions}</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${getInstallationProgress()}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Recent Tyre Inspections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Inspections
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate("/inspections?type=tyre")}
          >
            View all
          </Button>
        </div>

        {inspectionsLoading ? (
          <div className="space-y-2">
            <InspectionCardSkeleton />
            <InspectionCardSkeleton />
            <InspectionCardSkeleton />
          </div>
        ) : recentInspections.length === 0 ? (
          <Card className="rounded-2xl shadow-sm border border-border/40 bg-muted/30">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/60 mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-muted-foreground">0</span>
              </div>
              <h3 className="font-bold mb-1">No inspections yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start recording tyre inspections
              </p>
              <Button
                onClick={() => navigate("/inspections/tyre")}
                className="rounded-xl font-semibold"
              >
                New Inspection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentInspections.map((insp) => {
              const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;

              return (
                <Card
                  key={insp.id}
                  className="active:scale-[0.98] transition-transform cursor-pointer rounded-2xl shadow-sm border border-border/40 hover:shadow-md"
                  onClick={() => navigate(`/inspections/${insp.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono text-muted-foreground">
                            {insp.inspection_number}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(insp.inspection_date)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          {vehicle && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/60 font-medium text-xs">
                              {vehicle.fleet_number || vehicle.registration_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {insp.has_fault ? (
                          <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-lg font-semibold">
                            Fault Found
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] px-2 py-0.5 rounded-lg font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">
                            Passed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {vehicleStats && (
        <div className="text-center pt-2">
          <p className="text-[10px] text-muted-foreground">
            {vehicleStats.totalPositions} total positions across {vehicleStats.totalVehicles} vehicles
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileTyresTab;