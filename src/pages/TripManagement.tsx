import Layout from "@/components/Layout";
import MissedLoadsTracker from "@/components/operations/MissedLoadsTracker";
import ActiveTrips from "@/components/trips/ActiveTrips";
import AddTripDialog from "@/components/trips/AddTripDialog";
import CompletedTrips from "@/components/trips/CompletedTrips";
import EditTripDialog from "@/components/trips/EditTripDialog";
import LoadImportModal from "@/components/trips/LoadImportModal";
import OperationalCostsTab from "@/components/trips/OperationalCostsTab";
import TripDetailsModal from "@/components/trips/TripDetailsModal";
import TripExpensesSection from "@/components/trips/TripExpensesSection";
import TripReportsSection from "@/components/trips/TripReportsSection";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOperations } from "@/contexts/OperationsContext";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { Trip } from "@/types/operations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Helper function to extract fleet number from vehicle name
const extractFleetNumberFromName = (name: string | null): string | null => {
  if (!name) return null;
  const nameParts = name.split(' - ');
  if (nameParts.length > 0) {
    const possibleFleetNumber = nameParts[0].trim();
    // Check if it looks like a fleet number (e.g., "21H", "31H", "14L")
    if (possibleFleetNumber.match(/^[\d]+[A-Z]+$|^[A-Z]+$/)) {
      return possibleFleetNumber;
    }
  }
  return name; // fallback to full name if pattern doesn't match
};

