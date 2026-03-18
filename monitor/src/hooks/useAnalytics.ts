import { useQuery } from "@tanstack/react-query";
import { format, subDays, eachDayOfInterval, eachHourOfInterval } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { AlertFilters, TimeSeriesPoint, CategoryDataPoint } from "@/types";

// ─── Alert trend data for AreaChart ──────────────────────────────────────────

export function useAlertTrend(filters: AlertFilters) {
  return useQuery({
    queryKey: ["alert-trend", filters.startDate, filters.endDate],
    queryFn: async (): Promise<TimeSeriesPoint[]> => {
      const { data, error } = await supabase
        .from("alerts")
        .select("severity, triggered_at")
        .gte("triggered_at", filters.startDate.toISOString())
        .lte("triggered_at", filters.endDate.toISOString())
        .order("triggered_at", { ascending: true });

      if (error) throw error;

      const diffHours =
        (filters.endDate.getTime() - filters.startDate.getTime()) / 3_600_000;

      // Use hourly buckets for <48h, daily for longer ranges
      const useHourly = diffHours <= 48;

      const intervals = useHourly
        ? eachHourOfInterval({ start: filters.startDate, end: filters.endDate })
        : eachDayOfInterval({ start: filters.startDate, end: filters.endDate });

      const buckets: Record<string, TimeSeriesPoint> = {};
      intervals.forEach((dt) => {
        const key = useHourly ? format(dt, "MMM d HH:mm") : format(dt, "MMM d");
        buckets[key] = {
          period: key,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0
        };
      });

      (data ?? []).forEach((row) => {
        const dt = new Date(row.triggered_at);
        const key = useHourly ? format(dt, "MMM d HH:mm") : format(dt, "MMM d");
        if (buckets[key]) {
          const sev = row.severity as keyof Omit<TimeSeriesPoint, "period" | "total">;
          if (sev in buckets[key]) {
            buckets[key][sev]++;
          }
          buckets[key].total++;
        }
      });

      return Object.values(buckets);
    },
    staleTime: 60_000,
  });
}

// ─── Category distribution PieChart ──────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  speed_violation: "#ef4444",
  geofence_breach: "#f97316",
  fuel_anomaly: "#f59e0b",
  maintenance_due: "#84cc16",
  driver_behavior: "#06b6d4",
  vehicle_fault: "#8b5cf6",
  trip_delay: "#ec4899",
  load_exception: "#14b8a6",
  tyre_pressure: "#f59e0b",
  duplicate_pod: "#ec4899",
  document_expiry: "#f59e0b",
  custom: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  speed_violation: "Speed Violation",
  geofence_breach: "Geofence Breach",
  fuel_anomaly: "Fuel Anomaly",
  maintenance_due: "Maintenance Due",
  driver_behavior: "Driver Behavior",
  vehicle_fault: "Vehicle Fault",
  trip_delay: "Trip Delay",
  load_exception: "Load Exception",
  tyre_pressure: "Tyre Pressure",
  duplicate_pod: "Duplicate POD",
  document_expiry: "Document Expiry",
  custom: "Custom",
};

export function useAlertsByCategory(filters: AlertFilters) {
  return useQuery({
    queryKey: ["alerts-by-category", filters.startDate, filters.endDate],
    queryFn: async (): Promise<CategoryDataPoint[]> => {
      const { data, error } = await supabase
        .from("alerts")
        .select("category")
        .gte("triggered_at", filters.startDate.toISOString())
        .lte("triggered_at", filters.endDate.toISOString());

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data ?? []).forEach((row) => {
        counts[row.category] = (counts[row.category] ?? 0) + 1;
      });

      return Object.entries(counts)
        .map(([cat, val]) => ({
          name: CATEGORY_LABELS[cat] ?? cat,
          value: val,
          color: CATEGORY_COLORS[cat] ?? "#6b7280",
        }))
        .sort((a, b) => b.value - a.value);
    },
    staleTime: 60_000,
  });
}

