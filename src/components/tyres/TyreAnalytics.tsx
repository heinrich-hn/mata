import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetNumbers } from "@/hooks/useFleetNumbers";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Package, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip,
  TooltipProps, XAxis, YAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tyre = {
  id: string;
  created_at: string;
  updated_at: string | null;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  size: string | null;
  position: string | null;
  current_fleet_position: string | null;
  current_tread_depth: number | null;
  initial_tread_depth: number | null;
  km_travelled: number | null;
  condition: string | null;
  purchase_date: string | null;
  purchase_cost_zar: number | null;
  notes: string | null;
  last_inspection_date: string | null;
  retread_count: number | null;
  last_rotation_date: string | null;
  rotation_due_km: number | null;
  temperature_reading: number | null;
  pressure_reading: number | null;
  last_pressure_check: string | null;
  vehicle_id: string | null;
  supplier: string | null;
  warranty_months: number | null;
  warranty_km: number | null;
};

type BrandDistributionItem = {
  name: string;
  value: number;
  color: string;
  percentage: string;
  avgTreadDepth: number;
  avgKm: number;
};

type FleetPerformanceItem = {
  fleet: string;
  avgKm: number;
  totalTreadLost: number;
  avgTreadLost: number;
  treadEfficiencyPct: number;
  count: number;
  criticalCount: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_TREAD_DEPTHS = {
  steer: 15,
  drive: 22,
  trailer: 15,
} as const;

const BRAND_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#9333ea",
  "#ea580c", "#0891b2", "#ca8a04", "#be123c",
];

