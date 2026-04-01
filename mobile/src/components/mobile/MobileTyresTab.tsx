import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

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

  return (
    <div className="px-4 py-4 space-y-4 pb-safe-bottom">
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
              <p className="text-sm text-muted-foreground">
                Start recording tyre inspections
              </p>
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
    </div>
  );
};

export default MobileTyresTab;