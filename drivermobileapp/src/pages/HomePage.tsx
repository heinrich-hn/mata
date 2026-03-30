import { MobileShell } from "@/components/layout";
import { DocumentExpiryBanner } from "@/components/document-expiry-banner";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { useDriverDocuments } from "@/hooks/use-driver-documents";
import {
  useDieselRealtimeSync,
  useFreightRealtimeSync,
  useVehicleAssignmentSubscription,
} from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Droplet,
  Gauge,
  MapPin,
  TrendingUp,
  Truck
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCallback, useMemo } from "react";

interface Vehicle {
  id: string;
  fleet_number: string;
  registration_number: string;
  make?: string;
  model?: string;
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
  fleet_vehicle_id: string | null; // Direct link to vehicles table
}

// Type for driver_vehicle_assignments join result
interface DriverVehicleAssignment {
  id: string;
  vehicle_id: string;
  vehicles: Vehicle | Vehicle[] | null;
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

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

  // Find driver by auth_user_id (primary) or email (fallback) for document expiry notifications
  const { data: driverRecord } = useQuery<{ id: string } | null>({
    queryKey: ["driver-for-docs", user?.id, user?.email],
    queryFn: async () => {
      if (!user) return null;
      // Try auth_user_id first
      if (user.id) {
        const { data } = await supabase
          .from("drivers")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      // Fallback: match by email
      if (user.email) {
        const { data } = await supabase
          .from("drivers")
          .select("id")
          .eq("email", user.email)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      return null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  // Document expiry alerts
  const { alerts, expiredCount, expiringCount, hasAlerts } = useDriverDocuments(driverRecord?.id);

  // Real-time subscriptions for dashboard data
  // (diesel sync moved below vehicle query to pass fleet_number filter)
  useFreightRealtimeSync(user?.id);
  useVehicleAssignmentSubscription(user?.id);

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

  // Fetch assigned vehicle from driver_vehicle_assignments
  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ["assigned-vehicle", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

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
    staleTime: 10 * 60 * 1000, // 10 min - realtime subscription handles updates
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
  });

  // Diesel realtime sync — needs fleet_number so placed after vehicle query
  useDieselRealtimeSync(user?.id, vehicle?.fleet_number);

  // Note: fleet_vehicle_id column directly links trips to vehicles table
  // No need for wialon_vehicles lookup anymore

  // Fetch ALL diesel records for this month (from diesel_records table - main dashboard)
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
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Fetch ALL trips for this month - linked directly to vehicles via fleet_vehicle_id
  const { data: monthlyTrips = [] } = useQuery({
    queryKey: ["monthly-trips", vehicle?.id, firstDayOfMonth],
    queryFn: async () => {
      if (!vehicle?.id) return [];

      const { data, error } = await supabase
        .from("trips")
        .select(`
          id, trip_number, origin, destination, departure_date, arrival_date,
          status, base_revenue, invoice_amount, distance_km, driver_name, client_name, vehicle_id, fleet_vehicle_id
        `)
        .eq("fleet_vehicle_id", vehicle.id)
        .gte("departure_date", firstDayOfMonth)
        .lte("departure_date", lastDayOfMonth)
        .order("departure_date", { ascending: false });

      if (error) throw error;
      return (data || []) as Trip[];
    },
    enabled: !!vehicle?.id,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Fetch recent diesel records (last 5 for activity feed) - from diesel_records table
  const { data: recentDiesel = [] } = useQuery({
    queryKey: ["recent-diesel-records", vehicle?.fleet_number],
    queryFn: async () => {
      if (!vehicle?.fleet_number) return [];
      const { data, error } = await supabase
        .from("diesel_records")
        .select("id, date, litres_filled, total_cost, cost_per_litre, km_reading, previous_km_reading, distance_travelled, fuel_station, fleet_number, driver_name, currency")
        .eq("fleet_number", vehicle.fleet_number)
        .order("date", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as DieselRecord[];
    },
    enabled: !!vehicle?.fleet_number,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Fetch recent trips (last 5 for activity feed) - linked directly via fleet_vehicle_id
  const { data: recentTrips = [] } = useQuery({
    queryKey: ["recent-trips", vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];

      const { data, error } = await supabase
        .from("trips")
        .select(`
          id, trip_number, origin, destination, departure_date, arrival_date,
          status, base_revenue, invoice_amount, distance_km, driver_name, client_name, vehicle_id, fleet_vehicle_id
        `)
        .eq("fleet_vehicle_id", vehicle.id)
        .order("departure_date", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as Trip[];
    },
    enabled: !!vehicle?.id,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Memoized monthly stats
  const { totalDieselLitres, totalDieselCost, totalTrips, completedTrips, kmTraveled, consumption } = useMemo(() => {
    const dieselLitres = monthlyDiesel.reduce((sum, entry) => sum + (entry.litres_filled || 0), 0);
    const dieselCost = monthlyDiesel.reduce((sum, entry) => sum + (entry.total_cost || 0), 0);
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

    const cons = km > 0 ? (dieselLitres / km) * 100 : 0;

    return {
      totalDieselLitres: dieselLitres,
      totalDieselCost: dieselCost,
      totalTrips: trips,
      completedTrips: completed,
      totalDistanceKm: distanceKm,
      kmTraveled: km,
      consumption: cons,
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
            <Avatar className="h-12 w-12 ring-2 ring-border">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                {getInitials(driverName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Assigned Vehicle Card */}
          {vehicleLoading ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-5 animate-fade-up stagger-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Loading Vehicle...
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
          ) : vehicle ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-5 animate-fade-up stagger-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <p className="text-[10px] font-bold text-success uppercase tracking-widest">
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
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-8 animate-fade-up stagger-1">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="icon-container icon-container-lg bg-muted/50 mb-4">
                  <AlertCircle className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="font-semibold">No Vehicle Assigned</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact your supervisor
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

            {/* Diesel Consumption */}
            <Link to="/diesel" className="block">
              <div className="rounded-2xl border border-border bg-card shadow-sm p-4 h-full active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-container icon-container-sm bg-info/10">
                    <Droplet className="w-4 h-4 text-info" strokeWidth={2} />
                  </div>
                  <p className="stat-label">Diesel</p>
                </div>
                <p className="text-2xl font-bold">{formatNumber(totalDieselLitres)}L</p>
                <p className="text-xs text-muted-foreground">
                  {consumption > 0 ? `${consumption.toFixed(1)} L/100km` : "this month"}
                </p>
              </div>
            </Link>

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

            {/* Diesel Cost */}
            <Link to="/diesel" className="block">
              <div className="rounded-2xl border border-border bg-card shadow-sm p-4 h-full active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-container icon-container-sm bg-warning/10">
                    <TrendingUp className="w-4 h-4 text-warning" strokeWidth={2} />
                  </div>
                  <p className="stat-label">Fuel Cost</p>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(totalDieselCost, "USD")}</p>
                <p className="text-xs text-muted-foreground">this month</p>
              </div>
            </Link>
          </div>

          {/* Recent Activity */}
          <div className="animate-fade-up stagger-3">
            <p className="section-title mb-3">Recent Activity</p>
            <div className="space-y-2">
              {/* Show recent trips */}
              {recentTrips.slice(0, 3).map((trip) => (
                <Link to="/trip" key={trip.id} className="block">
                  <div className="rounded-2xl border border-border bg-card shadow-sm p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                    <div className={`icon-container icon-container-sm ${trip.status === "completed" ? "bg-success/10" : "bg-warning/10"
                      }`}>
                      <MapPin className={`w-4 h-4 ${trip.status === "completed" ? "text-success" : "text-warning"
                        }`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {trip.origin || "N/A"} → {trip.destination || "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trip.departure_date ? new Date(trip.departure_date).toLocaleDateString() : "N/A"} • {trip.status || "pending"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Show recent diesel */}
              {recentDiesel.slice(0, 2).map((entry) => (
                <Link to="/diesel" key={entry.id} className="block">
                  <div className="rounded-2xl border border-border bg-card shadow-sm p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                    <div className="icon-container icon-container-sm bg-info/10">
                      <Droplet className="w-4 h-4 text-info" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {formatNumber(entry.litres_filled)}L Diesel
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString()} • {entry.fuel_station || "Unknown station"}
                      </p>
                    </div>
                    {entry.total_cost && (
                      <p className="text-sm font-semibold text-info">
                        {formatCurrency(entry.total_cost, entry.currency || "USD")}
                      </p>
                    )}
                  </div>
                </Link>
              ))}

              {recentTrips.length === 0 && recentDiesel.length === 0 && (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-6 text-center">
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Record a trip or diesel fill-up to get started
                  </p>
                </div>
              )}
            </div>
          </div>


        </div>
      </PullToRefresh>
    </MobileShell>
  );
}