import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExportData extends Record<string, unknown> {
  driver_name: string;
  rank: number;
  eco_score: number;
  total_trips: number;
  violations_count: number;
  safety_score: number;
  fuel_efficiency_rating: string;
  total_distance_km: number;
  avg_speed_kmh: number;
  harsh_braking_count: number;
  harsh_acceleration_count: number;
  speeding_incidents: number;
  on_time_percentage: number;
}

interface VehicleExportData extends Record<string, unknown> {
  fleet_number: string;
  registration: string;
  total_trips: number;
  total_distance_km: number;
  avg_speed_kmh: number;
  safety_score: number;
  harsh_braking_count: number;
  harsh_acceleration_count: number;
  speeding_incidents: number;
  fuel_efficiency_l_per_100km: number;
  on_time_percentage: number;
}

interface RoutePerformanceData {
  load_id: string;
  planned_distance_km: number | null;
  actual_distance_km: number | null;
  route_efficiency_score: number | null;
  created_at: string;
  loads: {
    customer_name: string;
    origin: string;
    destination: string;
  };
}

export const useAnalyticsExport = () => {
  const { toast } = useToast();

  const exportToCSV = (data: Record<string, unknown>[], filename: string, headers: string[]) => {
    try {
      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...data.map((row: Record<string, unknown>) =>
          headers.map(header => {
            const value = row[header.toLowerCase().replace(/ /g, "_")] ?? "";
            // Escape quotes and wrap in quotes if it contains a comma
            return typeof value === "string" && value.includes(",")
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          }).join(",")
        )
      ].join("\n");      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `${filename} has been downloaded as a CSV file.`,
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export Failed",
        description: "Unable to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportDriverPerformance = (driverData: ExportData[]) => {
    const headers = [
      "Driver Name",
      "Rank",
      "Eco Score",
      "Total Trips",
      "Violations Count",
      "Safety Score",
      "Fuel Efficiency Rating",
      "Total Distance Km",
      "Avg Speed Kmh",
      "Harsh Braking Count",
      "Harsh Acceleration Count",
      "Speeding Incidents",
      "On Time Percentage"
    ];

    exportToCSV(driverData, "driver_performance_report", headers);
  };

  const exportVehiclePerformance = (vehicleData: VehicleExportData[]) => {
    const headers = [
      "Fleet Number",
      "Registration",
      "Total Trips",
      "Total Distance Km",
      "Avg Speed Kmh",
      "Safety Score",
      "Harsh Braking Count",
      "Harsh Acceleration Count",
      "Speeding Incidents",
      "Fuel Efficiency L Per 100km",
      "On Time Percentage"
    ];

    exportToCSV(vehicleData, "vehicle_performance_report", headers);
  };

  const exportRouteEfficiency = async (startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase
        .from("delivery_performance")
        .select(`
          load_id,
          planned_distance_km,
          actual_distance_km,
          route_efficiency_score,
          created_at,
          loads!inner(customer_name, origin, destination)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const routeData = (data || []).map((item: RoutePerformanceData) => ({
        load_id: item.load_id,
        customer_name: item.loads.customer_name,
        origin: item.loads.origin,
        destination: item.loads.destination,
        planned_distance_km: item.planned_distance_km || 0,
        actual_distance_km: item.actual_distance_km || 0,
        efficiency_percentage: item.route_efficiency_score || 100,
        extra_km: (item.actual_distance_km || 0) - (item.planned_distance_km || 0),
        date: new Date(item.created_at).toLocaleDateString(),
      }));

      const headers = [
        "Load ID",
        "Customer Name",
        "Origin",
        "Destination",
        "Planned Distance Km",
        "Actual Distance Km",
        "Efficiency Percentage",
        "Extra Km",
        "Date"
      ];

      exportToCSV(routeData, "route_efficiency_report", headers);
    } catch (error) {
      console.error("Route efficiency export failed:", error);
      toast({
        title: "Export Failed",
        description: "Unable to export route efficiency data.",
        variant: "destructive",
      });
    }
  };

  // Generate comprehensive analytics summary
  const generateAnalyticsSummary = async (
    driverData: ExportData[],
    vehicleData: VehicleExportData[],
    startDate: string,
    endDate: string
  ) => {
    const summary = {
      generated_date: new Date().toISOString(),
      period: `${startDate} to ${endDate}`,

      // Driver metrics
      total_drivers: driverData.length,
      avg_eco_score: driverData.length > 0
        ? (driverData.reduce((sum, d) => sum + d.eco_score, 0) / driverData.length).toFixed(1)
        : 0,
      eco_champions: driverData.filter(d => d.eco_score >= 90).length,
      perfect_drivers: driverData.filter(d => d.violations_count === 0).length,

      // Vehicle metrics
      total_vehicles: vehicleData.length,
      avg_vehicle_efficiency: vehicleData.length > 0
        ? (vehicleData.reduce((sum, v) => sum + v.fuel_efficiency_l_per_100km, 0) / vehicleData.length).toFixed(2)
        : 0,

      // Safety metrics
      total_violations: driverData.reduce((sum, d) => sum + d.violations_count, 0),
      avg_safety_score: driverData.length > 0
        ? (driverData.reduce((sum, d) => sum + d.safety_score, 0) / driverData.length).toFixed(1)
        : 0,

      // Performance metrics
      total_trips: driverData.reduce((sum, d) => sum + d.total_trips, 0),
      total_distance: driverData.reduce((sum, d) => sum + d.total_distance_km, 0).toFixed(0),
      avg_on_time_percentage: driverData.length > 0
        ? (driverData.reduce((sum, d) => sum + d.on_time_percentage, 0) / driverData.length).toFixed(1)
        : 0,
    };

    const headers = [
      "Generated Date",
      "Period",
      "Total Drivers",
      "Avg Eco Score",
      "Eco Champions",
      "Perfect Drivers",
      "Total Vehicles",
      "Avg Vehicle Efficiency",
      "Total Violations",
      "Avg Safety Score",
      "Total Trips",
      "Total Distance",
      "Avg On Time Percentage"
    ];

    exportToCSV([summary], "analytics_summary", headers);
  };

  return {
    exportDriverPerformance,
    exportVehiclePerformance,
    exportRouteEfficiency,
    generateAnalyticsSummary,
    exportToCSV,
  };
};