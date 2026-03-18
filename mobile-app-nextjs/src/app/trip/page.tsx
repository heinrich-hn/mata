"use client";

import { MobileShell } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { Input } from "@/components/ui/input";
import { BottomSheetSelect } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Calendar, CalendarRange, Clock, MapPin } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";


interface Vehicle {
  id: string;
  fleet_number: string;
  registration_number: string;
  make?: string;
  model?: string;
}

// Trip entry from main dashboard (trips table)
export interface TripEntry {
  id: string;
  trip_number: string | null;
  vehicle_id: string | null;
  fleet_vehicle_id: string | null;
  origin: string | null;
  destination: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  driver_name: string | null;
  client_name: string | null;
  distance_km: number | null;
  starting_km: number | null;
  ending_km: number | null;
  base_revenue: number | null;
  invoice_amount: number | null;
  status: string | null;
  created_at: string | null;
}

// Type for driver_vehicle_assignments join result
interface DriverVehicleAssignment {
  id: string;
  vehicle_id: string;
  vehicles: Vehicle | Vehicle[] | null;
}

// Freight details interface
interface FreightDetail {
  id: string;
  trip_id: string;
}

// Tracker record interface
interface TrackerRecord {
  trip_id: string;
  current_phase: number;
  is_completed: boolean;
}

// Import the TripDetailSheet component
import { TripDetailSheet } from "@/components/trip-detail-sheet";

// StatCard component
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

// LoadingSpinner component
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

// EmptyState component
function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        <p className="font-medium">{title}</p>
        <p className="text-sm mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// Helper to get month options (current + past 11 months) — computed once at module level
const MONTH_OPTIONS = (() => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      month: date.getMonth(),
      year: date.getFullYear(),
    });
  }
  return options;
})();

