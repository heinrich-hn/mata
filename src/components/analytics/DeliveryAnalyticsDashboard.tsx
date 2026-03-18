import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatCurrency as formatCurrencyLib } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import
  {
    AlertTriangle,
    DollarSign,
    Download,
    Star,
    TrendingUp
  } from "lucide-react";

type DriverBehavior = Database["public"]["Tables"]["driver_behavior"]["Row"];
type DeliveryCosts = Database["public"]["Tables"]["delivery_costs"]["Row"];
type CustomerAnalytics = Database["public"]["Tables"]["customer_delivery_analytics"]["Row"];

export const DeliveryAnalyticsDashboard = () => {
  // Fetch dashboard summary
  const { data: summary } = useQuery({
    queryKey: ["delivery-dashboard-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_dashboard_summary")
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent deliveries performance
  const { data: recentPerformance = [] } = useQuery({
    queryKey: ["recent-delivery-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_performance")
        .select("*, loads!inner(customer_name, origin, destination)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  // Fetch driver behavior stats
  const { data: driverStats = [] } = useQuery({
    queryKey: ["driver-behavior-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_behavior")
        .select("*")
        .order("trip_start", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as DriverBehavior[];
    },
  });

  // Fetch cost analytics
  const { data: costData = [] } = useQuery({
    queryKey: ["delivery-costs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_costs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as DeliveryCosts[];
    },
  });

  // Fetch customer analytics
  const { data: customerStats = [] } = useQuery({
    queryKey: ["customer-delivery-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_delivery_analytics")
        .select("*")
        .order("total_deliveries", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as CustomerAnalytics[];
    },
  });

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "N/A";
    return formatCurrencyLib(amount, 'USD');
  };

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(1)}%`;
  };

  const { toast } = useToast();

  // Export to CSV utility
  const exportToCSV = (data: Record<string, unknown>[], filename: string, headers: string[]) => {
    try {
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers.map(header => {
            const key = header.toLowerCase().replace(/ /g, "_");
            const value = row[key] ?? "";
            return typeof value === "string" && value.includes(",")
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          }).join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Export Successful", description: `${filename} has been downloaded.` });
    } catch {
      toast({ title: "Export Failed", description: "Unable to export data.", variant: "destructive" });
    }
  };

  const exportDeliverySummary = () => {
    if (!summary) return;
    const summaryData = [{
      total_deliveries: summary.total_deliveries || 0,
      on_time_count: summary.on_time_count || 0,
      on_time_percentage: summary.on_time_percentage || 0,
      avg_performance_score: summary.avg_performance_score || 0,
      avg_route_efficiency: summary.avg_route_efficiency || 0,
      total_costs: summary.total_costs || 0,
      avg_cost_per_delivery: summary.avg_cost_per_delivery || 0,
      avg_customer_rating: summary.avg_customer_rating || 0,
    }];
    const headers = ["Total Deliveries", "On Time Count", "On Time Percentage", "Avg Performance Score", "Avg Route Efficiency", "Total Costs", "Avg Cost Per Delivery", "Avg Customer Rating"];
    exportToCSV(summaryData, "delivery_summary", headers);
  };

  const exportCustomerAnalytics = () => {
    const exportData = customerStats.map(c => ({
      customer_name: c.customer_name,
      total_deliveries: c.total_deliveries,
      on_time_percentage: c.on_time_percentage || 0,
      average_rating: c.average_rating || 0,
      total_revenue: c.total_revenue || 0,
      average_cost_per_delivery: c.average_cost_per_delivery || 0,
    }));
    const headers = ["Customer Name", "Total Deliveries", "On Time Percentage", "Average Rating", "Total Revenue", "Average Cost Per Delivery"];
    exportToCSV(exportData, "customer_analytics", headers);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Delivery Analytics</h1>
          <p className="text-muted-foreground">
            Performance metrics, costs, and insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportDeliverySummary} disabled={!summary}>
            <Download className="h-4 w-4 mr-1" />
            Summary
          </Button>
          <Button variant="outline" size="sm" onClick={exportCustomerAnalytics} disabled={customerStats.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Customer Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(summary?.on_time_percentage)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.on_time_count || 0} of {summary?.total_deliveries || 0} deliveries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avg_performance_score || 0}/100
            </div>
            <p className="text-xs text-muted-foreground">
              Route: {summary?.avg_route_efficiency || 0}/100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.total_costs)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(summary?.avg_cost_per_delivery)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Customer Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avg_customer_rating?.toFixed(1) || "N/A"}/5.0
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Deliveries Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentPerformance.map((perf) => (
                  <div
                    key={perf.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{perf.loads.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {perf.loads.origin} → {perf.loads.destination}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Score</p>
                        <Badge
                          variant={
                            perf.overall_performance_score >= 80
                              ? "default"
                              : perf.overall_performance_score >= 60
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {perf.overall_performance_score}/100
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">On Time</p>
                        <Badge variant={perf.on_time ? "default" : "destructive"}>
                          {perf.on_time ? "Yes" : `${perf.late_minutes}m late`}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Distance</p>
                        <p className="text-sm font-semibold">
                          {perf.actual_distance_km?.toFixed(0)} km
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent value="drivers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Driver Safety & Behavior</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {driverStats.map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{driver.driver_name || "Unknown Driver"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(driver.trip_start).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Safety</p>
                        <Badge
                          variant={
                            driver.overall_safety_score >= 80
                              ? "default"
                              : driver.overall_safety_score >= 60
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {driver.overall_safety_score}/100
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Incidents</p>
                        <div className="flex items-center gap-1">
                          {driver.harsh_braking_events + driver.harsh_acceleration_events > 0 && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <p className="text-sm">
                            {driver.harsh_braking_events + driver.harsh_acceleration_events}
                          </p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Fuel</p>
                        <Badge variant="secondary">{driver.fuel_efficiency_rating || "N/A"}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {costData.map((cost) => (
                  <div
                    key={cost.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">Load #{cost.load_id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(cost.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Fuel</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(cost.total_fuel_cost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Labor</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(cost.total_driver_cost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(cost.total_cost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Profit</p>
                        <Badge
                          variant={
                            (cost.profit_percentage || 0) > 0 ? "default" : "destructive"
                          }
                        >
                          {formatPercentage(cost.profit_percentage)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customerStats.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{customer.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.total_deliveries} deliveries
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">On Time</p>
                        <Badge
                          variant={
                            (customer.on_time_percentage || 0) >= 90
                              ? "default"
                              : (customer.on_time_percentage || 0) >= 75
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {formatPercentage(customer.on_time_percentage)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Rating</p>
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <p className="text-sm font-semibold">
                            {customer.average_rating?.toFixed(1) || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(customer.total_revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Cost</p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(customer.average_cost_per_delivery)}
                        </p>
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