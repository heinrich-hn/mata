import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeTyres } from "@/hooks/useRealtimeTyres";
import { useRealtimeVehicles } from "@/hooks/useRealtimeVehicles";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  FileText,
  Gauge,
  LucideIcon,
  Package,
  PackageX,
  Play,
  Repeat,
  Settings,
  Timer,
  Truck,
  Wrench,
  TrendingUp,
  TrendingDown as _TrendingDown  // Prefix with underscore
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
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
import AddJobCardDialog from "./dialogs/AddJobCardDialog";
import RequestPartsDialog from "./dialogs/RequestPartsDialog";
import StartInspectionDialog from "./dialogs/StartInspectionDialog";


// Type definitions for dashboard data
interface DashboardStat {
  title: string;
  value: string | number;
  change: string;
  color: 'info' | 'success' | 'warning' | 'destructive';
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
}

interface RecentActivity {
  id: string;
  action: string;
  time: string;
  type: string;
  status?: string;
}

// Chart colors
const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  muted: "hsl(var(--muted-foreground))",
};

const STATUS_COLORS = {
  open: CHART_COLORS.info,
  in_progress: CHART_COLORS.warning,
  completed: CHART_COLORS.success,
  on_hold: CHART_COLORS.muted,
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [jobCardDialogOpen, setJobCardDialogOpen] = useState(false);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [partsDialogOpen, setPartsDialogOpen] = useState(false);

  useRealtimeVehicles();
  useRealtimeTyres();

  // Helper function to get current date
  const getCurrentDate = () => new Date();

  // Fetch comprehensive job card statistics
  const { data: jobCardStats } = useQuery({
    queryKey: ["dashboard-job-cards-enhanced"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("status, created_at, updated_at, priority, vehicle_id");

      if (error) throw error;

      const now = getCurrentDate();
      const openCards = data?.filter(jc => jc.status === "open" || jc.status === "in_progress") || [];
      const completedToday = data?.filter(jc => {
        if (jc.status !== "completed") return false;
        const updated = new Date(jc.updated_at || jc.created_at || now.toISOString());
        return updated.toDateString() === now.toDateString();
      }) || [];

      // Calculate weekly completed for trend
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const completedThisWeek = data?.filter(jc => {
        if (jc.status !== "completed") return false;
        const updated = new Date(jc.updated_at || jc.created_at || now.toISOString());
        return updated >= oneWeekAgo;
      }).length || 0;

      const completedLastWeek = data?.filter(jc => {
        if (jc.status !== "completed") return false;
        const updated = new Date(jc.updated_at || jc.created_at || now.toISOString());
        return updated >= twoWeeksAgo && updated < oneWeekAgo;
      }).length || 0;

      // Calculate average days open
      const avgDaysOpen = openCards.length > 0
        ? openCards.reduce((sum, jc) => {
            const created = new Date(jc.created_at || now.toISOString());
            const daysOpen = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            return sum + daysOpen;
          }, 0) / openCards.length
        : 0;

      // Status distribution for chart
      const statusDistribution = {
        open: data?.filter(jc => jc.status === "open").length || 0,
        in_progress: data?.filter(jc => jc.status === "in_progress").length || 0,
        completed: data?.filter(jc => jc.status === "completed").length || 0,
        on_hold: data?.filter(jc => jc.status === "on_hold").length || 0,
      };

      return {
        total: data?.length || 0,
        open: statusDistribution.open,
        inProgress: statusDistribution.in_progress,
        completed: statusDistribution.completed,
        onHold: statusDistribution.on_hold,
        completedToday: completedToday.length,
        completedThisWeek,
        completedLastWeek,
        weeklyTrend: completedLastWeek > 0
          ? ((completedThisWeek - completedLastWeek) / completedLastWeek) * 100
          : completedThisWeek > 0 ? 100 : 0,
        avgDaysOpen: Math.round(avgDaysOpen * 10) / 10,
        urgent: data?.filter(jc => jc.priority === "urgent" && jc.status !== "completed").length || 0,
        high: data?.filter(jc => jc.priority === "high" && jc.status !== "completed").length || 0,
        statusDistribution,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch fleet/vehicle statistics
  const { data: fleetStats } = useQuery({
    queryKey: ["dashboard-fleet-stats"],
    queryFn: async () => {
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, active, vehicle_type");

      if (error) throw error;

      // Get vehicles currently in workshop (with open job cards)
      const { data: activeJobCards } = await supabase
        .from("job_cards")
        .select("vehicle_id")
        .in("status", ["open", "in_progress"]);

      const vehiclesInWorkshop = new Set(activeJobCards?.map(jc => jc.vehicle_id).filter(Boolean) || []);

      const totalActive = vehicles?.filter(v => v.active).length || 0;
      const inWorkshop = vehiclesInWorkshop.size;
      const available = totalActive - inWorkshop;

      // Vehicle type breakdown
      const vehicleTypes = vehicles?.reduce((acc, v) => {
        if (v.active) {
          const type = v.vehicle_type || "Unknown";
          acc[type] = (acc[type] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        total: vehicles?.length || 0,
        active: totalActive,
        inWorkshop,
        available,
        availabilityRate: totalActive > 0 ? Math.round((available / totalActive) * 100) : 100,
        vehicleTypes,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch tyre health statistics
  const { data: tyreStats } = useQuery({
    queryKey: ["dashboard-tyre-stats"],
    queryFn: async () => {
      const { data: tyres, error } = await supabase
        .from("tyres")
        .select("condition, current_tread_depth, initial_tread_depth, tread_depth_health, pressure_health");

      if (error) throw error;

      const total = tyres?.length || 0;
      const healthy = tyres?.filter(t =>
        t.condition === "excellent" || t.condition === "good"
      ).length || 0;
      const warning = tyres?.filter(t => t.condition === "fair").length || 0;
      const critical = tyres?.filter(t =>
        t.condition === "poor" || t.condition === "needs_replacement"
      ).length || 0;
      const needsAttention = tyres?.filter(t =>
        t.tread_depth_health === "warning" ||
        t.tread_depth_health === "critical" ||
        t.pressure_health === "warning" ||
        t.pressure_health === "critical"
      ).length || 0;

      return {
        total,
        healthy,
        warning,
        critical,
        needsAttention,
        healthRate: total > 0 ? Math.round((healthy / total) * 100) : 100,
      };
    },
    refetchInterval: 60000,
  });

  // Fetch inventory statistics
  const { data: inventoryStats } = useQuery({
    queryKey: ["dashboard-inventory-stats"],
    queryFn: async () => {
      const { data: inventory, error } = await supabase
        .from("inventory")
        .select("quantity, min_quantity, category, unit_price");

      if (error) throw error;

      const total = inventory?.length || 0;
      const lowStock = inventory?.filter(i => i.quantity <= i.min_quantity).length || 0;
      const outOfStock = inventory?.filter(i => i.quantity === 0).length || 0;

      // Total inventory value
      const totalValue = inventory?.reduce((sum, i) =>
        sum + (i.quantity * (i.unit_price || 0)), 0
      ) || 0;

      // Category breakdown
      const categories = inventory?.reduce((acc, i) => {
        const category = i.category || "Uncategorized";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        total,
        lowStock,
        outOfStock,
        totalValue,
        categories,
        healthRate: total > 0 ? Math.round(((total - lowStock) / total) * 100) : 100,
      };
    },
    refetchInterval: 60000,
  });

  // Fetch parts requests statistics
  const { data: partsStats } = useQuery({
    queryKey: ["dashboard-parts-enhanced"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_requests")
        .select("status, created_at, total_price");

      if (error) throw error;

      const pending = data?.filter(pr => pr.status === "pending") || [];

      // Calculate average pending time
      const now = getCurrentDate();
      const avgPendingDays = pending.length > 0
        ? pending.reduce((sum, pr) => {
            const created = new Date(pr.created_at || now.toISOString());
            return sum + Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / pending.length
        : 0;

      // Calculate total pending value
      const pendingValue = pending.reduce((sum, pr) => sum + (pr.total_price || 0), 0);

      return {
        pending: pending.length,
        approved: data?.filter(pr => pr.status === "approved").length || 0,
        ordered: data?.filter(pr => pr.status === "ordered").length || 0,
        received: data?.filter(pr => pr.status === "received").length || 0,
        total: data?.length || 0,
        avgPendingDays: Math.round(avgPendingDays * 10) / 10,
        pendingValue,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch upcoming maintenance
  const { data: maintenanceStats } = useQuery({
    queryKey: ["dashboard-maintenance-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select("next_due_date, is_active, last_completed_date, priority");

      if (error) throw error;

      const now = getCurrentDate();
      const upcoming = data?.filter(m => {
        if (!m.is_active) return false;
        const nextDue = new Date(m.next_due_date);
        const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7;
      }).length || 0;

      const overdue = data?.filter(m => {
        if (!m.is_active) return false;
        const nextDue = new Date(m.next_due_date);
        return nextDue < now;
      }).length || 0;

      return {
        total: data?.length || 0,
        upcoming,
        overdue,
        scheduled: data?.filter(m => m.is_active).length || 0,
      };
    },
    refetchInterval: 60000,
  });

  // Fetch recent inspections
  const { data: inspectionStats } = useQuery({
    queryKey: ["dashboard-inspection-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const now = getCurrentDate();
      const today = data?.filter(i => {
        const created = new Date(i.created_at || "");
        return created.toDateString() === now.toDateString();
      }) || [];

      const thisWeek = data?.filter(i => {
        const created = new Date(i.created_at || "");
        const daysAgo = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return daysAgo <= 7;
      }) || [];

      // Calculate completion rate (completed inspections)
      const completedThisWeek = thisWeek.filter(i => i.status === "completed").length;

      return {
        total: data?.length || 0,
        today: today.length,
        thisWeek: thisWeek.length,
        passRate: thisWeek.length > 0
          ? Math.round((completedThisWeek / thisWeek.length) * 100)
          : 100,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch weekly trend data for chart
  const { data: weeklyTrendData = [] } = useQuery({
    queryKey: ["dashboard-weekly-trend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("status, created_at, updated_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Group by week
      const weeks: Record<string, { created: number; completed: number }> = {};
      const now = getCurrentDate();

      for (let i = 4; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i * 7 + 6) * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekLabel = `Week ${5 - i}`;
        weeks[weekLabel] = { created: 0, completed: 0 };

        data?.forEach(jc => {
          const created = new Date(jc.created_at || now.toISOString());
          const updated = new Date(jc.updated_at || jc.created_at || now.toISOString());

          if (created >= weekStart && created < weekEnd) {
            weeks[weekLabel].created++;
          }
          if (jc.status === "completed" && updated >= weekStart && updated < weekEnd) {
            weeks[weekLabel].completed++;
          }
        });
      }

      return Object.entries(weeks).map(([name, values]) => ({
        name,
        created: values.created,
        completed: values.completed,
      }));
    },
    refetchInterval: 300000,
  });

  // ─── KPI 1: Backlog Aging Buckets ────────────────────────────────
  const { data: backlogAging } = useQuery({
    queryKey: ["dashboard-backlog-aging"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("created_at, status")
        .in("status", ["open", "in_progress", "on_hold"]);

      if (error) throw error;

      const now = getCurrentDate();
      const buckets = { "0–2d": 0, "3–7d": 0, "8–14d": 0, "15–30d": 0, ">30d": 0 };

      (data || []).forEach(jc => {
        const age = Math.floor((now.getTime() - new Date(jc.created_at || now.toISOString()).getTime()) / 86400000);
        if (age <= 2) buckets["0–2d"]++;
        else if (age <= 7) buckets["3–7d"]++;
        else if (age <= 14) buckets["8–14d"]++;
        else if (age <= 30) buckets["15–30d"]++;
        else buckets[">30d"]++;
      });

      return Object.entries(buckets).map(([name, count]) => ({ name, count }));
    },
    refetchInterval: 60000,
  });

  // ─── KPI 2: MTTR Trend (Fault-based) ────────────────────────────
  const { data: mttrTrend } = useQuery({
    queryKey: ["dashboard-mttr-trend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_faults")
        .select("reported_date, resolved_date")
        .not("resolved_date", "is", null)
        .gte("resolved_date", new Date(Date.now() - 180 * 86400000).toISOString());

      if (error) throw error;

      // Group by month and compute average resolution time in days
      const months: Record<string, { total: number; count: number }> = {};

      (data || []).forEach(f => {
        const resolved = new Date(f.resolved_date!);
        const reported = new Date(f.reported_date);
        const days = Math.max(0, (resolved.getTime() - reported.getTime()) / 86400000);
        const monthKey = resolved.toLocaleString("en", { month: "short", year: "2-digit" });

        if (!months[monthKey]) months[monthKey] = { total: 0, count: 0 };
        months[monthKey].total += days;
        months[monthKey].count++;
      });

      const result = Object.entries(months).map(([month, v]) => ({
        month,
        avgDays: Math.round((v.total / v.count) * 10) / 10,
        count: v.count,
      }));

      // Sort chronologically
      result.sort((a, b) => {
        const parseDate = (s: string) => new Date(`01 ${s}`);
        return parseDate(a.month).getTime() - parseDate(b.month).getTime();
      });

      // Current MTTR for the summary card
      const currentMttr = result.length > 0 ? result[result.length - 1].avgDays : 0;
      const prevMttr = result.length > 1 ? result[result.length - 2].avgDays : currentMttr;
      const mttrDelta = prevMttr > 0 ? Math.round(((currentMttr - prevMttr) / prevMttr) * 100) : 0;

      return { trend: result, currentMttr, mttrDelta };
    },
    refetchInterval: 300000,
  });

  // ─── KPI 3: First-Time Fix Rate ─────────────────────────────────
  const { data: ftfrData } = useQuery({
    queryKey: ["dashboard-ftfr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_faults")
        .select("vehicle_id, fault_category, component, resolved_date, reported_date")
        .not("resolved_date", "is", null)
        .order("resolved_date", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return { rate: 100, total: 0, repeats: 0 };

      // Detect repeat faults: same vehicle + category + component within 30 days
      let repeats = 0;
      const faultMap = new Map<string, Date[]>();

      data.forEach(f => {
        const key = `${f.vehicle_id}|${f.fault_category}|${f.component || ""}`;
        const resolved = new Date(f.resolved_date!);

        const prevDates = faultMap.get(key) || [];
        const isRepeat = prevDates.some(
          prev => (resolved.getTime() - prev.getTime()) / 86400000 <= 30
        );
        if (isRepeat) repeats++;

        prevDates.push(resolved);
        faultMap.set(key, prevDates);
      });

      const total = data.length;
      const rate = total > 0 ? Math.round(((total - repeats) / total) * 100) : 100;

      return { rate, total, repeats };
    },
    refetchInterval: 300000,
  });

  // ─── KPI 4: Jobs Delayed by Stockouts ───────────────────────────
  const { data: stockoutDelays } = useQuery({
    queryKey: ["dashboard-stockout-delays"],
    queryFn: async () => {
      // Active job cards with their pending/ordered parts
      const { data: activeJobs, error: jobsErr } = await supabase
        .from("job_cards")
        .select("id, job_number, vehicle_id, created_at, title")
        .in("status", ["open", "in_progress"]);

      if (jobsErr) throw jobsErr;

      const { data: blockingParts, error: partsErr } = await supabase
        .from("parts_requests")
        .select("job_card_id, status, created_at, part_name")
        .in("status", ["pending", "requested", "ordered"]);

      if (partsErr) throw partsErr;

      const now = getCurrentDate();
      const threshold48h = 48 * 60 * 60 * 1000;

      // Map parts by job_card_id
      const partsByJob = new Map<string, typeof blockingParts>();
      (blockingParts || []).forEach(p => {
        if (!p.job_card_id) return;
        const list = partsByJob.get(p.job_card_id) || [];
        list.push(p);
        partsByJob.set(p.job_card_id, list);
      });

      // Find jobs with parts waiting > 48h
      const delayedJobs = (activeJobs || [])
        .filter(job => {
          const parts = partsByJob.get(job.id) || [];
          return parts.some(p => {
            const age = now.getTime() - new Date(p.created_at || now.toISOString()).getTime();
            return age > threshold48h;
          });
        })
        .map(job => ({
          jobNumber: job.job_number,
          title: job.title,
          partsPending: (partsByJob.get(job.id) || []).length,
        }))
        .slice(0, 5);

      return { count: delayedJobs.length, jobs: delayedJobs };
    },
    refetchInterval: 60000,
  });

  // ─── KPI 5: Monthly Cost per Vehicle ────────────────────────────
  const { data: monthlyCost } = useQuery({
    queryKey: ["dashboard-monthly-cost"],
    queryFn: async () => {
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

      // Parts cost (non-service, non-cancelled)
      const { data: parts, error: partsErr } = await supabase
        .from("parts_requests")
        .select("job_card_id, total_price, is_service, status, created_at")
        .neq("status", "cancelled")
        .gte("created_at", sixMonthsAgo);

      if (partsErr) throw partsErr;

      // Labor cost
      const { data: labor, error: laborErr } = await supabase
        .from("labor_entries")
        .select("job_card_id, total_cost, work_date")
        .gte("work_date", sixMonthsAgo);

      if (laborErr) throw laborErr;

      // Job cards → vehicle mapping
      const jobIds = new Set([
        ...(parts || []).map(p => p.job_card_id).filter(Boolean),
        ...(labor || []).map(l => l.job_card_id).filter(Boolean),
      ]);

      const vehicleMap: Record<string, string> = {};
      if (jobIds.size > 0) {
        const { data: jobs } = await supabase
          .from("job_cards")
          .select("id, vehicle_id, vehicles!inner(fleet_number)")
          .in("id", Array.from(jobIds));

        (jobs || []).forEach(j => {
          const v = j.vehicles as unknown as { fleet_number: string } | null;
          if (j.vehicle_id && v?.fleet_number) {
            vehicleMap[j.id] = v.fleet_number;
          }
        });
      }

      // Aggregate by month
      const monthlyTotals: Record<string, { parts: number; labor: number }> = {};

      (parts || []).filter(p => !p.is_service).forEach(p => {
        const month = new Date(p.created_at || "").toLocaleString("en", { month: "short", year: "2-digit" });
        if (!monthlyTotals[month]) monthlyTotals[month] = { parts: 0, labor: 0 };
        monthlyTotals[month].parts += p.total_price || 0;
      });

      (labor || []).forEach(l => {
        const month = new Date(l.work_date || "").toLocaleString("en", { month: "short", year: "2-digit" });
        if (!monthlyTotals[month]) monthlyTotals[month] = { parts: 0, labor: 0 };
        monthlyTotals[month].labor += l.total_cost || 0;
      });

      const trend = Object.entries(monthlyTotals)
        .map(([month, costs]) => ({
          month,
          parts: Math.round(costs.parts),
          labor: Math.round(costs.labor),
          total: Math.round(costs.parts + costs.labor),
        }))
        .sort((a, b) => {
          const parseDate = (s: string) => new Date(`01 ${s}`);
          return parseDate(a.month).getTime() - parseDate(b.month).getTime();
        });

      // Get active vehicle count for per-vehicle average
      const { count: vehicleCount } = await supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("active", true);

      const currentMonth = trend.length > 0 ? trend[trend.length - 1].total : 0;
      const avgPerVehicle = vehicleCount && vehicleCount > 0 ? Math.round(currentMonth / vehicleCount) : 0;

      return { trend, currentMonth, avgPerVehicle, vehicleCount: vehicleCount || 0 };
    },
    refetchInterval: 300000,
  });

  // Fetch recent activity
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["dashboard-recent-activity-enhanced"],
    queryFn: async () => {
      const activities: RecentActivity[] = [];
      const now = getCurrentDate();

      // Get recent job cards
      const { data: jobCards } = await supabase
        .from("job_cards")
        .select("id, job_number, status, created_at, updated_at, priority")
        .order("updated_at", { ascending: false })
        .limit(5);

      jobCards?.forEach(jc => {
        const timeAgo = getTimeAgo(new Date(jc.updated_at || jc.created_at || now.toISOString()));
        activities.push({
          id: `jc-${jc.id}`,
          action: `Job Card #${jc.job_number} ${jc.status === "completed" ? "completed" : jc.status === "in_progress" ? "in progress" : "created"}`,
          time: timeAgo,
          type: "job_card",
          status: jc.status,
        });
      });

      // Get recent parts requests
      const { data: parts } = await supabase
        .from("parts_requests")
        .select("id, part_name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(3);

      parts?.forEach(part => {
        const timeAgo = getTimeAgo(new Date(part.created_at || now.toISOString()));
        activities.push({
          id: `pr-${part.id}`,
          action: `Parts request for ${part.part_name}`,
          time: timeAgo,
          type: "parts",
          status: part.status,
        });
      });

      // Get recent inspections
      const { data: inspections } = await supabase
        .from("vehicle_inspections")
        .select("id, status, created_at, vehicles!inner(fleet_number)")
        .order("created_at", { ascending: false })
        .limit(2);

      inspections?.forEach(insp => {
        const timeAgo = getTimeAgo(new Date(insp.created_at || ""));
        const vehicleData = insp.vehicles as { fleet_number: string } | null;
        const fleetNum = vehicleData?.fleet_number || "Unknown";
        activities.push({
          id: `insp-${insp.id}`,
          action: `Inspection for ${fleetNum} ${insp.status}`,
          time: timeAgo,
          type: "inspection",
          status: insp.status,
        });
      });

      // Sort by most recent and limit to 10
      return activities
        .sort((a, b) => {
          // Parse time strings for comparison (this is simplified, you might want a more robust approach)
          const getMinutesFromTimeString = (timeStr: string): number => {
            if (timeStr.includes("Just now")) return 0;
            const match = timeStr.match(/(\d+)/);
            return match ? parseInt(match[1]) : 999;
          };
          return getMinutesFromTimeString(a.time) - getMinutesFromTimeString(b.time);
        })
        .slice(0, 10);
    },
    refetchInterval: 30000,
  });

  const getTimeAgo = (date: Date): string => {
    const now = getCurrentDate();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Prepare job card status chart data
  const jobCardChartData = useMemo(() => {
    if (!jobCardStats?.statusDistribution) return [];
    return [
      { name: "Open", value: jobCardStats.statusDistribution.open, color: STATUS_COLORS.open },
      { name: "In Progress", value: jobCardStats.statusDistribution.in_progress, color: STATUS_COLORS.in_progress },
      { name: "Completed", value: jobCardStats.statusDistribution.completed, color: STATUS_COLORS.completed },
      { name: "On Hold", value: jobCardStats.statusDistribution.on_hold, color: STATUS_COLORS.on_hold },
    ].filter(d => d.value > 0);
  }, [jobCardStats]);

  // Build primary stats
  const primaryStats: DashboardStat[] = [
    {
      title: "Open Job Cards",
      value: jobCardStats?.open || 0,
      change: `${jobCardStats?.urgent || 0} urgent`,
      color: jobCardStats?.urgent && jobCardStats.urgent > 0 ? "destructive" : "info",
      icon: FileText,
      trend: "neutral",
      onClick: () => navigate("/job-cards"),
    },
    {
      title: "In Progress",
      value: jobCardStats?.inProgress || 0,
      change: `${jobCardStats?.high || 0} high priority`,
      color: "warning",
      icon: Clock,
      trend: "neutral",
      onClick: () => navigate("/job-cards"),
    },
    {
      title: "Fleet Available",
      value: `${fleetStats?.available || 0}/${fleetStats?.active || 0}`,
      change: `${fleetStats?.availabilityRate || 100}% availability`,
      color: (fleetStats?.availabilityRate || 100) > 80 ? "success" : "warning",
      icon: Truck,
      trend: (fleetStats?.availabilityRate || 100) > 80 ? "up" : "down",
      onClick: () => navigate("/vehicles"),
    },
    {
      title: "Completed Today",
      value: jobCardStats?.completedToday || 0,
      change: jobCardStats?.weeklyTrend !== undefined
        ? `${jobCardStats.weeklyTrend >= 0 ? "+" : ""}${Math.round(jobCardStats.weeklyTrend)}% vs last week`
        : "This week's completions",
      color: "success",
      icon: CheckCircle2,
      trend: (jobCardStats?.weeklyTrend || 0) >= 0 ? "up" : "down",
    },
  ];

  // Secondary metrics
  const secondaryStats = [
    {
      title: "Tyre Health",
      value: `${tyreStats?.healthRate || 0}%`,
      detail: `${tyreStats?.critical || 0} critical`,
      icon: Gauge,
      color: (tyreStats?.healthRate || 100) > 80 ? "success" : (tyreStats?.healthRate || 100) > 60 ? "warning" : "destructive",
      onClick: () => navigate("/tyre-management"),
    },
    {
      title: "Inventory Alerts",
      value: inventoryStats?.lowStock || 0,
      detail: `${inventoryStats?.outOfStock || 0} out of stock`,
      icon: Package,
      color: (inventoryStats?.lowStock || 0) === 0 ? "success" : (inventoryStats?.lowStock || 0) < 5 ? "warning" : "destructive",
      onClick: () => navigate("/inventory"),
    },
    {
      title: "Parts Pending",
      value: partsStats?.pending || 0,
      detail: `~${partsStats?.avgPendingDays || 0} days avg`,
      icon: Settings,
      color: (partsStats?.pending || 0) === 0 ? "success" : (partsStats?.pending || 0) < 10 ? "warning" : "destructive",
      onClick: () => navigate("/procurement"),
    },
    {
      title: "Inspections Today",
      value: inspectionStats?.today || 0,
      detail: `${inspectionStats?.passRate || 0}% pass rate`,
      icon: CheckCircle2,
      color: "info",
      onClick: () => navigate("/inspections"),
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3 w-3 text-success" />;
      case "in_progress": return <Clock className="h-3 w-3 text-warning" />;
      case "pending": return <Circle className="h-3 w-3 text-muted-foreground" />;
      case "approved": return <CheckCircle2 className="h-3 w-3 text-info" />;
      default: return <Circle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {primaryStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20"
              onClick={stat.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {secondaryStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20"
              onClick={stat.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Critical Alerts Banner */}
      {((maintenanceStats?.overdue || 0) > 0 || (tyreStats?.critical || 0) > 0 || (inventoryStats?.outOfStock || 0) > 0) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-medium text-destructive">Attention Required:</span>
              <div className="flex flex-wrap gap-2">
                {(maintenanceStats?.overdue || 0) > 0 && (
                  <Badge variant="destructive" className="cursor-pointer" onClick={() => navigate("/maintenance-scheduling")}>
                    {maintenanceStats?.overdue} Overdue Maintenance
                  </Badge>
                )}
                {(tyreStats?.critical || 0) > 0 && (
                  <Badge variant="destructive" className="cursor-pointer" onClick={() => navigate("/tyre-management")}>
                    {tyreStats?.critical} Critical Tyres
                  </Badge>
                )}
                {(inventoryStats?.outOfStock || 0) > 0 && (
                  <Badge variant="destructive" className="cursor-pointer" onClick={() => navigate("/inventory")}>
                    {inventoryStats?.outOfStock} Out of Stock
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts and Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Job Card Status Distribution */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Job Card Status
            </CardTitle>
            <CardDescription>Current distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center">
              {jobCardChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={jobCardChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {jobCardChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg shadow-lg p-2 text-sm">
                              <p className="font-medium">{payload[0].name}</p>
                              <p className="text-muted-foreground">{payload[0].value} job cards</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm">No job cards</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {jobCardChartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full stat-color-dot" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Job Card Trends
            </CardTitle>
            <CardDescription>Created vs Completed over past 5 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {weeklyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData}>
                    <defs>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.info} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={CHART_COLORS.info} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                              <p className="font-medium mb-2">{label}</p>
                              <div className="space-y-1">
                                <p className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-info" />
                                  Created: {payload[0].value}
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-success" />
                                  Completed: {payload[1].value}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke={CHART_COLORS.info}
                      fillOpacity={1}
                      fill="url(#colorCreated)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke={CHART_COLORS.success}
                      fillOpacity={1}
                      fill="url(#colorCompleted)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No trend data available
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full bg-info" />
                <span className="text-muted-foreground">Created</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full bg-success" />
                <span className="text-muted-foreground">Completed</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Workshop Performance KPIs ──────────────────────────────── */}
      {/* Row 1: FTFR + MTTR + Stockout Delays summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* First-Time Fix Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First-Time Fix Rate</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {ftfrData?.rate ?? "–"}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ftfrData?.repeats || 0} repeat fault{(ftfrData?.repeats || 0) !== 1 ? "s" : ""} out of {ftfrData?.total || 0} resolved (30-day window)
            </p>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${ftfrData?.rate ?? 0}%`,
                  backgroundColor: (ftfrData?.rate ?? 100) >= 85
                    ? CHART_COLORS.success
                    : (ftfrData?.rate ?? 100) >= 70
                    ? CHART_COLORS.warning
                    : CHART_COLORS.danger,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* MTTR Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mean Time to Repair</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {mttrTrend?.currentMttr ?? "–"} <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mttrTrend?.mttrDelta !== undefined && mttrTrend.mttrDelta !== 0 ? (
                <span className={mttrTrend.mttrDelta < 0 ? "text-green-600" : "text-red-500"}>
                  {mttrTrend.mttrDelta > 0 ? "+" : ""}{mttrTrend.mttrDelta}% vs prev month
                </span>
              ) : (
                "Based on resolved faults"
              )}
            </p>
          </CardContent>
        </Card>

        {/* Jobs Delayed by Stockouts */}
        <Card className={
          (stockoutDelays?.count || 0) > 0
            ? "border-amber-500/30 bg-amber-500/5"
            : ""
        }>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delayed by Parts</CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {stockoutDelays?.count ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Jobs waiting on parts &gt; 48h
            </p>
            {(stockoutDelays?.jobs?.length || 0) > 0 && (
              <div className="mt-3 space-y-1.5">
                {stockoutDelays!.jobs.map((job, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[140px]">#{job.jobNumber}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {job.partsPending} part{job.partsPending !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Backlog Aging + MTTR Trend charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Backlog Aging Buckets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Backlog Aging
            </CardTitle>
            <CardDescription>Open job cards by age</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {backlogAging && backlogAging.some(b => b.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={backlogAging} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg shadow-lg p-2 text-sm">
                              <p className="font-medium">{label}</p>
                              <p className="text-muted-foreground">{payload[0].value} job card{Number(payload[0].value) !== 1 ? "s" : ""}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {(backlogAging || []).map((entry, index) => {
                        const colors = [CHART_COLORS.success, CHART_COLORS.info, CHART_COLORS.warning, "#f97316", CHART_COLORS.danger];
                        return <Cell key={`cell-${index}`} fill={colors[index] || CHART_COLORS.muted} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No open backlog
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MTTR Trend Line Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              MTTR Trend
            </CardTitle>
            <CardDescription>Average resolution time per month (days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {mttrTrend?.trend && mttrTrend.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mttrTrend.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} unit="d" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                              <p className="font-medium mb-1">{label}</p>
                              <p className="text-muted-foreground">{payload[0].value} days avg ({(payload[0].payload as { count: number }).count} faults)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgDays"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.primary, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No MTTR data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Monthly Cost Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Monthly Maintenance Cost
              </CardTitle>
              <CardDescription>Parts + labour spend over last 6 months</CardDescription>
            </div>
            {monthlyCost && (
              <div className="text-right">
                <p className="text-2xl font-semibold">
                  ${monthlyCost.currentMonth.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  ~${monthlyCost.avgPerVehicle.toLocaleString()}/vehicle ({monthlyCost.vehicleCount} active)
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            {monthlyCost?.trend && monthlyCost.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCost.trend} barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-medium mb-2">{label}</p>
                            <div className="space-y-1">
                              <p className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.info }} />
                                Parts: ${Number(payload[0].value).toLocaleString()}
                              </p>
                              <p className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.warning }} />
                                Labour: ${Number(payload[1].value).toLocaleString()}
                              </p>
                              <p className="font-medium border-t pt-1 mt-1">
                                Total: ${((Number(payload[0].value) || 0) + (Number(payload[1].value) || 0)).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={30}
                    content={() => (
                      <div className="flex items-center justify-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.info }} />
                          <span className="text-muted-foreground">Parts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.warning }} />
                          <span className="text-muted-foreground">Labour</span>
                        </div>
                      </div>
                    )}
                  />
                  <Bar dataKey="parts" stackId="cost" fill={CHART_COLORS.info} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="labor" stackId="cost" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No cost data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Grid: Activity and Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest workshop updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0 group"
                  >
                    <div className="mt-0.5">{getStatusIcon(activity.status || "")}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">
                        {activity.action}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {activity.type.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Upcoming */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Play className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setJobCardDialogOpen(true)}
                  className="quick-action-btn quick-action-primary"
                >
                  <FileText className="h-4 w-4" />
                  New Job Card
                </button>
                <button
                  onClick={() => setInspectionDialogOpen(true)}
                  className="quick-action-btn quick-action-accent"
                >
                  <Truck className="h-4 w-4" />
                  Start Inspection
                </button>
                <button
                  onClick={() => setPartsDialogOpen(true)}
                  className="quick-action-btn quick-action-secondary"
                >
                  <Package className="h-4 w-4" />
                  Request Parts
                </button>
                <button
                  onClick={() => navigate("/maintenance-scheduling")}
                  className="quick-action-btn quick-action-secondary"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Maintenance
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Maintenance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Maintenance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm">Overdue</span>
                  </div>
                  <Badge variant="destructive">{maintenanceStats?.overdue || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-sm">Due This Week</span>
                  </div>
                  <Badge variant="secondary">{maintenanceStats?.upcoming || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-info" />
                    <span className="text-sm">Scheduled</span>
                  </div>
                  <Badge variant="outline">{maintenanceStats?.scheduled || 0}</Badge>
                </div>
                <button
                  onClick={() => navigate("/maintenance-scheduling")}
                  className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 py-2 transition-colors"
                >
                  View Full Schedule
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <AddJobCardDialog open={jobCardDialogOpen} onOpenChange={setJobCardDialogOpen} />
      <StartInspectionDialog
        open={inspectionDialogOpen}
        onOpenChange={setInspectionDialogOpen}
        onInspectionCreated={(inspectionId: string) => {
          setInspectionDialogOpen(false);
          navigate(`/inspections/${inspectionId}`);
        }}
      />
      <RequestPartsDialog open={partsDialogOpen} onOpenChange={setPartsDialogOpen} />
    </div>
  );
};

export default Dashboard;