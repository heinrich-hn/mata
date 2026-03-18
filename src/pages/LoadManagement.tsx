
import Layout from "@/components/Layout";
import { BulkLoadImport } from "@/components/loads/BulkLoadImport";
import { LoadPlanningCalendar } from "@/components/loads/calendar";
import CreateLoadDialog from "@/components/loads/CreateLoadDialog";
import { CustomerRetentionDashboard } from "@/components/loads/CustomerRetentionDashboard";
import EditLoadDialog from "@/components/loads/EditLoadDialog";
import { LiveDeliveryTracking } from "@/components/loads/LiveDeliveryTracking";
import LoadAssignmentDialog from "@/components/loads/LoadAssignmentDialog";
import { RealTimeKPIMonitor } from '@/components/loads/RealTimeKPIMonitor';
import { RecurringScheduleManager } from "@/components/loads/RecurringScheduleManager";
import RoutePlanner from "@/components/loads/RoutePlanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLoads, useLoadStats } from "@/hooks/useLoads";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Calendar, Clock, DollarSign, FileUp, Navigation, Package, Plus, Route, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LoadsTable } from "@/components/loads/LoadsTable"; // Ensure you save the artifact below as LoadsTable.tsx

// Types
export type Load = Database["public"]["Tables"]["loads"]["Row"] & {
  assigned_vehicle?: {
    id: string;
    wialon_unit_id: number;
    name: string;
    registration: string | null;
  };
};

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