// ─── KPI summary ──────────────────────────────────────────────────────────────

export function useKPISummary(filters: AlertFilters) {
  return useQuery({
    queryKey: ["kpi-summary", filters.startDate, filters.endDate],
    queryFn: async () => {
      // Active alerts count (current)
      const { count: activeCount } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Critical active alerts
      const { count: criticalCount } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("severity", "critical");

      // Total alerts in period
      const { count: totalCount } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .gte("triggered_at", filters.startDate.toISOString())
        .lte("triggered_at", filters.endDate.toISOString());

      // Resolved in period
      const { count: resolvedCount } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved")
        .gte("triggered_at", filters.startDate.toISOString())
        .lte("triggered_at", filters.endDate.toISOString());

      const total = totalCount ?? 0;
      const resolved = resolvedCount ?? 0;
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      // Compare with previous period
      const periodMs = filters.endDate.getTime() - filters.startDate.getTime();
      const prevEnd = filters.startDate;
      const prevStart = new Date(filters.startDate.getTime() - periodMs);

      const { count: prevTotalCount } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .gte("triggered_at", prevStart.toISOString())
        .lte("triggered_at", prevEnd.toISOString());

      const prevTotal = prevTotalCount ?? 0;
      const alertsTrend = prevTotal > 0
        ? Math.round(((total - prevTotal) / prevTotal) * 100)
        : 0;

      return {
        activeAlerts: activeCount ?? 0,
        criticalAlerts: criticalCount ?? 0,
        totalAlerts: total,
        resolvedAlerts: resolved,
        resolutionRate,
        alertsTrend,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ─── Recent 7-day comparison for KPI trend bars ───────────────────────────────

export function useDailyAlertTrend() {
  return useQuery({
    queryKey: ["daily-alert-trend"],
    queryFn: async () => {
      const start = subDays(new Date(), 6);
      const { data, error } = await supabase
        .from("alerts")
        .select("severity, triggered_at")
        .gte("triggered_at", start.toISOString())
        .order("triggered_at", { ascending: true });

      if (error) throw error;

      const days = eachDayOfInterval({ start, end: new Date() });
      const result = days.map((day) => {
        const key = format(day, "EEE");
        const dayAlerts = (data ?? []).filter(
          (a) => format(new Date(a.triggered_at), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
        );

        const critical = dayAlerts.filter(a => a.severity === "critical").length;
        const high = dayAlerts.filter(a => a.severity === "high").length;
        const medium = dayAlerts.filter(a => a.severity === "medium").length;

        return {
          day: key,
          total: dayAlerts.length,
          critical,
          high,
          medium,
        };
      });

      return result;
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}

// ─── Source table data ────────────────────────────────────────────────────────

export function useAlertsBySource(filters: AlertFilters) {
  return useQuery({
    queryKey: ["alerts-by-source", filters.startDate, filters.endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("source_label, source_type, severity, status")
        .gte("triggered_at", filters.startDate.toISOString())
        .lte("triggered_at", filters.endDate.toISOString())
        .not("source_label", "is", null);

      if (error) throw error;

      const sourceMap: Record<string, {
        source_label: string;
        source_type: string;
        total: number;
        active: number;
        critical: number;
        high: number;
        medium: number;
      }> = {};

      (data ?? []).forEach((row) => {
        const key = row.source_label ?? "Unknown";
        if (!sourceMap[key]) {
          sourceMap[key] = {
            source_label: key,
            source_type: row.source_type,
            total: 0,
            active: 0,
            critical: 0,
            high: 0,
            medium: 0,
          };
        }
        sourceMap[key].total++;
        if (row.status === "active") {
          sourceMap[key].active++;
        }
        if (row.severity === "critical") sourceMap[key].critical++;
        if (row.severity === "high") sourceMap[key].high++;
        if (row.severity === "medium") sourceMap[key].medium++;
      });

      return Object.values(sourceMap).sort((a, b) => b.total - a.total).slice(0, 15);
    },
    staleTime: 60_000,
  });
}