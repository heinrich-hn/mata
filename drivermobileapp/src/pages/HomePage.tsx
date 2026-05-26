import { MobileShell } from "@/components/layout";
import { DocumentExpiryBanner } from "@/components/document-expiry-banner";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useAuth } from "@/contexts/auth-context";
import { useDriverDocuments } from "@/hooks/use-driver-documents";
import { useDriverRecord } from "@/hooks/use-driver-record";
import {
  useDieselRealtimeSync,
  useTripsRealtimeSync,
  useVehicleAssignmentSubscription,
} from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Gauge,
  MapPin,
  Snowflake,
  TrendingUp,
  Truck
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCallback, useMemo, useRef, useState } from "react";
import { TripDetailSheet } from "@/components/trip-detail-sheet";

const TRUCK_TYPES = ['truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck'];
const TRAILER_TYPES = ['reefer', 'trailer', 'interlink'];
const DEBUG_MODE = process.env.NODE_ENV === 'development';

interface Vehicle {
  id: string;
  fleet_number: string;
  registration_number: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
}

// Driver record interface
interface DriverRecord {
  id: string;
  first_name: string;
  last_name: string;
  auth_user_id: string | null;
  driver_number?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
}

// Diesel records from main dashboard (diesel_records table)
interface DieselRecord {
  id: string;
  date: string;
  litres_filled: number;
  total_cost: number;
  cost_per_litre: number | null;
  km_reading: number;
  previous_km_reading: number | null;
  distance_travelled: number | null;
  fuel_station: string;
  fleet_number: string;
  driver_name: string | null;
  currency: string | null;
}

// Trips from main dashboard (trips table)
interface Trip {
  id: string;
  trip_number: string | null;
  origin: string | null;
  destination: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  status: string | null;
  base_revenue: number | null;
  invoice_amount: number | null;
  distance_km: number | null;
  driver_name: string | null;
  client_name: string | null;
  vehicle_id: string | null;
  fleet_vehicle_id: string | null;
  starting_km: number | null;
  ending_km: number | null;
  created_at: string | null;
}

// Assignment row type
interface AssignmentVehicle {
  id: string;
  fleet_number: string;
  registration_number: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
}

interface AssignmentRow {
  vehicles: AssignmentVehicle | AssignmentVehicle[];
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  // Use ref for debug info to avoid re-renders
  const debugLoggedRef = useRef(false);

  // Active trip dialog state
  const [activeTripDialog, setActiveTripDialog] = useState<Trip | null>(null);

  // Log debug info once on mount (not in useEffect that causes re-renders)
  if (DEBUG_MODE && !debugLoggedRef.current) {
    console.group('🏠 HomePage Debug Info');
    console.log('User:', { id: user?.id, email: user?.email });
    console.log('Profile:', profile);
    debugLoggedRef.current = true;
    console.groupEnd();
  }

  // Get driver name with multiple fallbacks — memoized
  const driverName = useMemo(() => {
    if (profile?.full_name && profile.full_name !== "Driver") return profile.full_name;
    if (profile?.name && profile.name !== "Driver") return profile.name;
    const metadata = user?.user_metadata;
    if (metadata?.full_name) return metadata.full_name;
    if (metadata?.name) return metadata.name;
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return "Driver";
  }, [profile?.full_name, profile?.name, user?.user_metadata, user?.email]);

  // Find driver by auth_user_id (primary) or email (fallback)
  const { data: driverRecord } = useDriverRecord() as { data: DriverRecord | undefined };

  // The driver's DB id (from the drivers table), used for document lookups only.
  const driverId = driverRecord?.id ?? undefined;

  // Document expiry alerts
  const { alerts, expiredCount, expiringCount, hasAlerts } = useDriverDocuments(driverId);

  // Real-time subscriptions
  useVehicleAssignmentSubscription(user?.id);

  // Auto-refresh data when navigating to this tab
  useRefreshOnFocus([
    ["assigned-vehicle"],
    ["monthly-diesel-records"],
    ["monthly-trips"],
    ["recent-diesel-records"],
    ["recent-trips"],
    ["driver-documents"],
  ]);

