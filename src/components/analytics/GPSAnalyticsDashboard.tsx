import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalyticsExport } from "@/hooks/useAnalyticsExport";
import { supabase } from "@/integrations/supabase/client";
import { useWialonContext } from "@/integrations/wialon";
import { useQuery } from "@tanstack/react-query";
import
  {
    Activity,
    AlertTriangle,
    BarChart3,
    Download,
    FileSpreadsheet,
    MapPin,
    Navigation2,
    TrendingDown,
    TrendingUp,
    Truck,
    Zap
  } from "lucide-react";
import { useState } from "react";
import
  {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
  } from "recharts";

interface RouteEfficiencyMetrics {
  load_id: string;
  customer_name: string;
  planned_distance_km: number;
  actual_distance_km: number;
  efficiency_percentage: number;
  extra_km: number;
  estimated_extra_cost: number;
  route_date: string;
}

interface VehiclePerformanceMetrics {
  vehicle_id: string;
  fleet_number: string;
  registration: string;
  total_trips: number;
  total_distance_km: number;
  avg_speed_kmh: number;
  total_fuel_used_litres: number;
  fuel_efficiency_l_per_100km: number;
  harsh_braking_count: number;
  harsh_acceleration_count: number;
  speeding_incidents: number;
  safety_score: number;
  avg_delivery_time_mins: number;
  on_time_percentage: number;
}

interface DriverPerformanceMetrics {
  driver_name: string;
  total_trips: number;
  total_distance_km: number;
  avg_speed_kmh: number;
  safety_score: number;
  harsh_braking_count: number;
  harsh_acceleration_count: number;
  speeding_incidents: number;
  on_time_percentage: number;
  // Eco-driving specific metrics
  violations_count: number;
  eco_score: number;
  rank: number;
  fuel_efficiency_score: number;
  mileage_per_trip: number;
  duration_per_trip: number;
  fuel_efficiency_rating: string;
  idle_time_mins: number;
  on_time_deliveries: number;
  late_deliveries: number;
}

interface CostPerKmMetrics {
  period: string;
  total_distance_km: number;
  total_fuel_cost: number;
  total_driver_cost: number;
  total_maintenance_cost: number;
  total_cost: number;
  cost_per_km: number;
  revenue: number;
  profit: number;
  profit_margin_percentage: number;
}