const HEALTHY_CONDITIONS = ["excellent", "good"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPositionType = (position: string | null | undefined): 'steer' | 'drive' | 'trailer' | null => {
  if (!position) return null;
  if (position.startsWith('V1') || position.startsWith('V2')) return 'steer';
  if (position.startsWith('V')) return 'drive';
  if (position.startsWith('T')) return 'trailer';
  return null;
};

const formatKm = (km: number) => km.toLocaleString("en-US");

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
      {label && <p className="font-semibold text-sm mb-2">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: String(entry.color ?? "#000") }} />
            <span className="text-muted-foreground">{String(entry.name ?? "")}</span>
          </div>
          <span className="font-medium tabular-nums">
            {typeof entry.value === "number"
              ? entry.name?.toString().toLowerCase().includes("km")
                ? `${formatKm(entry.value)} km`
                : `${entry.value.toLocaleString()} mm`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const AnalyticsSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="h-8 w-64 bg-muted rounded" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 bg-muted rounded-lg" />
      ))}
    </div>
    <div className="h-96 bg-muted rounded-lg" />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const TyreAnalytics = () => {
  const [fleetFilter, setFleetFilter] = useState("all");

  const { data: tyres = [], isLoading } = useQuery({
    queryKey: ["tyres_analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tyres").select("*");
      if (error) throw error;
      return data as unknown as Tyre[];
    },
  });

  const { data: dynamicFleetNumbers = [] } = useFleetNumbers();
  const fleetTypes = useMemo(() => ["all", ...dynamicFleetNumbers], [dynamicFleetNumbers]);

  const filteredTyres = useMemo(() => {
    if (fleetFilter === "all") return tyres;
    return tyres.filter((t) => t.position?.startsWith(fleetFilter));
  }, [tyres, fleetFilter]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalTyres = filteredTyres.length;
  const tyresInService = filteredTyres.filter((t) => t.position).length;
  const inServicePct = totalTyres > 0 ? ((tyresInService / totalTyres) * 100).toFixed(0) : "0";

  const avgTreadDepth =
    totalTyres > 0
      ? filteredTyres.reduce((sum, t) => sum + (t.current_tread_depth ?? 0), 0) / totalTyres
      : 0;

  const healthyCount = filteredTyres.filter((t) =>
    HEALTHY_CONDITIONS.includes(t.condition as typeof HEALTHY_CONDITIONS[number])
  ).length;
  const healthyPct = totalTyres > 0 ? ((healthyCount / totalTyres) * 100).toFixed(0) : "0";

  const criticalCount = filteredTyres.filter((t) => t.condition === "needs_replacement").length;
  const criticalPct = totalTyres > 0 ? ((criticalCount / totalTyres) * 100).toFixed(0) : "0";

  const stats = [
    {
      title: "Total Tyres",
      value: totalTyres.toString(),
      sub: `${tyresInService} in service (${inServicePct}%)`,
      icon: Package,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Avg Tread Depth",
      value: `${avgTreadDepth.toFixed(1)} mm`,
      sub: `Min safe: ${3} mm`,
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Healthy",
      value: healthyCount.toString(),
      sub: `${healthyPct}% of fleet`,
      icon: CheckCircle,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      title: "Needs Replacement",
      value: criticalCount.toString(),
      sub: `${criticalPct}% of fleet`,
      icon: AlertCircle,
      color: criticalCount > 0 ? "text-destructive" : "text-muted-foreground",
      bg: criticalCount > 0 ? "bg-destructive/10" : "bg-muted/40",
    },
  ];

  // ── Brand distribution ─────────────────────────────────────────────────────

  const brandDistribution = useMemo((): BrandDistributionItem[] => {
    const map = filteredTyres.reduce((acc, t) => {
      const brand = t.brand ?? "Unknown";
      if (!acc[brand]) acc[brand] = { count: 0, treadSum: 0, kmSum: 0 };
      acc[brand].count += 1;
      acc[brand].treadSum += t.current_tread_depth ?? 0;
      acc[brand].kmSum += t.km_travelled ?? 0;
      return acc;
    }, {} as Record<string, { count: number; treadSum: number; kmSum: number }>);

    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, d], index) => ({
        name,
        value: d.count,
        color: BRAND_COLORS[index % BRAND_COLORS.length],
        percentage: ((d.count / (filteredTyres.length || 1)) * 100).toFixed(1),
        avgTreadDepth: d.count > 0 ? parseFloat((d.treadSum / d.count).toFixed(1)) : 0,
        avgKm: d.count > 0 ? Math.round(d.kmSum / d.count) : 0,
      }));
  }, [filteredTyres]);

  // ── Fleet performance ──────────────────────────────────────────────────────

  const fleetPerformance = useMemo((): FleetPerformanceItem[] => {
    return fleetTypes
      .filter((ft) => ft !== "all")
      .map((fleetType) => {
        const fleetTyres = tyres.filter((t) => t.position?.startsWith(fleetType));
        const count = fleetTyres.length;

        const avgKm =
          count > 0
            ? Math.round(fleetTyres.reduce((sum, t) => sum + (t.km_travelled ?? 0), 0) / count)
            : 0;

        let totalExpectedTread = 0;
        const totalTreadLost = fleetTyres.reduce((sum, t) => {
          const posType = getPositionType(t.position ?? t.current_fleet_position);
          if (!posType) return sum;
          const initial = INITIAL_TREAD_DEPTHS[posType];
          totalExpectedTread += initial - 3; // usable tread above min
          return sum + Math.max(0, initial - (t.current_tread_depth ?? 0));
        }, 0);

        const avgTreadLost = count > 0 ? parseFloat((totalTreadLost / count).toFixed(1)) : 0;
        const treadEfficiencyPct =
          totalExpectedTread > 0
            ? Math.round((1 - totalTreadLost / totalExpectedTread) * 100)
            : 100;

        const criticalCount = fleetTyres.filter((t) => t.condition === "needs_replacement").length;

        return {
          fleet: fleetType,
          avgKm,
          totalTreadLost: parseFloat(totalTreadLost.toFixed(1)),
          avgTreadLost,
          treadEfficiencyPct: Math.max(0, treadEfficiencyPct),
          count,
          criticalCount,
        };
      });
  }, [tyres, fleetTypes]);

  if (isLoading) return <AnalyticsSkeleton />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tyre Analytics</h2>
          <p className="text-muted-foreground text-sm">
            Performance and distribution analysis across your fleet
          </p>
        </div>
        <Select value={fleetFilter} onValueChange={setFleetFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Filter by fleet" />
          </SelectTrigger>
          <SelectContent>
            {fleetTypes.map((ft) => (
              <SelectItem key={ft} value={ft}>
                {ft === "all" ? "All Fleets" : `Fleet ${ft}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-1.5 rounded-md ${stat.bg}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <Tabs defaultValue="brands" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="brands">Brand Distribution</TabsTrigger>
          <TabsTrigger value="performance">Fleet Performance</TabsTrigger>
        </TabsList>

        {/* ── Brand Distribution ── */}
        <TabsContent value="brands" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Distribution</CardTitle>
              <CardDescription>
                Share by brand · {filteredTyres.length} tyres total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[460px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                    <Pie
                      data={brandDistribution}
                      cx="50%"
                      cy="45%"
                      labelLine={{ stroke: "#6b7280", strokeWidth: 1 }}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={175}
                      innerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {brandDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value: string) => (
                        <span className="text-sm text-muted-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Brand Summary Table */}
              <div className="mt-6 border-t pt-6">
                <h4 className="text-sm font-semibold mb-4">Brand Breakdown</h4>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5">Brand</th>
                        <th className="text-right px-4 py-2.5">Count</th>
                        <th className="text-right px-4 py-2.5">Share</th>
                        <th className="text-right px-4 py-2.5">Avg Tread</th>
                        <th className="text-right px-4 py-2.5">Avg KM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {brandDistribution.map((brand) => (
                        <tr key={brand.name} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: brand.color }}
                              />
                              <span className="font-medium">{brand.name}</span>
                            </div>
                          </td>
                          <td className="text-right px-4 py-2.5 tabular-nums">{brand.value}</td>
                          <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">
                            {brand.percentage}%
                          </td>
                          <td className="text-right px-4 py-2.5 tabular-nums">
                            {brand.avgTreadDepth} mm
                          </td>
                          <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">
                            {formatKm(brand.avgKm)} km
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fleet Performance ── */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Performance</CardTitle>
              <CardDescription>
                Average KM travelled and tread wear by fleet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[460px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fleetPerformance}
                    margin={{ top: 20, right: 40, left: 20, bottom: 60 }}
                    barGap={8}
                    barSize={36}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="fleet"
                      angle={-40}
                      textAnchor="end"
                      height={70}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      label={{
                        value: "Avg KM",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11, fill: "#9ca3af" },
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      label={{
                        value: "Tread Lost (mm)",
                        angle: 90,
                        position: "insideRight",
                        style: { fontSize: 11, fill: "#9ca3af" },
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value: string) => (
                        <span className="text-sm text-muted-foreground">{value}</span>
                      )}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="avgKm"
                      fill="#2563eb"
                      name="Avg KM Traveled"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="totalTreadLost"
                      fill="#dc2626"
                      name="Total Tread Lost (mm)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Fleet Summary Table */}
              <div className="mt-6 border-t pt-6">
                <h4 className="text-sm font-semibold mb-4">Fleet Breakdown</h4>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5">Fleet</th>
                        <th className="text-right px-4 py-2.5">Tyres</th>
                        <th className="text-right px-4 py-2.5">Avg KM</th>
                        <th className="text-right px-4 py-2.5">Avg Tread Lost</th>
                        <th className="text-right px-4 py-2.5">Tread Remaining</th>
                        <th className="text-right px-4 py-2.5">Critical</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fleetPerformance.map((fleet) => (
                        <tr key={fleet.fleet} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium font-mono">{fleet.fleet}</td>
                          <td className="text-right px-4 py-2.5 tabular-nums">{fleet.count}</td>
                          <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">
                            {formatKm(fleet.avgKm)} km
                          </td>
                          <td className="text-right px-4 py-2.5 tabular-nums">
                            {fleet.avgTreadLost} mm
                          </td>
                          <td className="text-right px-4 py-2.5 tabular-nums">
                            <span
                              className={
                                fleet.treadEfficiencyPct >= 60
                                  ? "text-success font-medium"
                                  : fleet.treadEfficiencyPct >= 30
                                  ? "text-warning font-medium"
                                  : "text-destructive font-medium"
                              }
                            >
                              {fleet.treadEfficiencyPct}%
                            </span>
                          </td>
                          <td className="text-right px-4 py-2.5 tabular-nums">
                            {fleet.criticalCount > 0 ? (
                              <span className="text-destructive font-semibold">
                                {fleet.criticalCount}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tread reference */}
                <div className="mt-4 rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Reference: Initial tread depths by position type
                  </p>
                  <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
                    <span><span className="font-medium text-foreground">Steer (V1–V2)</span> — 15 mm</span>
                    <span><span className="font-medium text-foreground">Drive (V3+)</span> — 22 mm</span>
                    <span><span className="font-medium text-foreground">Trailer (T*)</span> — 15 mm</span>
                    <span><span className="font-medium text-foreground">Min safe</span> — 3 mm</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TyreAnalytics;