const TripManagement = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showTripDetails, setShowTripDetails] = useState(false);
  // Lifted dialog state from ActiveTrips to prevent portal unmount issues
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Track pending refetch to debounce real-time updates during dialog animations
  const pendingRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    missedLoads,
    addMissedLoad,
    updateMissedLoad,
    deleteMissedLoad,
    costEntries
  } = useOperations();

  // Auto-refresh trips using useQuery with refetchInterval
  const {
    data: allTrips = [],
    isLoading: loading,
    refetch: fetchTrips,
  } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      // First, fetch trips with vehicle relations
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(`
          *,
          wialon_vehicles:vehicle_id(id, fleet_number, name),
          vehicles:fleet_vehicle_id(id, fleet_number, registration_number)
        `)
        .order('created_at', { ascending: false });

      if (tripsError) {
        throw tripsError;
      }

      // Then fetch cost entries for all trips (including validation status fields)
      const tripIds = (tripsData || []).map(t => t.id);
      const costEntriesMap: Record<string, Array<{
        id: string;
        amount: number;
        currency?: string;
        category?: string;
        sub_category?: string;
        is_flagged?: boolean;
        investigation_status?: string;
        flag_reason?: string;
      }>> = {};

      if (tripIds.length > 0) {
        // Batch to avoid Supabase URL length limits with many trip IDs
        const BATCH_SIZE = 50;
        for (let i = 0; i < tripIds.length; i += BATCH_SIZE) {
          const batch = tripIds.slice(i, i + BATCH_SIZE);
          const { data: costData } = await supabase
            .from('cost_entries')
            .select('id, trip_id, amount, currency, category, sub_category, is_flagged, investigation_status, flag_reason')
            .in('trip_id', batch);

          // Group costs by trip_id
          (costData || []).forEach(cost => {
            if (cost.trip_id) {
              if (!costEntriesMap[cost.trip_id]) {
                costEntriesMap[cost.trip_id] = [];
              }
              costEntriesMap[cost.trip_id].push(cost);
            }
          });
        }
      }

      return (tripsData || []).map(trip => {
        // Extract fleet_number - prefer vehicles table (fleet_vehicle_id), fallback to wialon_vehicles
        // Note: fleet_vehicle_id join - cast needed until types are regenerated after migration
        const fleetVehicle = (trip as unknown as { vehicles?: { id: string; fleet_number: string | null; registration_number: string } | null }).vehicles;
        const wialonVehicle = trip.wialon_vehicles as { id: string; fleet_number: string | null; name: string } | null;

        // Determine the display fleet number - extract from name if needed
        let displayFleetNumber = null;
        if (fleetVehicle?.fleet_number) {
          displayFleetNumber = fleetVehicle.fleet_number;
        } else if (wialonVehicle?.fleet_number) {
          displayFleetNumber = wialonVehicle.fleet_number;
        } else if (wialonVehicle?.name) {
          // Extract just the first part before " - " (e.g., "31H" from "31H - AGZ 1963 (Int sim)")
          displayFleetNumber = extractFleetNumberFromName(wialonVehicle.name);
        }

        // Get cost entries for this trip
        const costEntries = costEntriesMap[trip.id] || [];

        // Compute warning/validation stats
        const flaggedCosts = costEntries.filter(ce => ce.is_flagged);
        const pendingCosts = costEntries.filter(ce =>
          ce.investigation_status === 'pending' || ce.investigation_status === 'in_progress'
        );
        const hasCosts = costEntries.length > 0;

        // Calculate days since trip started (for "in progress" indicator)
        const departureDate = trip.departure_date ? new Date(trip.departure_date) : null;
        const daysInProgress = departureDate ? Math.floor((Date.now() - departureDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        return {
          ...trip,
          fleet_number: displayFleetNumber,
          payment_status: trip.payment_status || 'unpaid',
          status: trip.status || 'active',
          revenue_currency: trip.revenue_currency || 'USD',
          // Warning/validation computed fields
          hasFlaggedCosts: flaggedCosts.length > 0,
          flaggedCostCount: flaggedCosts.length,
          hasPendingCosts: pendingCosts.length > 0,
          pendingCostCount: pendingCosts.length,
          hasNoCosts: !hasCosts,
          daysInProgress,
          // Map cost_entries to the costs array format expected by ActiveTrips
          costs: costEntries.map(ce => ({
            amount: ce.amount,
            currency: ce.currency,
            description: ce.sub_category || ce.category,
            is_flagged: ce.is_flagged,
            investigation_status: ce.investigation_status,
            flag_reason: ce.flag_reason
          }))
        };
      });
    },
    // Realtime subscription handles live updates — no polling needed
    // Keep previous data while refetching to prevent UI flicker
    placeholderData: (previousData) => previousData,
    // Don't show error toast on background refetch failures
    retry: 2,
    staleTime: 15000, // Consider data fresh for 15 seconds (prevents duplicate refetches from real-time + manual invalidation)
  });

  // Memoize filtered trips to prevent unnecessary re-renders
  const activeTrips = useMemo(() =>
    allTrips.filter(trip => trip.status === 'active') as unknown as Trip[],
    [allTrips]
  );

  const completedTrips = useMemo(() =>
    allTrips.filter(trip => trip.status === 'completed') as unknown as Trip[],
    [allTrips]
  );

  // Debounced refetch function that coalesces rapid updates
  const debouncedRefetch = useCallback(() => {
    // Clear any pending refetch to coalesce rapid-fire events
    if (pendingRefetchRef.current) {
      clearTimeout(pendingRefetchRef.current);
    }
    // Always debounce real-time events by 1.5s to avoid redundant refetches
    // after manual invalidateQueries (edit/save already invalidates immediately)
    pendingRefetchRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    }, 1500);
  }, [queryClient]);

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('trips-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
        },
        () => {
          // Use debounced refetch to prevent DOM conflicts
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      if (pendingRefetchRef.current) {
        clearTimeout(pendingRefetchRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [debouncedRefetch]);

  const handleEdit = useCallback((trip: Trip) => {
    setEditingTrip(trip);
    setShowEditDialog(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Trip deleted successfully',
      });
      requestGoogleSheetsSync('trips');
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['recent-delivery-performance'] });
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete trip',
        variant: 'destructive',
      });
    }
  }, [toast, queryClient]);

  const handleView = useCallback((trip: Trip) => {
    setSelectedTrip(trip);
    setShowTripDetails(true);
  }, []);

  const handleAddTrip = useCallback(() => setIsAddDialogOpen(true), []);
  const handleImport = useCallback(() => setIsImportModalOpen(true), []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading trips...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-1.5 shadow-sm">
            <TabsList className="inline-flex w-full bg-transparent gap-2 h-auto p-1 flex-wrap">
              <TabsTrigger value="active" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Active
                {activeTrips.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold rounded-full">{activeTrips.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="completed" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Completed
                {completedTrips.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold rounded-full">{completedTrips.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Expenses
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Reports
              </TabsTrigger>
              <TabsTrigger value="missed-loads" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Missed Loads
              </TabsTrigger>
              <TabsTrigger value="operational-costs" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Operational Costs
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Lazy tab rendering: only mount child when its tab is active */}
          <TabsContent value="active">
            {activeTab === "active" && (
              <ActiveTrips
                trips={activeTrips}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleView}
                onAddTrip={handleAddTrip}
                onImport={handleImport}
              />
            )}
          </TabsContent>

          <TabsContent value="completed">
            {activeTab === "completed" && (
              <CompletedTrips
                trips={completedTrips}
                onView={handleView}
                onRefresh={fetchTrips}
              />
            )}
          </TabsContent>

          <TabsContent value="expenses">
            {activeTab === "expenses" && (
              <TripExpensesSection
                trips={[...activeTrips, ...completedTrips]}
                onViewTrip={handleView}
              />
            )}
          </TabsContent>

          <TabsContent value="reports">
            {activeTab === "reports" && (
              <TripReportsSection
                trips={[...activeTrips, ...completedTrips]}
                costEntries={costEntries}
              />
            )}
          </TabsContent>

          <TabsContent value="missed-loads">
            {activeTab === "missed-loads" && (
              <MissedLoadsTracker
                missedLoads={missedLoads}
                onAddMissedLoad={addMissedLoad}
                onUpdateMissedLoad={updateMissedLoad}
                onDeleteMissedLoad={deleteMissedLoad}
              />
            )}
          </TabsContent>

          <TabsContent value="operational-costs">
            {activeTab === "operational-costs" && (
              <OperationalCostsTab />
            )}
          </TabsContent>
        </Tabs>

        <TripDetailsModal
          trip={selectedTrip}
          isOpen={showTripDetails}
          onClose={() => {
            setShowTripDetails(false);
            setSelectedTrip(null);
          }}
          onRefresh={fetchTrips}
        />

        <EditTripDialog
          trip={editingTrip}
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingTrip(null);
          }}
          onRefresh={fetchTrips}
        />

        {/* Lifted dialogs from ActiveTrips to prevent portal unmount issues */}
        <AddTripDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
        />

        <LoadImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />
      </div>
    </Layout>
  );
};

export default TripManagement;