  // Pull-to-refresh handler — memoized
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["assigned-vehicle"] }),
      queryClient.invalidateQueries({ queryKey: ["monthly-diesel-records"] }),
      queryClient.invalidateQueries({ queryKey: ["monthly-trips"] }),
      queryClient.invalidateQueries({ queryKey: ["recent-diesel-records"] }),
      queryClient.invalidateQueries({ queryKey: ["recent-trips"] }),
      queryClient.invalidateQueries({ queryKey: ["driver-documents"] }),
    ]);
  }, [queryClient]);

  // Get current month date range — memoized
  const { firstDayOfMonth, lastDayOfMonth, monthName } = useMemo(() => {
    const now = new Date();
    return {
      firstDayOfMonth: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      lastDayOfMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
      monthName: now.toLocaleString("default", { month: "long" }),
    };
  }, []);

  // Fetch all active vehicle assignments — split into truck + reefer
  const { data: vehicleAssignments, isLoading: vehicleLoading, error: vehicleError } = useQuery<{ truck: Vehicle | null; reefer: Vehicle | null }>({
    queryKey: ["assigned-vehicle", user?.id],
    queryFn: async () => {
      if (!user?.id) return { truck: null, reefer: null };

      const { data, error } = await supabase
        .from("driver_vehicle_assignments")
        .select(`
          id,
          vehicle_id,
          vehicles!inner (
            id,
            fleet_number,
            registration_number,
            make,
            model,
            vehicle_type
          )
        `)
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("assigned_at", { ascending: false });

      if (error) {
        console.error('❌ HomePage: Assignment query error:', error.message);
        throw error;
      }
      console.log('📊 HomePage: Assignments found:', data?.length || 0, 'for driver_id:', user.id);
      if (!data || data.length === 0) return { truck: null, reefer: null };

      const rows = data as unknown as AssignmentRow[];
      const normalizedRows = rows.map(r => ({
        vehicles: Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles,
      }));

      const truckRow = normalizedRows.find(r => !r.vehicles.vehicle_type || TRUCK_TYPES.includes(r.vehicles.vehicle_type));
      const reeferRow = normalizedRows.find(r => r.vehicles.vehicle_type && TRAILER_TYPES.includes(r.vehicles.vehicle_type));

      return {
        truck: truckRow?.vehicles || null,
        reefer: reeferRow?.vehicles || null,
      };
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Primary vehicle (truck) used for diesel/trip data queries
  const vehicle = vehicleAssignments?.truck ?? null;
  const reefer = vehicleAssignments?.reefer ?? null;

  // Diesel realtime sync
  useDieselRealtimeSync(user?.id, vehicle?.fleet_number);
  // Trips realtime sync
  useTripsRealtimeSync(vehicle?.id);

  // Fetch ALL diesel records for this month
  const { data: monthlyDiesel = [] } = useQuery({
    queryKey: ["monthly-diesel-records", vehicle?.fleet_number, firstDayOfMonth],
    queryFn: async () => {
      if (!vehicle?.fleet_number) return [];
      const { data, error } = await supabase
        .from("diesel_records")
        .select("id, date, litres_filled, total_cost, cost_per_litre, km_reading, previous_km_reading, distance_travelled, fuel_station, fleet_number, driver_name, currency")
        .eq("fleet_number", vehicle.fleet_number)
        .gte("date", firstDayOfMonth)
        .lte("date", lastDayOfMonth)
        .order("date", { ascending: true });

      if (error) throw error;
      return (data || []) as DieselRecord[];
    },
    enabled: !!vehicle?.fleet_number,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch ALL trips for this month
  const { data: monthlyTrips = [] } = useQuery({
    queryKey: ["monthly-trips", vehicle?.id, firstDayOfMonth],
    queryFn: async () => {
      if (!vehicle?.id) return [];

      const { data, error } = await supabase
        .from("trips")
        .select(`
          id, trip_number, origin, destination, departure_date, arrival_date,
          status, base_revenue, invoice_amount, distance_km, driver_name, client_name, vehicle_id, fleet_vehicle_id,
          starting_km, ending_km, created_at
        `)
        .eq("fleet_vehicle_id", vehicle.id)
        .gte("departure_date", firstDayOfMonth)
        .lte("departure_date", lastDayOfMonth)
        .order("departure_date", { ascending: false });

      if (error) throw error;
      return (data || []) as Trip[];
    },
    enabled: !!vehicle?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent trips
  const { data: recentTrips = [] } = useQuery({
    queryKey: ["recent-trips", vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];

      const { data, error } = await supabase
        .from("trips")
        .select(`
          id, trip_number, origin, destination, departure_date, arrival_date,
          status, base_revenue, invoice_amount, distance_km, driver_name, client_name, vehicle_id, fleet_vehicle_id,
          starting_km, ending_km, created_at
        `)
        .eq("fleet_vehicle_id", vehicle.id)
        .order("departure_date", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as Trip[];
    },
    enabled: !!vehicle?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Memoized monthly stats
  const { totalTrips, completedTrips, kmTraveled, kmPerLitre } = useMemo(() => {
    const dieselLitres = monthlyDiesel.reduce((sum, entry) => sum + (entry.litres_filled || 0), 0);
    const trips = monthlyTrips.length;
    const completed = monthlyTrips.filter(t => t.status === "completed").length;
    const distanceKm = monthlyTrips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);

    const odometerReadings = monthlyDiesel
      .filter(d => d.km_reading != null)
      .map(d => d.km_reading as number)
      .sort((a, b) => a - b);

    const km = odometerReadings.length >= 2
      ? odometerReadings[odometerReadings.length - 1] - odometerReadings[0]
      : distanceKm;

    const kmpl = dieselLitres > 0 ? km / dieselLitres : 0;

    return {
      totalTrips: trips,
      completedTrips: completed,
      kmTraveled: km,
      kmPerLitre: kmpl,
    };
  }, [monthlyDiesel, monthlyTrips]);

  const getInitials = useCallback((name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <MobileShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-6 space-y-6">
          {/* Modern Header */}
          <div className="flex items-center justify-between animate-fade-up">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                {getGreeting()}
              </p>
              <h1 className="text-2xl font-bold text-foreground">
                {driverName}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <RefreshButton onRefresh={handleRefresh} />
              <Avatar className="h-12 w-12 ring-2 ring-border">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {getInitials(driverName)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          {/* Assigned Vehicle Cards */}
          {vehicleLoading ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-5 animate-fade-up stagger-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Loading Vehicles...
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="icon-container icon-container-lg bg-muted/30 animate-pulse">
                  <Truck className="w-6 h-6 text-muted-foreground/50" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-6 w-24 bg-muted/20 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-muted/10 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ) : vehicle || reefer ? (
            <div className="space-y-3 animate-fade-up stagger-1">
              {vehicle && (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <p className="text-[11px] font-bold text-success uppercase tracking-widest">
                      Active Vehicle
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="icon-container icon-container-lg bg-primary/10">
                      <Truck className="w-6 h-6 text-primary" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xl">{vehicle.fleet_number}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {vehicle.registration_number}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                  {vehicle.make && vehicle.model && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        {vehicle.make} {vehicle.model}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {reefer && (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">
                      Active Reefer
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="icon-container icon-container-lg bg-blue-500/10">
                      <Snowflake className="w-6 h-6 text-blue-500" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xl">{reefer.fleet_number}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {reefer.registration_number}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                  {reefer.make && reefer.model && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        {reefer.make} {reefer.model}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-8 animate-fade-up stagger-1">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="icon-container icon-container-lg bg-muted/50 mb-4">
                  <AlertCircle className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="font-semibold">No Vehicle Assigned</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {vehicleError
                    ? `Could not load vehicle: ${vehicleError.message}`
                    : "Contact your supervisor"}
                </p>
              </div>
            </div>
          )}

          {/* Document Expiry Notifications */}
          {hasAlerts && (
            <DocumentExpiryBanner
              alerts={alerts}
              expiredCount={expiredCount}
              expiringCount={expiringCount}
            />
          )}

          {/* Monthly Stats Header */}
          <div className="animate-fade-up stagger-2">
            <p className="section-title mb-3">{monthName} Overview</p>
          </div>

          {/* Stats Grid - 4 key metrics */}
          <div className="grid grid-cols-2 gap-3 animate-fade-up stagger-2">
            {/* KM Traveled */}
            <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="icon-container icon-container-sm bg-warning/10">
                  <Gauge className="w-4 h-4 text-warning" strokeWidth={2} />
                </div>
                <p className="stat-label">KM Traveled</p>
              </div>
              <p className="text-2xl font-bold">{formatNumber(kmTraveled)}</p>
              <p className="text-xs text-muted-foreground">this month</p>
            </div>

            {/* Total Trips */}
            <Link to="/trip" className="block">
              <div className="rounded-2xl border border-border bg-card shadow-sm p-4 h-full active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-container icon-container-sm bg-success/10">
                    <Activity className="w-4 h-4 text-success" strokeWidth={2} />
                  </div>
                  <p className="stat-label">Trips</p>
                </div>
                <p className="text-2xl font-bold">{totalTrips}</p>
                <p className="text-xs text-muted-foreground">
                  {completedTrips} completed
                </p>
              </div>
            </Link>

            {/* Average Fuel Efficiency (km/L) */}
            <Link to="/diesel" className="block">
              <div className="rounded-2xl border border-border bg-card shadow-sm p-4 h-full active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-container icon-container-sm bg-warning/10">
                    <TrendingUp className="w-4 h-4 text-warning" strokeWidth={2} />
                  </div>
                  <p className="stat-label">Avg km/L</p>
                </div>
                <p className="text-2xl font-bold">
                  {kmPerLitre > 0 ? kmPerLitre.toFixed(2) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {kmPerLitre > 0 ? "km per litre" : "this month"}
                </p>
              </div>
            </Link>
          </div>

          {/* Active Trip */}
          {(() => {
            const activeTrip = recentTrips.find(
              (t) => t.status === "in_progress" || t.status === "active"
            );
            return (
              <div className="animate-fade-up stagger-3">
                <p className="section-title mb-3">Active Trip</p>
                {activeTrip ? (
                  <button
                    type="button"
                    onClick={() => setActiveTripDialog(activeTrip)}
                    className="block w-full text-left"
                  >
                    <div className="rounded-2xl border border-border bg-card shadow-sm p-5 active:scale-[0.98] transition-transform">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <p className="text-[11px] font-bold text-success uppercase tracking-widest">
                          In Progress
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="icon-container icon-container-lg bg-primary/10">
                          <MapPin className="w-6 h-6 text-primary" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base truncate">
                            {activeTrip.origin || "N/A"} → {activeTrip.destination || "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activeTrip.trip_number ? `#${activeTrip.trip_number} • ` : ""}
                            {activeTrip.departure_date
                              ? new Date(activeTrip.departure_date).toLocaleDateString()
                              : ""}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                      {(activeTrip.client_name || activeTrip.distance_km) && (
                        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                          {activeTrip.client_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {activeTrip.client_name}
                            </p>
                          )}
                          {activeTrip.distance_km != null && (
                            <p className="text-xs font-semibold text-foreground">
                              {formatNumber(activeTrip.distance_km)} km
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="rounded-2xl border border-border bg-card shadow-sm p-6 text-center">
                    <div className="icon-container icon-container-sm bg-muted/50 mx-auto mb-3">
                      <Activity className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
                    </div>
                    <p className="text-sm font-medium">No active trip</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start a trip to see it here
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </PullToRefresh>

      {activeTripDialog && (
        <TripDetailSheet
          trip={activeTripDialog}
          open={!!activeTripDialog}
          onOpenChange={(open) => {
            if (!open) setActiveTripDialog(null);
          }}
        />
      )}
    </MobileShell>
  );
}