import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  MapPin,
  Search,
  User,
  XCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

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

interface QuickActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

interface DebugInfo {
  total: number;
  withFaults: number;
  openFaults: number;
}

const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return null;

  const variants: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const icons: Record<string, React.ElementType> = {
    completed: CheckCircle2,
    in_progress: Clock,
    scheduled: Calendar,
    cancelled: XCircle,
  };

  const Icon = icons[status as keyof typeof icons] || Clock;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
        variants[status as keyof typeof variants] || "bg-gray-50 text-gray-700 border-gray-200"
      )}
    >
      <Icon className="w-3 h-3" />
      <span className="capitalize">{status.replace("_", " ")}</span>
    </div>
  );
};

const QuickActionButton = ({ icon: Icon, label, onClick }: QuickActionButtonProps) => (
  <Button
    variant="outline"
    className="h-auto py-4 flex flex-col items-center gap-2 rounded-xl border-2 hover:bg-accent active:scale-[0.97] transition-all w-full"
    onClick={onClick}
  >
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <span className="text-xs font-medium">{label}</span>
  </Button>
);

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

const MobileInspectionsTab = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("recent");
  const [debug, setDebug] = useState<DebugInfo | null>(null);

  // Fetch inspections with related fault data
  const { data: inspections = [], isLoading } = useQuery<Inspection[]>({
    queryKey: ["inspections-mobile"],
    queryFn: async () => {
      console.log("Fetching inspections...");
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
        .order("inspection_date", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching inspections:", error);
        throw error;
      }

      // Type assertion for the data with faults
      const typedData = (data || []) as unknown as InspectionWithFaults[];

      // Process data to set has_fault based on actual faults
      const processedData: Inspection[] = typedData.map((item) => {
        const faults = item.inspection_faults || [];
        const hasOpenFaults = faults.some(
          (f: InspectionFault) => 
            f.corrective_action_status !== 'fixed' && 
            f.corrective_action_status !== 'completed'
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

      console.log("Processed inspections:", processedData);
      setDebug({
        total: processedData.length,
        withFaults: processedData.filter((i: Inspection) => i.has_fault).length,
        openFaults: processedData.filter((i: Inspection) => i.has_fault && !i.fault_resolved).length
      });
      
      return processedData;
    },
  });

  // Fetch vehicles for lookup
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["vehicles-lookup-inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number");
      if (error) throw error;
      return data || [];
    },
  });

  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

  // Fetch fault count directly from inspection_faults for accuracy
  const { data: faultCount = 0 } = useQuery({
    queryKey: ["fault-count-mobile"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("inspection_faults")
        .select("*", { count: "exact", head: true })
        .not("corrective_action_status", "in", '("fixed","completed")');

      if (error) {
        console.error("Error counting faults:", error);
        return 0;
      }
      return count || 0;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Debug effect
  useEffect(() => {
    if (inspections.length > 0) {
      const withFaults = inspections.filter(i => i.has_fault);
      const openFaults = inspections.filter(i => i.has_fault && !i.fault_resolved);
      console.log('Current state:', {
        total: inspections.length,
        withFaults: withFaults.length,
        openFaults: openFaults.length,
        faultCount,
        sample: inspections.find(i => i.has_fault)
      });
    }
  }, [inspections, faultCount]);

  // Filter inspections based on search
  const filteredInspections = inspections.filter((insp) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;

    return (
      insp.inspection_number?.toLowerCase().includes(term) ||
      insp.inspection_type?.toLowerCase().includes(term) ||
      insp.inspector_name?.toLowerCase().includes(term) ||
      vehicle?.fleet_number?.toLowerCase().includes(term) ||
      vehicle?.registration_number?.toLowerCase().includes(term)
    );
  });

  const recentInspections = filteredInspections.slice(0, 20);
  const faultInspections = filteredInspections.filter(
    (i) => i.has_fault && !i.fault_resolved
  );

  const InspectionCard = ({ inspection }: { inspection: Inspection }) => {
    const vehicle = inspection.vehicle_id ? vehicleMap.get(inspection.vehicle_id) : null;

    const getFaultStatusColor = () => {
      if (inspection.has_fault && !inspection.fault_resolved) return "border-l-rose-500";
      if (inspection.has_fault && inspection.fault_resolved) return "border-l-amber-500";
      return "border-l-emerald-500";
    };

    return (
      <Card
        className={cn(
          "active:scale-[0.98] transition-transform cursor-pointer border-0 shadow-sm border-l-4",
          getFaultStatusColor()
        )}
        onClick={() => navigate(`/inspections/${inspection.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">
                  {inspection.inspection_number}
                </span>
                {inspection.has_fault && !inspection.fault_resolved && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                    Open Fault
                  </Badge>
                )}
                {inspection.has_fault && inspection.fault_resolved && (
                  <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border-amber-200">
                    Resolved
                  </Badge>
                )}
              </div>
              <p className="text-sm font-semibold truncate">
                {inspection.inspection_type || "Vehicle Inspection"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <StatusBadge status={inspection.status} />
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {vehicle && (
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium">
                  {vehicle.fleet_number || vehicle.registration_number || "No vehicle"}
                </span>
              </span>
            )}
            {inspection.inspector_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {inspection.inspector_name}
              </span>
            )}
            {inspection.inspection_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(inspection.inspection_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {inspection.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate max-w-[120px]">{inspection.location}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && debug && (
        <div className="fixed top-16 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded-lg">
          <div>Total: {debug.total}</div>
          <div>With Faults: {debug.withFaults}</div>
          <div>Open Faults: {debug.openFaults}</div>
          <div>Fault Count: {faultCount}</div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Inspections
            </h1>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              <span className="font-mono">{inspections.length}</span> total
            </Badge>
          </div>
          {faultCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-destructive font-medium">{faultCount} open fault{faultCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Actions - Now only one button */}
        <div className="grid grid-cols-1 gap-3">
          <QuickActionButton
            icon={ClipboardCheck}
            label="New Inspection"
            onClick={() => navigate("/inspections/mobile")}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number, vehicle, inspector..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
              onClick={() => setSearchTerm("")}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-muted/50 p-1">
            <TabsTrigger 
              value="recent" 
              className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Recent
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                {recentInspections.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="faults" 
              className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Open Faults
              {faultInspections.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5">
                  {faultInspections.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="mt-3 space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                <InspectionCardSkeleton />
                <InspectionCardSkeleton />
                <InspectionCardSkeleton />
              </div>
            ) : recentInspections.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No inspections found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm ? "Try adjusting your search" : "Create your first inspection to get started"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => navigate("/inspections/mobile")} className="rounded-xl">
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    New Inspection
                  </Button>
                )}
              </div>
            ) : (
              recentInspections.map((insp) => <InspectionCard key={insp.id} inspection={insp} />)
            )}
          </TabsContent>

          <TabsContent value="faults" className="mt-3 space-y-2">
            {faultInspections.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="font-semibold mb-1">All clear!</h3>
                <p className="text-sm text-muted-foreground">No open faults found</p>
              </div>
            ) : (
              faultInspections.map((insp) => <InspectionCard key={insp.id} inspection={insp} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* FAB - New Inspection */}
      <Button
        className="fixed bottom-6 right-4 h-14 w-14 rounded-2xl shadow-lg active:scale-95 transition-transform z-20"
        onClick={() => navigate("/inspections/mobile")}
      >
        <ClipboardCheck className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default MobileInspectionsTab;