const LoadManagement = () => {
  // UI State
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showRecurringSchedules, setShowRecurringSchedules] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("loads");

  // Selection State
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [trackingLoadId, setTrackingLoadId] = useState<string | null>(null);
  const [planningLoadId, setPlanningLoadId] = useState<string | null>(null);
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Data State
  const [loads, setLoads] = useState<Load[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const { toast } = useToast();

  // Hooks
  // We only pass filterStatus if it's strictly needed for the query,
  // but here we are doing client-side filtering often for realtime updates.
  // If you want server-side filtering only, keep the dependency.
  const { loads: initialLoads, isLoading, error, refetch } = useLoads(
    filterStatus ? { status: filterStatus } : undefined
  );
  const { data: stats } = useLoadStats();

  // Sync initial data
  useEffect(() => {
    if (initialLoads) {
      setLoads(initialLoads);
    }
  }, [initialLoads]);

  // Fetch invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select("*")
          .order("invoice_date", { ascending: false });

        if (error) throw error;
        if (data) setInvoices(data);
      } catch (err) {
        console.error("Error fetching invoices:", err);
      }
    };
    fetchInvoices();
  }, []);

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: "Error Loading Loads",
        description: error.message || "Failed to load shipments. Please check your database setup.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Realtime Subscription
  useEffect(() => {
    console.log("🔌 Setting up Supabase realtime subscription for loads...");

    const channel = supabase
      .channel("loads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads" },
        async (payload) => {
          // Handle vehicle data fetching for new assignments
          let assignedVehicle = null;

          if ((payload.eventType === "UPDATE" || payload.eventType === "INSERT") && payload.new.assigned_vehicle_id) {
            try {
              const { data: vehicle } = await supabase
                .from("wialon_vehicles")
                .select("id, wialon_unit_id, name, registration")
                .eq("id", payload.new.assigned_vehicle_id)
                .single();

              if (vehicle) assignedVehicle = vehicle;
            } catch (e) {
              console.warn("⚠️ Could not fetch vehicle data", e);
            }
          }

          setLoads((prevLoads) => {
            if (payload.eventType === "INSERT") {
              const newLoad = payload.new as Load;
              if (assignedVehicle) newLoad.assigned_vehicle = assignedVehicle;
              return [...prevLoads, newLoad];
            }

            if (payload.eventType === "UPDATE") {
              return prevLoads.map((load) => {
                if (load.id === payload.new.id) {
                  const updatedLoad = payload.new as Load;
                  // Preserve existing vehicle if not changed, or update if we fetched new one
                  updatedLoad.assigned_vehicle = assignedVehicle || (load.assigned_vehicle_id === updatedLoad.assigned_vehicle_id ? load.assigned_vehicle : undefined);
                  return updatedLoad;
                }
                return load;
              });
            }

            if (payload.eventType === "DELETE") {
              return prevLoads.filter((load) => load.id !== payload.old.id);
            }

            return prevLoads;
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to loads realtime updates");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Memoize filtered loads to prevent unnecessary calculations on every render
  const filteredLoads = useMemo(() => {
    return filterStatus
      ? loads.filter((load) => load.status === filterStatus)
      : loads;
  }, [loads, filterStatus]);

  // Handlers
  const handleBulkImportSuccess = () => {
    refetch();
    toast({
      title: "Import successful",
      description: "Loads have been created and are ready for assignment",
    });
  };

  const handleScheduleGenerated = () => {
    refetch();
    toast({
      title: "Loads generated",
      description: "Loads have been created from schedules",
    });
  };

  const handleAssignmentClose = (open: boolean) => {
    if (!open) {
      const previousStatus = selectedLoad?.status;
      setSelectedLoad(null);
      refetch();

      // UX Improvement: Notify and switch tabs if status changed while filtering
      if (selectedLoad && filterStatus && previousStatus !== "assigned") {
        setTimeout(() => {
          toast({
            title: "Load Status Changed",
            description: `The load is now 'assigned'. Switching to 'All Loads' view.`,
            duration: 4000,
          });
          setFilterStatus("");
        }, 500);
      }
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-gray-500">Loading loads...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center max-w-md">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-2">Failed to Load Data</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const STATUS_TABS = [
    { value: "", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "assigned", label: "Assigned" },
    { value: "arrived_at_loading", label: "At Loading" },
    { value: "loading", label: "Loading" },
    { value: "loading_completed", label: "Loaded" },
    { value: "in_transit", label: "In Transit" },
    { value: "arrived_at_delivery", label: "At Delivery" },
    { value: "offloading", label: "Offloading" },
    { value: "offloading_completed", label: "Offloaded" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowRecurringSchedules(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedules
            </Button>
            <Button variant="outline" onClick={() => setShowBulkImport(true)}>
              <FileUp className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Load
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Total Loads"
            value={stats?.total || 0}
            icon={Package}
          />
          <StatsCard
            label="Pending"
            value={stats?.pending || 0}
            icon={Clock}
          />
          <StatsCard
            label="In Transit"
            value={stats?.in_transit || 0}
            icon={TrendingUp}
          />
          <StatsCard
            label="Value (ZAR)"
            value={`R${((stats?.total_value_zar || 0) / 1000).toFixed(0)}k`}
            icon={DollarSign}
          />
        </div>

        {/* Main Feature Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full lg:w-auto">
            <TabsTrigger value="loads" className="gap-2"><Package className="h-4 w-4" /> Loads</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2"><Calendar className="h-4 w-4" /> Calendar</TabsTrigger>
            <TabsTrigger value="routes" className="gap-2"><Route className="h-4 w-4" /> Routes</TabsTrigger>
            <TabsTrigger value="tracking" className="gap-2"><Navigation className="h-4 w-4" /> Tracking</TabsTrigger>
            <TabsTrigger value="retention" className="gap-2"><Users className="h-4 w-4" /> Customer Retention</TabsTrigger>
          </TabsList>

          <TabsContent value="loads" className="space-y-6">
            <Tabs value={filterStatus} onValueChange={setFilterStatus}>
              <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 justify-start mb-4">
                {STATUS_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent data-[state=active]:border-transparent hover:bg-muted"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Single Table Instance for all filter states */}
              <div className="mt-6">
                <LoadsTable
                  loads={filteredLoads}
                  onAssign={setSelectedLoad}
                  onTrackLive={setTrackingLoadId}
                  onPlanRoute={setPlanningLoadId}
                  onEdit={setEditingLoad}
                />
              </div>
            </Tabs>
          </TabsContent>

          <TabsContent value="calendar"><LoadPlanningCalendar /></TabsContent>

          <TabsContent value="routes">
            <Card><CardContent className="p-6"><RoutePlanner /></CardContent></Card>
          </TabsContent>

          <TabsContent value="tracking">
            <Card>
              <CardContent className="p-6 text-center py-12">
                <Navigation className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Live Tracking</h3>
                <p className="text-muted-foreground mb-4">Select a load from the Loads tab to track its live GPS position</p>
                <Button onClick={() => setActiveTab("loads")}>Go to Loads</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention">
            <CustomerRetentionDashboard loads={loads} invoices={invoices} />
          </TabsContent>
        </Tabs>

        <RealTimeKPIMonitor />
      </div>

      {/* Dialogs */}
      <CreateLoadDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      <BulkLoadImport
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={handleBulkImportSuccess}
      />

      <RecurringScheduleManager
        isOpen={showRecurringSchedules}
        onClose={() => setShowRecurringSchedules(false)}
        onLoadsGenerated={handleScheduleGenerated}
      />

      {selectedLoad && (
        <LoadAssignmentDialog
          open={!!selectedLoad}
          onOpenChange={handleAssignmentClose}
          load={selectedLoad}
        />
      )}

      {editingLoad && (
        <EditLoadDialog
          open={!!editingLoad}
          onOpenChange={(open) => {
            if (!open) {
              setEditingLoad(null);
              refetch();
            }
          }}
        />
      )}

      {trackingLoadId && (
        <Dialog open={!!trackingLoadId} onOpenChange={(open) => !open && setTrackingLoadId(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Live Delivery Tracking</DialogTitle>
              <DialogDescription>Real-time GPS tracking and delivery progress monitoring</DialogDescription>
            </DialogHeader>
            <LiveDeliveryTracking loadId={trackingLoadId} />
          </DialogContent>
        </Dialog>
      )}

      {planningLoadId && (
        <Dialog open={!!planningLoadId} onOpenChange={(open) => !open && setPlanningLoadId(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Route Planner</DialogTitle>
              <DialogDescription>Plan and optimize route for the load</DialogDescription>
            </DialogHeader>
            <RoutePlanner />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
};

// Helper Component for Stats
interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}

const StatsCard = ({ label, value, icon: Icon }: StatsCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{label}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold">{value}</div>
    </CardContent>
  </Card>
);

export default LoadManagement;