export const GPSAnalyticsDashboard = () => {
  const { vehicleLocations, isConnected: wialonConnected } = useWialonContext();
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const {
    exportDriverPerformance,
    exportVehiclePerformance,
    exportRouteEfficiency,
    generateAnalyticsSummary
  } = useAnalyticsExport();

  // Calculate date range based on selected period
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (selectedPeriod) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch Route Efficiency Metrics
  const { data: routeEfficiency = [] } = useQuery({
    queryKey: ["route-efficiency", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_performance")
        .select(`
          id,
          load_id,
          planned_distance_km,
          actual_distance_km,
          route_efficiency_score,
          created_at,
          loads!inner(customer_name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (error) throw error;

      type DeliveryPerformanceRow = {
        load_id: string;
        planned_distance_km: number | null;
        actual_distance_km: number | null;
        route_efficiency_score: number | null;
        created_at: string;
        loads: { customer_name: string };
      };

      return (data || []).map((item: DeliveryPerformanceRow) => ({
        load_id: item.load_id,
        customer_name: item.loads.customer_name,
        planned_distance_km: item.planned_distance_km || 0,
        actual_distance_km: item.actual_distance_km || 0,
        efficiency_percentage: item.route_efficiency_score || 100,
        extra_km: (item.actual_distance_km || 0) - (item.planned_distance_km || 0),
        estimated_extra_cost: ((item.actual_distance_km || 0) - (item.planned_distance_km || 0)) * 3.5, // R3.50/km estimate
        route_date: item.created_at,
      })) as RouteEfficiencyMetrics[];
    },
    enabled: !!startDate && !!endDate,
  });

  // Fetch Vehicle Performance Metrics
  const { data: vehiclePerformance = [] } = useQuery({
    queryKey: ["vehicle-performance", startDate, endDate],
    queryFn: async () => {
      // Fetch delivery performance with vehicle data
      const { data, error } = await supabase
        .from("delivery_performance")
        .select(`
          *,
          vehicles!inner(id, fleet_number, registration_number)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (error) {
        console.error("Vehicle performance query error:", error);
        return [];
      }

      // Aggregate by vehicle
      const vehicleMap = new Map<string, VehiclePerformanceMetrics & { on_time_count: number }>();

      type VehiclePerformanceRow = {
        vehicle_id: string;
        load_id: string;
        actual_distance_km: number | null;
        average_speed_kmh: number | null;
        harsh_braking_count: number | null;
        harsh_acceleration_count: number | null;
        speeding_incidents: number | null;
        overall_performance_score: number | null;
        vehicles: { id: string; fleet_number: string; registration_number: string };
        on_time: boolean | null;
        total_duration_minutes: number | null;
      };

      (data as unknown as VehiclePerformanceRow[] || []).forEach((perf: VehiclePerformanceRow) => {
        const vehicleId = perf.vehicle_id;
        const existing = vehicleMap.get(vehicleId) || {
          vehicle_id: vehicleId,
          fleet_number: perf.vehicles.fleet_number,
          registration: perf.vehicles.registration_number,
          total_trips: 0,
          total_distance_km: 0,
          avg_speed_kmh: 0,
          total_fuel_used_litres: 0,
          fuel_efficiency_l_per_100km: 0,
          harsh_braking_count: 0,
          harsh_acceleration_count: 0,
          speeding_incidents: 0,
          safety_score: 0,
          avg_delivery_time_mins: 0,
          on_time_percentage: 0,
          on_time_count: 0,
        };

        existing.total_trips += 1;
        existing.total_distance_km += perf.actual_distance_km || 0;
        existing.avg_speed_kmh += perf.average_speed_kmh || 0;
        existing.harsh_braking_count += perf.harsh_braking_count || 0;
        existing.harsh_acceleration_count += perf.harsh_acceleration_count || 0;
        existing.speeding_incidents += perf.speeding_incidents || 0;
        existing.safety_score += perf.overall_performance_score || 0;

        if (perf.on_time) {
          existing.on_time_count += 1;
        }

        existing.avg_delivery_time_mins += perf.total_duration_minutes || 0;

        vehicleMap.set(vehicleId, existing);
      });

      // Calculate averages
      const result: VehiclePerformanceMetrics[] = [];
      vehicleMap.forEach((metrics) => {
        metrics.avg_speed_kmh = metrics.avg_speed_kmh / metrics.total_trips;
        metrics.safety_score = metrics.safety_score / metrics.total_trips;
        metrics.avg_delivery_time_mins = metrics.avg_delivery_time_mins / metrics.total_trips;
        metrics.on_time_percentage =
          metrics.total_trips > 0 ? (metrics.on_time_count / metrics.total_trips) * 100 : 0;
        metrics.fuel_efficiency_l_per_100km =
          metrics.total_distance_km > 0
            ? (metrics.total_fuel_used_litres / metrics.total_distance_km) * 100
            : 0;

        // Remove the temporary on_time_count before pushing
        const {on_time_count: _on_time_count, ...metricsFinal} = metrics;
        result.push(metricsFinal);
      });

      return result.sort((a, b) => b.total_trips - a.total_trips);
    },
    enabled: !!startDate && !!endDate,
  });

  // Fetch Driver Performance Metrics
  const { data: driverPerformance = [] } = useQuery({
    queryKey: ["driver-performance", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_behavior")
        .select("*")
        .gte("trip_start", startDate)
        .lte("trip_start", endDate)
        .order("trip_start", { ascending: false });

      if (error) throw error;

      // Aggregate by driver
      const driverMap = new Map<string, DriverPerformanceMetrics>();

      type DriverBehaviorRow = {
        driver_name: string | null;
        trip_duration_minutes: number | null;
        overall_safety_score: number | null;
        harsh_braking_events: number | null;
        harsh_acceleration_events: number | null;
        speed_limit_violations: number | null;
        total_idle_minutes: number | null;
      };

      (data || []).forEach((trip: DriverBehaviorRow) => {
        const driverName = trip.driver_name || "Unknown";
        const existing = driverMap.get(driverName) || {
          driver_name: driverName,
          total_trips: 0,
          total_distance_km: 0,
          avg_speed_kmh: 0,
          safety_score: 0,
          harsh_braking_count: 0,
          harsh_acceleration_count: 0,
          speeding_incidents: 0,
          idle_time_mins: 0,
          fuel_efficiency_rating: "N/A",
          on_time_deliveries: 0,
          late_deliveries: 0,
          on_time_percentage: 0,
          // Eco-driving metrics
          violations_count: 0,
          eco_score: 0,
          rank: 0,
          fuel_efficiency_score: 0,
          mileage_per_trip: 0,
          duration_per_trip: 0,
        };

        existing.total_trips += 1;
        existing.total_distance_km += 0; // Not available in driver_behavior table directly
        existing.safety_score += trip.overall_safety_score || 0;
        existing.harsh_braking_count += trip.harsh_braking_events || 0;
        existing.harsh_acceleration_count += trip.harsh_acceleration_events || 0;
        existing.speeding_incidents += trip.speed_limit_violations || 0;
        existing.idle_time_mins += trip.total_idle_minutes || 0;

        // Calculate eco-driving metrics
        existing.violations_count +=
          (trip.harsh_braking_events || 0) +
          (trip.harsh_acceleration_events || 0) +
          (trip.speed_limit_violations || 0);

        driverMap.set(driverName, existing);
      });

      // Calculate averages and eco-scores
      const result: DriverPerformanceMetrics[] = [];
      let rankCounter = 0;
      driverMap.forEach((metrics) => {
        metrics.safety_score = metrics.safety_score / metrics.total_trips;
        metrics.on_time_percentage =
          metrics.total_trips > 0
            ? (metrics.on_time_deliveries / metrics.total_trips) * 100
            : 0;

        // Calculate eco-score (lower violations = higher score)
        metrics.eco_score = Math.max(0, 100 - (metrics.violations_count / metrics.total_trips) * 10);
        metrics.rank = rankCounter++; // Will be recalculated in sorting
        metrics.fuel_efficiency_score = metrics.safety_score; // Base on safety for now

        // Determine fuel efficiency rating based on safety score
        if (metrics.safety_score >= 90) {
          metrics.fuel_efficiency_rating = "Excellent";
        } else if (metrics.safety_score >= 75) {
          metrics.fuel_efficiency_rating = "Good";
        } else if (metrics.safety_score >= 60) {
          metrics.fuel_efficiency_rating = "Fair";
        } else {
          metrics.fuel_efficiency_rating = "Poor";
        }

        result.push(metrics);
      });

      // Sort by eco-score and assign ranks
      return result.sort((a, b) => b.eco_score - a.eco_score).map((driver, index) => ({
        ...driver,
        rank: index + 1,
      }));
    },
    enabled: !!startDate && !!endDate,
  });

  // Fetch Cost Per Km Metrics
  const { data: costPerKm = [] } = useQuery({
    queryKey: ["cost-per-km", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_costs")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by week
      const weeklyData = new Map<string, CostPerKmMetrics>();

      type DeliveryCostRow = {
        created_at: string | null;
        cost_per_km: number | null;
        total_fuel_cost: number | null;
        total_driver_cost: number | null;
        maintenance_cost: number | null;
        total_cost: number | null;
        delivery_revenue: number | null;
        profit_margin: number | null;
      };

      (data || []).forEach((cost: DeliveryCostRow) => {
        const date = new Date(cost.created_at || new Date());
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];

        const existing = weeklyData.get(weekKey) || {
          period: weekKey,
          total_distance_km: 0,
          total_fuel_cost: 0,
          total_driver_cost: 0,
          total_maintenance_cost: 0,
          total_cost: 0,
          cost_per_km: 0,
          revenue: 0,
          profit: 0,
          profit_margin_percentage: 0,
        };

        // Estimate distance from cost_per_km
        const estimatedDistance = cost.cost_per_km && cost.total_cost
          ? cost.total_cost / cost.cost_per_km
          : 0;

        existing.total_distance_km += estimatedDistance;
        existing.total_fuel_cost += cost.total_fuel_cost || 0;
        existing.total_driver_cost += cost.total_driver_cost || 0;
        existing.total_maintenance_cost += cost.maintenance_cost || 0;
        existing.total_cost += cost.total_cost || 0;
        existing.revenue += cost.delivery_revenue || 0;
        existing.profit += cost.profit_margin || 0;

        weeklyData.set(weekKey, existing);
      });

      // Calculate cost per km and profit margin
      const result: CostPerKmMetrics[] = [];
      weeklyData.forEach((metrics) => {
        metrics.cost_per_km =
          metrics.total_distance_km > 0
            ? metrics.total_cost / metrics.total_distance_km
            : 0;
        metrics.profit_margin_percentage =
          metrics.revenue > 0
            ? (metrics.profit / metrics.revenue) * 100
            : 0;
        result.push(metrics);
      });

      return result.sort((a, b) => a.period.localeCompare(b.period));
    },
    enabled: !!startDate && !!endDate,
  });

  // Calculate summary statistics
  const summary = {
    avgRouteEfficiency: routeEfficiency.length > 0
      ? routeEfficiency.reduce((sum, r) => sum + r.efficiency_percentage, 0) / routeEfficiency.length
      : 0,
    totalExtraKm: routeEfficiency.reduce((sum, r) => sum + Math.max(0, r.extra_km), 0),
    totalExtraCost: routeEfficiency.reduce((sum, r) => sum + Math.max(0, r.estimated_extra_cost), 0),
    avgCostPerKm: costPerKm.length > 0
      ? costPerKm.reduce((sum, c) => sum + c.cost_per_km, 0) / costPerKm.length
      : 0,
    totalProfit: costPerKm.reduce((sum, c) => sum + c.profit, 0),
    avgProfitMargin: costPerKm.length > 0
      ? costPerKm.reduce((sum, c) => sum + c.profit_margin_percentage, 0) / costPerKm.length
      : 0,
    activeVehicles: vehicleLocations.length,
    avgSafetyScore: driverPerformance.length > 0
      ? driverPerformance.reduce((sum, d) => sum + d.safety_score, 0) / driverPerformance.length
      : 0,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Chart colors
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">GPS Analytics & Performance</h1>
          <p className="text-muted-foreground">
            Route efficiency, driver behavior, and cost tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Buttons */}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportDriverPerformance(driverPerformance)}
              disabled={driverPerformance.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Export Drivers
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportVehiclePerformance(vehiclePerformance.map(v => ({
                fleet_number: v.fleet_number,
                registration: v.registration,
                total_trips: v.total_trips,
                total_distance_km: v.total_distance_km,
                avg_speed_kmh: v.avg_speed_kmh,
                safety_score: v.safety_score,
                harsh_braking_count: v.harsh_braking_count,
                harsh_acceleration_count: v.harsh_acceleration_count,
                speeding_incidents: v.speeding_incidents,
                fuel_efficiency_l_per_100km: v.fuel_efficiency_l_per_100km,
                on_time_percentage: v.on_time_percentage,
              })))}
              disabled={vehiclePerformance.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export Vehicles
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportRouteEfficiency(startDate, endDate)}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Routes
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => generateAnalyticsSummary(driverPerformance, vehiclePerformance.map(v => ({
                fleet_number: v.fleet_number,
                registration: v.registration,
                total_trips: v.total_trips,
                total_distance_km: v.total_distance_km,
                avg_speed_kmh: v.avg_speed_kmh,
                safety_score: v.safety_score,
                harsh_braking_count: v.harsh_braking_count,
                harsh_acceleration_count: v.harsh_acceleration_count,
                speeding_incidents: v.speeding_incidents,
                fuel_efficiency_l_per_100km: v.fuel_efficiency_l_per_100km,
                on_time_percentage: v.on_time_percentage,
              })), startDate, endDate)}
            >
              <Download className="h-4 w-4 mr-1" />
              Full Report
            </Button>
          </div>

          <Badge variant={wialonConnected ? "default" : "secondary"}>
            {wialonConnected ? (
              <>
                <Zap className="h-3 w-3 mr-1" />
                GPS Connected
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                GPS Offline
              </>
            )}
          </Badge>
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              size="sm"
              variant={selectedPeriod === "7d" ? "default" : "ghost"}
              onClick={() => setSelectedPeriod("7d")}
            >
              7 Days
            </Button>
            <Button
              size="sm"
              variant={selectedPeriod === "30d" ? "default" : "ghost"}
              onClick={() => setSelectedPeriod("30d")}
            >
              30 Days
            </Button>
            <Button
              size="sm"
              variant={selectedPeriod === "90d" ? "default" : "ghost"}
              onClick={() => setSelectedPeriod("90d")}
            >
              90 Days
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Route Efficiency</CardTitle>
            <Navigation2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(summary.avgRouteEfficiency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalExtraKm.toFixed(0)} km extra driven
            </p>
            <p className="text-xs text-red-500">
              Cost: {formatCurrency(summary.totalExtraCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost Per Km</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.avgCostPerKm)}
            </div>
            <p className="text-xs text-muted-foreground">
              Profit margin: {formatPercentage(summary.avgProfitMargin)}
            </p>
            <p className="text-xs text-green-600">
              Total profit: {formatCurrency(summary.totalProfit)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Driver Safety</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.avgSafetyScore.toFixed(0)}/100
            </div>
            <p className="text-xs text-muted-foreground">
              {driverPerformance.length} active drivers
            </p>
            <div className="flex items-center gap-1 text-xs">
              {summary.avgSafetyScore >= 80 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">Excellent</span>
                </>
              ) : summary.avgSafetyScore >= 60 ? (
                <>
                  <Activity className="h-3 w-3 text-yellow-600" />
                  <span className="text-yellow-600">Good</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">Needs Improvement</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeVehicles}</div>
            <p className="text-xs text-muted-foreground">
              {vehiclePerformance.length} tracked this period
            </p>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <MapPin className="h-3 w-3" />
              <span>Live GPS tracking</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="route-efficiency" className="space-y-4">
        <TabsList>
          <TabsTrigger value="route-efficiency">Route Efficiency</TabsTrigger>
          <TabsTrigger value="driver-behavior">Driver Behavior</TabsTrigger>
          <TabsTrigger value="cost-tracking">Cost Tracking</TabsTrigger>
          <TabsTrigger value="vehicle-performance">Vehicle Performance</TabsTrigger>
        </TabsList>

        {/* Route Efficiency Tab */}
        <TabsContent value="route-efficiency" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Route Efficiency Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={routeEfficiency.slice(0, 20).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="route_date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                      formatter={(value: number | string) => [`${Number(value).toFixed(1)}%`, "Efficiency"]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="efficiency_percentage"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Route Efficiency"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extra Distance by Route</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={routeEfficiency.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="customer_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number | string) => `${Number(value).toFixed(1)} km`} />
                    <Legend />
                    <Bar dataKey="extra_km" fill="#ef4444" name="Extra Km" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Route Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {routeEfficiency.slice(0, 10).map((route) => (
                  <div
                    key={route.load_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{route.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(route.route_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Planned</p>
                        <p className="text-sm font-semibold">
                          {route.planned_distance_km.toFixed(0)} km
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Actual</p>
                        <p className="text-sm font-semibold">
                          {route.actual_distance_km.toFixed(0)} km
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Efficiency</p>
                        <Badge
                          variant={
                            route.efficiency_percentage >= 95
                              ? "default"
                              : route.efficiency_percentage >= 85
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {formatPercentage(route.efficiency_percentage)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Extra Cost</p>
                        <p className="text-sm font-semibold text-red-600">
                          {formatCurrency(route.estimated_extra_cost)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Driver Behavior Tab */}
        <TabsContent value="driver-behavior" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Safety Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Excellent (90+)", value: driverPerformance.filter(d => d.safety_score >= 90).length },
                        { name: "Good (75-89)", value: driverPerformance.filter(d => d.safety_score >= 75 && d.safety_score < 90).length },
                        { name: "Fair (60-74)", value: driverPerformance.filter(d => d.safety_score >= 60 && d.safety_score < 75).length },
                        { name: "Poor (<60)", value: driverPerformance.filter(d => d.safety_score < 60).length },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {driverPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Safety Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={driverPerformance.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="driver_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="harsh_braking_count" stackId="a" fill="#ef4444" name="Harsh Braking" />
                    <Bar dataKey="harsh_acceleration_count" stackId="a" fill="#f59e0b" name="Harsh Accel" />
                    <Bar dataKey="speeding_incidents" stackId="a" fill="#8b5cf6" name="Speeding" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Eco-Driving Rankings</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">🥇 Eco Champion</Badge>
                  <Badge variant="outline">⚡ Fuel Efficient</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {driverPerformance.slice(0, 10).map((driver, index) => (
                  <div
                    key={driver.driver_name}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      index === 0
                        ? "border-yellow-300 bg-yellow-50"
                        : index === 1
                        ? "border-gray-300 bg-gray-50"
                        : index === 2
                        ? "border-orange-300 bg-orange-50"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                        index === 0
                          ? "bg-yellow-500 text-white"
                          : index === 1
                          ? "bg-gray-500 text-white"
                          : index === 2
                          ? "bg-orange-500 text-white"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : driver.rank}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{driver.driver_name}</p>
                          {index === 0 && <span className="text-yellow-600 font-medium">Champion</span>}
                          {driver.violations_count === 0 && <Badge variant="secondary" className="text-xs">Perfect</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {driver.total_trips} trips • {driver.violations_count} violations
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Eco Score</p>
                        <Badge
                          variant={
                            driver.eco_score >= 90
                              ? "default"
                              : driver.eco_score >= 75
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {driver.eco_score.toFixed(0)}/100
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Violations/Trip</p>
                        <div className="flex items-center justify-center gap-1">
                          {(driver.violations_count / driver.total_trips) > 1 && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                          <p className="text-sm font-semibold">
                            {(driver.violations_count / driver.total_trips).toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fuel Rating</p>
                        <Badge variant="secondary">{driver.fuel_efficiency_rating}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Improvement</p>
                        <div className="flex items-center justify-center">
                          {driver.eco_score > 85 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : driver.eco_score < 60 ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : (
                            <Activity className="h-4 w-4 text-yellow-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Eco-Driving Statistics Summary */}
              <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {driverPerformance.filter(d => d.eco_score >= 90).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Eco Champions (90+)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {driverPerformance.filter(d => d.violations_count === 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Perfect Drivers (0 violations)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {driverPerformance.length > 0 ? (driverPerformance.reduce((sum, d) => sum + d.eco_score, 0) / driverPerformance.length).toFixed(0) : 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Average Eco Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Driver Performance Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {driverPerformance.slice(0, 10).map((driver, index) => (
                  <div
                    key={driver.driver_name}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{driver.driver_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {driver.total_trips} trips • {driver.total_distance_km.toFixed(0)} km
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Safety</p>
                        <Badge
                          variant={
                            driver.safety_score >= 80
                              ? "default"
                              : driver.safety_score >= 60
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {driver.safety_score.toFixed(0)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Incidents</p>
                        <div className="flex items-center justify-center gap-1">
                          {(driver.harsh_braking_count + driver.harsh_acceleration_count + driver.speeding_incidents) > 5 && (
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                          )}
                          <p className="text-sm font-semibold">
                            {driver.harsh_braking_count + driver.harsh_acceleration_count + driver.speeding_incidents}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Idle Time</p>
                        <p className="text-sm font-semibold">
                          {Math.floor(driver.idle_time_mins / 60)}h {driver.idle_time_mins % 60}m
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fuel Rating</p>
                        <Badge variant="secondary">{driver.fuel_efficiency_rating}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Tracking Tab */}
        <TabsContent value="cost-tracking" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cost Per Km Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={costPerKm}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                      formatter={(value: number | string) => formatCurrency(Number(value))}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="cost_per_km"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      name="Cost Per Km"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profit Margin Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={costPerKm}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                      formatter={(value: number | string) => `${Number(value).toFixed(1)}%`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="profit_margin_percentage"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Profit Margin %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown by Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {costPerKm.map((period) => (
                  <div
                    key={period.period}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">
                        Week of {new Date(period.period).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {period.total_distance_km.toFixed(0)} km driven
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Fuel</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(period.total_fuel_cost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Labor</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(period.total_driver_cost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cost/Km</p>
                        <Badge variant="secondary">
                          {formatCurrency(period.cost_per_km)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(period.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Profit</p>
                        <Badge
                          variant={period.profit >= 0 ? "default" : "destructive"}
                        >
                          {formatCurrency(period.profit)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicle Performance Tab */}
        <TabsContent value="vehicle-performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {vehiclePerformance.slice(0, 15).map((vehicle) => (
                  <div
                    key={vehicle.vehicle_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">
                        {vehicle.fleet_number} - {vehicle.registration}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {vehicle.total_trips} trips • {vehicle.total_distance_km.toFixed(0)} km
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Speed</p>
                        <p className="text-sm font-semibold">
                          {vehicle.avg_speed_kmh.toFixed(0)} km/h
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fuel Eff.</p>
                        <p className="text-sm font-semibold">
                          {vehicle.fuel_efficiency_l_per_100km.toFixed(1)} L/100km
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Safety</p>
                        <Badge
                          variant={
                            vehicle.safety_score >= 80
                              ? "default"
                              : vehicle.safety_score >= 60
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {vehicle.safety_score.toFixed(0)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">On Time</p>
                        <Badge
                          variant={
                            vehicle.on_time_percentage >= 90
                              ? "default"
                              : vehicle.on_time_percentage >= 75
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {formatPercentage(vehicle.on_time_percentage)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Incidents</p>
                        <div className="flex items-center justify-center gap-1">
                          {(vehicle.harsh_braking_count + vehicle.harsh_acceleration_count + vehicle.speeding_incidents) > 10 && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                          <p className="text-sm">
                            {vehicle.harsh_braking_count + vehicle.harsh_acceleration_count + vehicle.speeding_incidents}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};