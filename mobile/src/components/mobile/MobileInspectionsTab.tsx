import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import ResolveFaultDialog from "@/components/dialogs/ResolveFaultDialog";

// ============================================================================
// Types
// ============================================================================
interface Inspection {
  id: string;
  inspection_number: string;
  inspection_date: string;
  inspection_type: string | null;
  inspector_name: string | null;
  location: string | null;
  has_fault: boolean | null;
  fault_resolved: boolean | null;
  vehicle_id: string | null;
  status: string | null;
}

interface InspectionFault {
  id: string;
  severity: string | null;
  corrective_action_status: string | null;
}

interface InspectionWithFaults extends Inspection {
  inspection_faults?: InspectionFault[];
}

interface Vehicle {
  id: string;
  fleet_number: string | null;
  registration_number: string | null;
}

interface VehicleFault {
  id: string;
  fault_number: string | null;
  fault_description: string | null;
  severity: string | null;
  status: string | null;
  component: string | null;
  reported_date: string | null;
  reported_by: string | null;
  vehicle_id: string | null;
  inspection_fault_id: string | null;
  inspection_id: string | null;
}

const FAULT_SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-blue-50 text-blue-700 border-blue-200",
};

const FAULT_STATUS_STYLES: Record<string, string> = {
  identified: "bg-red-50 text-red-700 border-red-200",
  acknowledged: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ============================================================================
// Constants
// ============================================================================
const STATUS_CONFIG = {
  completed: {
    variant: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  in_progress: {
    variant: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  scheduled: {
    variant: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  cancelled: {
    variant: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

const FAULT_STATUS_COLORS = {
  open: "border-l-rose-500",
  resolved: "border-l-amber-500",
  none: "border-l-emerald-500",
} as const;

// ============================================================================
// Sub-components
// ============================================================================
const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return null;

  const config = STATUS_CONFIG[status as StatusKey];
  if (!config) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold border bg-gray-50 text-gray-700 border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        <span className="capitalize">{status.replace("_", " ")}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold border",
        config.variant
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      <span className="capitalize">{status.replace("_", " ")}</span>
    </div>
  );
};

const InspectionCardSkeleton = () => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </CardContent>
  </Card>
);

const InspectionCard = ({
  inspection,
  vehicle,
  onClick
}: {
  inspection: Inspection;
  vehicle?: Vehicle;
  onClick: (id: string) => void;
}) => {
  const faultColor = useMemo(() => {
    if (inspection.has_fault && !inspection.fault_resolved) return FAULT_STATUS_COLORS.open;
    if (inspection.has_fault && inspection.fault_resolved) return FAULT_STATUS_COLORS.resolved;
    return FAULT_STATUS_COLORS.none;
  }, [inspection.has_fault, inspection.fault_resolved]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(inspection.id);
    }
  }, [onClick, inspection.id]);

  return (
    <Card
      className={cn(
        "active:scale-[0.98] transition-all cursor-pointer rounded-2xl shadow-sm hover:shadow-md border border-border/40 border-l-4 touch-target",
        faultColor
      )}
      onClick={() => onClick(inspection.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">
                {inspection.inspection_number}
              </span>
              {inspection.has_fault && !inspection.fault_resolved && (
                <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-lg font-semibold">
                  Open Fault
                </Badge>
              )}
              {inspection.has_fault && inspection.fault_resolved && (
                <Badge className="text-[10px] px-2 py-0.5 rounded-lg font-semibold bg-amber-100 text-amber-700 border-amber-200">
                  Resolved
                </Badge>
              )}
            </div>
            <p className="text-sm font-bold truncate">
              {inspection.inspection_type || "Vehicle Inspection"}
            </p>
          </div>
          <StatusBadge status={inspection.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {vehicle && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/60 font-medium truncate max-w-[140px]">
              {vehicle.fleet_number || vehicle.registration_number || "No vehicle"}
            </span>
          )}
          {inspection.inspector_name && (
            <span className="truncate max-w-[100px]">{inspection.inspector_name}</span>
          )}
          {inspection.inspection_date && (
            <span>
              {new Date(inspection.inspection_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {inspection.location && (
            <span className="truncate max-w-[120px]">{inspection.location}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({
  hasSearch,
  onNewInspection
}: {
  hasSearch: boolean;
  onNewInspection: () => void;
}) => (
  <div className="text-center py-12 px-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/60 mx-auto mb-4 flex items-center justify-center">
      <span className="text-2xl font-bold text-muted-foreground">0</span>
    </div>
    <h3 className="font-bold mb-1">No inspections found</h3>
    <p className="text-sm text-muted-foreground mb-4">
      {hasSearch ? "Try adjusting your search" : "Create your first inspection to get started"}
    </p>
    {!hasSearch && (
      <Button onClick={onNewInspection} className="rounded-xl font-semibold">
        New Inspection
      </Button>
    )}
  </div>
);

const EmptyFaultsState = () => (
  <div className="text-center py-12 px-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 mx-auto mb-4 flex items-center justify-center">
      <span className="text-lg font-bold text-emerald-600">OK</span>
    </div>
    <h3 className="font-bold mb-1">All clear!</h3>
    <p className="text-sm text-muted-foreground">No open faults found</p>
  </div>
);

const FaultAlertCard = ({
  fault,
  vehicle,
  onResolve,
}: {
  fault: VehicleFault;
  vehicle?: Vehicle;
  onResolve?: (fault: VehicleFault) => void;
}) => {
  const severityStyle = FAULT_SEVERITY_STYLES[fault.severity || ""] || "bg-gray-50 text-gray-700 border-gray-200";
  const statusStyle = FAULT_STATUS_STYLES[fault.status || ""] || "bg-gray-50 text-gray-700 border-gray-200";
  const borderColor = fault.status === "identified" ? "border-l-rose-500" : fault.status === "acknowledged" ? "border-l-amber-500" : "border-l-emerald-500";

  return (
    <Card
      className={cn("rounded-2xl shadow-sm border border-border/40 border-l-4 cursor-pointer active:scale-[0.98] transition-all", borderColor)}
      onClick={() => onResolve?.(fault)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {fault.fault_number && (
                <span className="text-xs font-mono text-muted-foreground">{fault.fault_number}</span>
              )}
              <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border", statusStyle)}>
                <span className="capitalize">{fault.status || "unknown"}</span>
              </div>
            </div>
            <p className="text-sm font-bold leading-snug">{fault.fault_description || "No description"}</p>
          </div>
          {fault.severity && (
            <div className={cn("inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border shrink-0", severityStyle)}>
              <span className="capitalize">{fault.severity}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {vehicle && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/60 font-medium truncate max-w-[140px]">
              {vehicle.fleet_number || vehicle.registration_number || "No vehicle"}
            </span>
          )}
          {fault.component && (
            <span className="truncate max-w-[120px]">{fault.component}</span>
          )}
          {fault.reported_by && (
            <span className="truncate max-w-[100px]">{fault.reported_by}</span>
          )}
          {fault.reported_date && (
            <span>
              {new Date(fault.reported_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
        <div className="mt-2 pt-2 border-t">
          <span className="text-xs font-medium text-primary">Tap to resolve</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================
const MobileInspectionsTab = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("recent");
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolvingFault, setResolvingFault] = useState<VehicleFault | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const handleResolveFault = useCallback((fault: VehicleFault) => {
    setResolvingFault(fault);
    setShowResolveDialog(true);
  }, []);

  // Fetch inspections with related fault data
  const {
    data: inspections = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["inspections-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select(`
          *,
          inspection_faults!left (
            id,
            severity,
            corrective_action_status
          )
        `)
        .or("inspection_type.is.null,inspection_type.neq.tyre")
        .order("inspection_date", { ascending: false })
        .limit(50);

      if (error) throw error;

      const typedData = (data || []) as unknown as InspectionWithFaults[];

      return typedData.map((item) => {
        const faults = item.inspection_faults || [];
        const resolvedStatuses = ['fixed', 'completed', 'no_need'];
        const hasOpenFaults = faults.some(
          (f) => !resolvedStatuses.includes(f.corrective_action_status || '')
        );

        return {
          id: item.id,
          inspection_number: item.inspection_number,
          inspection_date: item.inspection_date,
          inspection_type: item.inspection_type,
          inspector_name: item.inspector_name,
          location: item.location,
          has_fault: faults.length > 0,
          fault_resolved: !hasOpenFaults,
          vehicle_id: item.vehicle_id,
          status: item.status,
        };
      });
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Fetch vehicles for lookup
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300000,
  });

  // Create vehicle map for O(1) lookups
  const vehicleMap = useMemo(
    () => new Map(vehicles.map(v => [v.id, v])),
    [vehicles]
  );

  // Fetch fault count directly from inspection_faults for accuracy
  const { data: openFaultsCount = 0 } = useQuery({
    queryKey: ["open-faults-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("inspection_faults")
        .select("*", { count: "exact", head: true })
        .not("corrective_action_status", "in", '("fixed","completed","no_need")');

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Fetch vehicle faults (promoted fault alerts from dashboard)
  const { data: vehicleFaults = [] } = useQuery({
    queryKey: ["vehicle-faults-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_faults")
        .select("id, fault_number, fault_description, severity, status, component, reported_date, reported_by, vehicle_id, inspection_fault_id, inspection_id")
        .order("reported_date", { ascending: false });

      if (error) throw error;
      return (data || []) as VehicleFault[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Active (non-resolved) vehicle faults
  const activeVehicleFaults = useMemo(
    () => vehicleFaults.filter(f => f.status !== "resolved"),
    [vehicleFaults]
  );

  // Category sort helpers — Horses (H), Reefers (F), LMV (L), Trailers/Interlinks (T), Other
  const categoryOrder: Record<string, number> = useMemo(() => ({ H: 0, F: 1, L: 2, T: 3 }), []);
  const getFleetSuffix = useCallback((fn: string) => {
    const match = fn.match(/[A-Z]$/i);
    return match ? match[0].toUpperCase() : "";
  }, []);
  const sortByCategory = useCallback(
    (a: { vehicle?: Vehicle }, b: { vehicle?: Vehicle }) => {
      const fa = a.vehicle?.fleet_number || "";
      const fb = b.vehicle?.fleet_number || "";
      const catA = categoryOrder[getFleetSuffix(fa)] ?? 99;
      const catB = categoryOrder[getFleetSuffix(fb)] ?? 99;
      if (catA !== catB) return catA - catB;
      return fa.localeCompare(fb, undefined, { numeric: true });
    },
    [categoryOrder, getFleetSuffix]
  );

  // Group active faults by vehicle for the alerts tab
  const groupedFaults = useMemo(() => {
    const groups = new Map<string, { vehicle: Vehicle | undefined; faults: VehicleFault[] }>();
    for (const fault of activeVehicleFaults) {
      const key = fault.vehicle_id || "unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          vehicle: fault.vehicle_id ? vehicleMap.get(fault.vehicle_id) : undefined,
          faults: [],
        });
      }
      groups.get(key)!.faults.push(fault);
    }
    return Array.from(groups.values()).sort(sortByCategory);
  }, [activeVehicleFaults, vehicleMap, sortByCategory]);

  // Memoized filtered inspections
  const filteredInspections = useMemo(() => {
    if (!debouncedSearchTerm) return inspections;

    const term = debouncedSearchTerm.toLowerCase();
    return inspections.filter((insp) => {
      const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;

      return (
        insp.inspection_number?.toLowerCase().includes(term) ||
        insp.inspection_type?.toLowerCase().includes(term) ||
        insp.inspector_name?.toLowerCase().includes(term) ||
        vehicle?.fleet_number?.toLowerCase().includes(term) ||
        vehicle?.registration_number?.toLowerCase().includes(term)
      );
    });
  }, [inspections, debouncedSearchTerm, vehicleMap]);

  // Memoized tab data
  const recentInspections = useMemo(
    () => filteredInspections.slice(0, 20),
    [filteredInspections]
  );

  const faultInspections = useMemo(
    () => filteredInspections.filter(i => i.has_fault && !i.fault_resolved),
    [filteredInspections]
  );

  // Group inspections by vehicle helper
  const groupInspections = useCallback(
    (list: Inspection[]) => {
      const groups = new Map<string, { vehicle: Vehicle | undefined; inspections: Inspection[] }>();
      for (const insp of list) {
        const key = insp.vehicle_id || "unknown";
        if (!groups.has(key)) {
          groups.set(key, {
            vehicle: insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : undefined,
            inspections: [],
          });
        }
        groups.get(key)!.inspections.push(insp);
      }
      return Array.from(groups.values()).sort(sortByCategory);
    },
    [vehicleMap, sortByCategory]
  );

  const groupedRecent = useMemo(
    () => groupInspections(recentInspections),
    [groupInspections, recentInspections]
  );

  const groupedFaults2 = useMemo(
    () => groupInspections(faultInspections),
    [groupInspections, faultInspections]
  );

  // Handlers
  const handleClearSearch = useCallback(() => setSearchTerm(""), []);
  const handleNewInspection = useCallback(() => navigate("/inspections/mobile"), [navigate]);
  const handleInspectionClick = useCallback((id: string) => {
    navigate(`/inspections/${id}`);
  }, [navigate]);

  // Debug info (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && inspections.length > 0) {
      const withFaults = inspections.filter(i => i.has_fault);
      const openFaults = inspections.filter(i => i.has_fault && !i.fault_resolved);
      console.debug('Inspections state:', {
        total: inspections.length,
        withFaults: withFaults.length,
        openFaults: openFaults.length,
        openFaultsCount,
      });
    }
  }, [inspections, openFaultsCount]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full rounded-2xl">
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-destructive">!</span>
            </div>
            <h3 className="font-bold mb-2">Failed to load inspections</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Please try again later"}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4 pb-safe-bottom">
      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search by number, vehicle, inspector..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-11 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1 pl-4"
          aria-label="Search inspections"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 rounded-lg text-xs font-medium"
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger
            value="recent"
            className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            Recent
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 rounded-lg">
              {recentInspections.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="faults"
            className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            Open
            {faultInspections.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 rounded-lg">
                {faultInspections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="alerts"
            className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            Alerts
            {activeVehicleFaults.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 rounded-lg">
                {activeVehicleFaults.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-3 space-y-3">
          {isLoading ? (
            <div className="space-y-2" aria-label="Loading inspections">
              <InspectionCardSkeleton />
              <InspectionCardSkeleton />
              <InspectionCardSkeleton />
            </div>
          ) : recentInspections.length === 0 ? (
            <EmptyState
              hasSearch={!!debouncedSearchTerm}
              onNewInspection={handleNewInspection}
            />
          ) : (
            groupedRecent.map((group) => {
              const label = group.vehicle
                ? `${group.vehicle.fleet_number || ""} ${group.vehicle.registration_number ? `(${group.vehicle.registration_number})` : ""}`.trim()
                : "Unknown Vehicle";
              return (
                <Collapsible key={group.vehicle?.id || "unknown"}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold truncate">{label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px] px-1.5 rounded-lg">
                        {group.inspections.length}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {group.inspections.map((insp) => (
                      <InspectionCard
                        key={insp.id}
                        inspection={insp}
                        vehicle={group.vehicle}
                        onClick={handleInspectionClick}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="faults" className="mt-3 space-y-3">
          {faultInspections.length === 0 ? (
            <EmptyFaultsState />
          ) : (
            groupedFaults2.map((group) => {
              const label = group.vehicle
                ? `${group.vehicle.fleet_number || ""} ${group.vehicle.registration_number ? `(${group.vehicle.registration_number})` : ""}`.trim()
                : "Unknown Vehicle";
              return (
                <Collapsible key={group.vehicle?.id || "unknown"}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold truncate">{label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive" className="text-[10px] px-1.5 rounded-lg">
                        {group.inspections.length}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {group.inspections.map((insp) => (
                      <InspectionCard
                        key={insp.id}
                        inspection={insp}
                        vehicle={group.vehicle}
                        onClick={handleInspectionClick}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="alerts" className="mt-3 space-y-3">
          {groupedFaults.length === 0 ? (
            <EmptyFaultsState />
          ) : (
            groupedFaults.map((group) => {
              const label = group.vehicle
                ? `${group.vehicle.fleet_number || ""} ${group.vehicle.registration_number ? `(${group.vehicle.registration_number})` : ""}`.trim()
                : "Unknown Vehicle";
              // Collect unique inspection numbers from the faults in this group
              const inspNos = Array.from(new Set(
                group.faults.map(f => f.fault_number?.split("-")[0]).filter(Boolean)
              ));

              return (
                <Collapsible key={group.vehicle?.id || "unknown"}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold truncate">{label}</span>
                      {inspNos.length > 0 && (
                        <span className="text-[11px] font-mono text-muted-foreground truncate">
                          {inspNos.join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive" className="text-[10px] px-1.5 rounded-lg">
                        {group.faults.length}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {group.faults.map((fault) => (
                      <FaultAlertCard
                        key={fault.id}
                        fault={fault}
                        vehicle={group.vehicle}
                        onResolve={handleResolveFault}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Fault Dialog */}
      <ResolveFaultDialog
        open={showResolveDialog}
        onOpenChange={setShowResolveDialog}
        fault={resolvingFault}
      />

      {/* FAB - New Inspection */}
      <Button
        className="fixed bottom-24 right-4 h-14 px-5 rounded-2xl shadow-lg active:scale-95 transition-transform z-20 touch-target font-bold text-base gap-2"
        onClick={handleNewInspection}
        aria-label="New inspection"
      >
        <span className="text-lg">+</span> New
      </Button>
    </div>
  );
};

export default MobileInspectionsTab;