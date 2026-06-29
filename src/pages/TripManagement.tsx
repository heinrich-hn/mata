import Layout from "@/components/Layout";
import MissedLoadsTracker from "@/components/operations/MissedLoadsTracker";
import ActiveTrips from "@/components/trips/ActiveTrips";
import AddTripDialog from "@/components/trips/AddTripDialog";
import CompletedTrips from "@/components/trips/CompletedTrips";
import EditTripDialog from "@/components/trips/EditTripDialog";
import LoadImportModal from "@/components/trips/LoadImportModal";
import OperationalCostsTab from "@/components/trips/OperationalCostsTab";
import TripDetailsModal from "@/components/trips/TripDetailsModal";
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

// Raw `trips` row shape (selected columns plus vehicle joins) used by enrichTrip.
type RawTripRow = Record<string, unknown> & {
  id: string;
  departure_date?: string | null;
  payment_status?: string | null;
  status?: string | null;
  revenue_currency?: string | null;
  wialon_vehicles?: { id: string; fleet_number: string | null; name: string } | null;
  vehicles?: { id: string; fleet_number: string | null; registration_number: string } | null;
};

interface TripCostEntryRow {
  id: string;
  trip_id?: string | null;
  amount: number;
  currency?: string;
  category?: string;
  sub_category?: string;
  is_flagged?: boolean;
  investigation_status?: string;
  flag_reason?: string;
}

const TRIP_SELECT_WITH_VEHICLES = `
  *,
  wialon_vehicles:vehicle_id(id, fleet_number, name),
  vehicles:fleet_vehicle_id(id, fleet_number, registration_number)
`;