export default function TripsPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  // Date filter state
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value);
  const [filterMode, setFilterMode] = useState<"month" | "custom">("month");
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const thirtyDaysAgo = useMemo(() => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0], []);
  const [customFrom, setCustomFrom] = useState(thirtyDaysAgo);
  const [customTo, setCustomTo] = useState(today);

  // State for trip detail sheet
  const [selectedTrip, setSelectedTrip] = useState<TripEntry | null>(null);

  // Compute effective date range based on filter mode — memoized
  const { dateFrom, dateTo, dateRangeLabel } = useMemo(() => {
    const selectedMonthData = MONTH_OPTIONS.find(m => m.value === selectedMonth) || MONTH_OPTIONS[0];
    if (filterMode === "month") {
      return {
        dateFrom: new Date(selectedMonthData.year, selectedMonthData.month, 1).toISOString().split("T")[0],
        dateTo: new Date(selectedMonthData.year, selectedMonthData.month + 1, 0).toISOString().split("T")[0],
        dateRangeLabel: new Date(selectedMonthData.year, selectedMonthData.month).toLocaleString("default", { month: "long" }),
      };
    }
    return { dateFrom: customFrom, dateTo: customTo, dateRangeLabel: `${customFrom} → ${customTo}` };
  }, [selectedMonth, filterMode, customFrom, customTo]);

  // Refresh Handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["assigned-vehicle"] }),
      queryClient.invalidateQueries({ queryKey: ["monthly-trips"] }),
      queryClient.invalidateQueries({ queryKey: ["freight-details"] }),
      queryClient.invalidateQueries({ queryKey: ["cycle-tracker-exists"] }),
    ]);
  }, [queryClient]);

  // Fetch assigned vehicle from driver_vehicle_assignments
  const { data: assignedVehicle, isLoading: isLoadingVehicle } = useQuery({
    queryKey: ["assigned-vehicle", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("driver_vehicle_assignments")
        .select(`
          id,
          vehicle_id,
          vehicles (
            id,
            fleet_number,
            registration_number,
            make,
            model
          )
        `)
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      const assignment = data as DriverVehicleAssignment | null;
      if (assignment?.vehicles) {
        const vehicleData = Array.isArray(assignment.vehicles) ? assignment.vehicles[0] : assignment.vehicles;
        return vehicleData as Vehicle;
      }
      return null;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 min
  });



  // Fetch trips for current month
  const { data: monthlyTrips = [], isLoading: isLoadingTrips } = useQuery<TripEntry[]>({
    queryKey: ["monthly-trips", assignedVehicle?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!assignedVehicle?.id) return [];

      const { data, error } = await supabase
        .from("trips")
        .select(`
          id,
          trip_number,
          vehicle_id,
          fleet_vehicle_id,
          origin,
          destination,
          departure_date,
          arrival_date,
          driver_name,
          client_name,
          distance_km,
          starting_km,
          ending_km,
          base_revenue,
          invoice_amount,
          status,
          created_at
        `)
        .eq("fleet_vehicle_id", assignedVehicle.id)
        .gte("departure_date", dateFrom)
        .lte("departure_date", dateTo)
        .order("departure_date", { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []) as TripEntry[];
    },
    enabled: !!assignedVehicle?.id,
    staleTime: 2 * 60 * 1000, // 2 min — prevents refetch on every tab switch
  });



  // Fetch existing freight details for all trips
  const { data: freightDetails = [], isLoading: isLoadingFreight } = useQuery<FreightDetail[]>({
    queryKey: ["freight-details", assignedVehicle?.id, user?.id],
    queryFn: async () => {
      if (!assignedVehicle?.id || !user?.id) return [];

      const { data, error } = await supabase
        .from("freight_details")
        .select(`id, trip_id`)
        .eq("vehicle_id", assignedVehicle.id)
        .eq("driver_id", user.id);

      if (error) throw error;
      return (data || []) as FreightDetail[];
    },
    enabled: !!assignedVehicle?.id && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });



  // Fetch cycle tracker existence for all trips
  const tripIds = monthlyTrips.map(t => t.id);
  const { data: trackerRecords = [] } = useQuery<TrackerRecord[]>({
    queryKey: ["cycle-tracker-exists", tripIds],
    queryFn: async () => {
      if (tripIds.length === 0) return [];
      const { data, error } = await supabase
        .from("trip_cycle_tracker")
        .select("trip_id, current_phase, is_completed")
        .in("trip_id", tripIds);

      if (error) throw error;
      return (data || []) as TrackerRecord[];
    },
    enabled: tripIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });



  // Create tracker map for quick lookup — memoized
  const trackerMap = useMemo(() =>
    trackerRecords.reduce((acc: Record<string, TrackerRecord>, t) => {
      acc[t.trip_id] = t;
      return acc;
    }, {}),
    [trackerRecords]
  );

  // Create a map for quick lookup of freight by trip_id — memoized
  const freightMap = useMemo(() =>
    freightDetails.reduce((acc: Record<string, FreightDetail>, freight) => {
      acc[freight.trip_id] = freight;
      return acc;
    }, {}),
    [freightDetails]
  );

  // Memoized stats
  const { totalTrips, totalDistanceKm, completedTrips } = useMemo(() => ({
    totalTrips: monthlyTrips.length,
    totalDistanceKm: monthlyTrips.reduce((sum, e) => sum + (e.distance_km || 0), 0),
    completedTrips: monthlyTrips.filter(t => t.status === 'completed').length,
  }), [monthlyTrips]);

  // Handler to open trip detail — memoized
  const handleOpenTripDetail = useCallback((trip: TripEntry) => {
    setSelectedTrip(trip);
  }, []);

  const isLoading = isLoadingVehicle || isLoadingTrips || isLoadingFreight;

  // No vehicle assigned state
  if (!isLoading && !assignedVehicle) {
    return (
      <MobileShell>
        <div className="p-5 space-y-6 min-h-screen flex flex-col items-center justify-center text-center">
          <EmptyState
            title="No Vehicle Assigned"
            description="Please contact your administrator to get a vehicle assigned."
          />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-5 space-y-6 min-h-screen">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Trips</h1>
              <button
                onClick={() => setFilterMode(filterMode === "month" ? "custom" : "month")}
                className="flex items-center gap-1.5 text-xs text-primary font-medium px-2.5 py-1.5 rounded-md bg-primary/10 active:bg-primary/20 transition-colors"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                {filterMode === "month" ? "Custom Range" : "By Month"}
              </button>
            </div>

            {filterMode === "month" ? (
              <BottomSheetSelect
                value={selectedMonth}
                onValueChange={setSelectedMonth}
                options={MONTH_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                placeholder="Select month"
                label="Select Month"
                className="h-8 text-xs text-muted-foreground"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">From</label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    max={customTo}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">To</label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    min={customFrom}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Trips" value={totalTrips} />
            <StatCard label="KM Traveled" value={`${formatNumber(totalDistanceKm)} km`} />
            <StatCard label="Completed" value={completedTrips} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">{filterMode === "month" ? `${dateRangeLabel} Trips` : "Trips"}</p>
              <p className="text-xs text-muted-foreground">
                {completedTrips} of {totalTrips} completed
              </p>
            </div>
            {isLoading ? (
              <LoadingSpinner />
            ) : monthlyTrips.length === 0 ? (
              <EmptyState
                title="No Trips Found"
                description={filterMode === "month" ? `No trips available for ${dateRangeLabel}. Try selecting another month.` : `No trips found for ${customFrom} to ${customTo}. Try adjusting the date range.`}
              />
            ) : (
              monthlyTrips.map((entry) => (
                <TripCard
                  key={entry.id}
                  entry={entry}
                  tracker={trackerMap[entry.id]}
                  hasFreight={!!freightMap[entry.id]}
                  onOpenDetail={() => handleOpenTripDetail(entry)}
                />
              ))
            )}
          </div>
        </div>
      </PullToRefresh>

      {/* Trip Detail Sheet - Fixed to use 'trip' prop instead of 'tripId' */}
      {selectedTrip && (
        <TripDetailSheet
          trip={selectedTrip}
          open={!!selectedTrip}
          onOpenChange={(open: boolean) => !open && setSelectedTrip(null)}
        />
      )}
    </MobileShell>
  );
}

// Trip Card component — memoized to avoid re-render on parent state change
const TripCard = memo(function TripCard({
  entry,
  tracker,
  hasFreight,
  onOpenDetail
}: {
  entry: TripEntry;
  tracker?: TrackerRecord;
  hasFreight: boolean;
  onOpenDetail: () => void;
}) {
  const statusColor = entry.status === "completed"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : entry.status === "in_progress" || entry.status === "active"
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
      : "bg-muted text-muted-foreground";

  return (
    <Card
      className="hover:bg-muted/30 transition-colors cursor-pointer active:scale-[0.99]"
      onClick={onOpenDetail}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium text-sm truncate">{entry.client_name || entry.trip_number || "Trip"}</p>
            {tracker && (
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${tracker.is_completed
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                }`}>
                <Clock className="w-2.5 h-2.5" />
                {tracker.is_completed ? "360°" : `P${tracker.current_phase}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {entry.departure_date ? formatDate(entry.departure_date) : "No date"}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{entry.origin || "N/A"}</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="truncate">{entry.destination || "N/A"}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
          <span>
            {entry.distance_km ? `${formatNumber(entry.distance_km)} km` : "Distance N/A"}
          </span>
          <div className="flex items-center gap-2">
            {hasFreight && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                Freight Linked
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor}`}>
              {entry.status || "pending"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});