// Fetch cost entries for a set of trip IDs, grouped by trip_id.
// Batches the `.in()` filter to stay under Supabase URL length limits.
const fetchCostEntriesMap = async (tripIds: string[]): Promise<Record<string, TripCostEntryRow[]>> => {
  const costEntriesMap: Record<string, TripCostEntryRow[]> = {};
  if (tripIds.length === 0) return costEntriesMap;

  const BATCH_SIZE = 50;
  const batches: string[][] = [];
  for (let i = 0; i < tripIds.length; i += BATCH_SIZE) {
    batches.push(tripIds.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map(batch =>
      supabase
        .from('cost_entries')
        .select('id, trip_id, amount, currency, category, sub_category, is_flagged, investigation_status, flag_reason')
        .in('trip_id', batch)
    )
  );

  batchResults.forEach(({ data: costData }) => {
    (costData || []).forEach(cost => {
      if (cost.trip_id) {
        if (!costEntriesMap[cost.trip_id]) costEntriesMap[cost.trip_id] = [];
        costEntriesMap[cost.trip_id].push(cost);
      }
    });
  });

  return costEntriesMap;
};

// Transform a raw trips row (+ its cost entries) into the enriched shape the UI consumes.
const enrichTrip = (trip: RawTripRow, costEntries: TripCostEntryRow[]) => {
  // Extract fleet_number - prefer vehicles table (fleet_vehicle_id), fallback to wialon_vehicles
  const fleetVehicle = trip.vehicles;
  const wialonVehicle = trip.wialon_vehicles;

  let displayFleetNumber: string | null = null;
  if (fleetVehicle?.fleet_number) {
    displayFleetNumber = fleetVehicle.fleet_number;
  } else if (wialonVehicle?.fleet_number) {
    displayFleetNumber = wialonVehicle.fleet_number;
  } else if (wialonVehicle?.name) {
    // Extract just the first part before " - " (e.g., "31H" from "31H - AGZ 1963 (Int sim)")
    displayFleetNumber = extractFleetNumberFromName(wialonVehicle.name);
  }

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
};

type EnrichedTrip = ReturnType<typeof enrichTrip>;

// Fetch fully-enriched trips for a specific set of IDs (used by targeted realtime updates).
const fetchEnrichedTripsByIds = async (ids: string[]): Promise<EnrichedTrip[]> => {
  if (ids.length === 0) return [];

  const BATCH_SIZE = 50;
  const rows: RawTripRow[] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('trips')
      .select(TRIP_SELECT_WITH_VEHICLES)
      .in('id', batch);
    if (error) throw error;
    rows.push(...((data || []) as unknown as RawTripRow[]));
  }

  const costMap = await fetchCostEntriesMap(rows.map(r => r.id));
  return rows.map(r => enrichTrip(r, costMap[r.id] || []));
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
  // Buffers for coalescing realtime trip changes into a single targeted cache update.
  const pendingChangedIdsRef = useRef<Set<string>>(new Set());
  const pendingDeletedIdsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      // Fetch trips with vehicle relations.
      // Paginate so we are not silently capped at Supabase's 1000-row limit —
      // otherwise completed trips beyond the cap would intermittently disappear
      // from the list as new trips shift the result window.
      const PAGE_SIZE = 1000;
      const tripsData: RawTripRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('trips')
          .select(TRIP_SELECT_WITH_VEHICLES)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        tripsData.push(...(page as unknown as RawTripRow[]));
        if (page.length < PAGE_SIZE) break;
      }

      // Then fetch cost entries for all trips (including validation status fields)
      const costEntriesMap = await fetchCostEntriesMap(tripsData.map(t => t.id));

      return tripsData.map(trip => enrichTrip(trip, costEntriesMap[trip.id] || []));
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

  // Coalesce buffered realtime changes into one targeted cache update instead of
  // re-downloading the entire trips dataset on every change.
  const flushRealtimeChanges = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    // Debounce briefly so rapid-fire events (and our own post-save invalidations)
    // collapse into a single update.
    flushTimerRef.current = setTimeout(async () => {
      const changedIds = Array.from(pendingChangedIdsRef.current);
      const deletedIds = Array.from(pendingDeletedIdsRef.current);
      pendingChangedIdsRef.current = new Set();
      pendingDeletedIdsRef.current = new Set();

      // Deletes are exact — remove them from the cache without any fetch.
      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        queryClient.setQueryData<EnrichedTrip[]>(['trips'], (old) =>
          old ? old.filter(t => !deletedSet.has(t.id)) : old
        );
      }

      if (changedIds.length === 0) return;

      // Guard against pathological bursts (e.g. bulk import of hundreds of rows):
      // fall back to a single full refetch rather than many targeted fetches.
      if (changedIds.length > 200) {
        queryClient.invalidateQueries({ queryKey: ['trips'] });
        return;
      }

      try {
        const enriched = await fetchEnrichedTripsByIds(changedIds);
        const enrichedById = new Map(enriched.map(t => [t.id, t]));
        // Any requested id missing from the result no longer exists (or is RLS-hidden).
        const missing = new Set(changedIds.filter(id => !enrichedById.has(id)));

        queryClient.setQueryData<EnrichedTrip[]>(['trips'], (old) => {
          if (!old) return old;
          const existingIds = new Set(old.map(t => t.id));
          // Replace updated rows in place; drop rows that no longer exist.
          const next = old
            .filter(t => !missing.has(t.id))
            .map(t => enrichedById.get(t.id) ?? t);
          // Prepend brand-new rows (newest first, matching created_at desc ordering).
          const inserts = enriched.filter(t => !existingIds.has(t.id));
          return inserts.length > 0 ? [...inserts, ...next] : next;
        });
      } catch {
        // On any failure, stay correct by doing a full refetch.
        queryClient.invalidateQueries({ queryKey: ['trips'] });
      }
    }, 400);
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
        (payload) => {
          const newId = (payload.new as { id?: string } | null)?.id;
          const oldId = (payload.old as { id?: string } | null)?.id;
          if (payload.eventType === 'DELETE') {
            if (oldId) pendingDeletedIdsRef.current.add(oldId);
          } else if (newId) {
            // INSERT or UPDATE — re-fetch just this row (with joins + costs).
            pendingChangedIdsRef.current.add(newId);
            pendingDeletedIdsRef.current.delete(newId);
          }
          flushRealtimeChanges();
        }
      )
      .subscribe();

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [flushRealtimeChanges]);

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

  return (
    <Layout>
      <div className="space-y-5">
        {loading && (
          <div className="text-xs text-muted-foreground px-1">Loading trips…</div>
        )}
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
              <TabsTrigger value="reports" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Reports
              </TabsTrigger>
              <TabsTrigger value="missed-loads" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Missed Loads
              </TabsTrigger>
              <TabsTrigger value="operational-costs" className="rounded-lg px-5 py-2.5 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200">
                Operations
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