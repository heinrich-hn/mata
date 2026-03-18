// src/components/TyreAnalytics.tsx
'use client';

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
import { useMemo, useState, useCallback } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

// Local type definitions
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

// Types for chart data
type BrandDistributionItem = {
  name: string;
  value: number;
  color: string;
  percentage: string;
};

type FleetPerformanceItem = {
  fleet: string;
  avgKm: number;
  totalTreadLost: number;
  count: number;
};

// Type for tooltip payload
type TooltipPayloadItem = {
  color: string;
  name: string;
  value: number;
  unit?: string;
  payload?: Record<string, unknown>;
  dataKey?: string;
};

// Constants
const INITIAL_TREAD_DEPTHS = {
  steer: 15,   // Steer tyres (V1, V2)
  drive: 22,   // Drive tyres (V3-V10)
  trailer: 15, // Trailer tyres (T*)
} as const;

// Custom tooltip component with proper types
const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm mb-2">{label}</p>
        {payload.map((entry, index) => {
          // Safe type casting with proper structure
          const typedEntry: TooltipPayloadItem = {
            color: String(entry.color || '#000'),
            name: String(entry.name || ''),
            value: Number(entry.value || 0),
            unit: entry.unit ? String(entry.unit) : undefined,
            payload: entry.payload as Record<string, unknown>,
            dataKey: entry.dataKey ? String(entry.dataKey) : undefined,
          };
          
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: typedEntry.color }} />
              <span className="text-muted-foreground">{typedEntry.name}:</span>
              <span className="font-medium">
                {typedEntry.value.toLocaleString()} {typedEntry.unit || ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const TyreAnalytics = () => {
  const [fleetFilter, setFleetFilter] = useState("all");

  // Fetch real tyre data
  const { data: tyres = [], isLoading } = useQuery({
    queryKey: ["tyres_analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyres")
        .select("*");

      if (error) throw error;
      return data as unknown as Tyre[];
    },
  });

  // Get unique fleet numbers dynamically from database
  const { data: dynamicFleetNumbers = [] } = useFleetNumbers();
  const fleetTypes = useMemo(() => ["all", ...dynamicFleetNumbers], [dynamicFleetNumbers]);

  // Filter tyres by fleet
  const filteredTyres = useMemo(() => {
    if (fleetFilter === "all") return tyres;
    return tyres.filter((t) => t.position?.startsWith(fleetFilter));
  }, [tyres, fleetFilter]);

  // Helper to determine tyre position type
  const getPositionType = useCallback((position: string | null | undefined): 'steer' | 'drive' | 'trailer' | null => {
    if (!position) return null;
    if (position.startsWith('V1') || position.startsWith('V2')) return 'steer';
    if (position.startsWith('V')) return 'drive';
    if (position.startsWith('T')) return 'trailer';
    return null;
  }, []);

  // Calculate real stats
  const totalTyres = filteredTyres.length;
  const tyresInService = filteredTyres.filter((t) => t.position).length;
  const avgTreadDepth = filteredTyres.reduce((sum, t) => sum + (t.current_tread_depth || 0), 0) / totalTyres || 0;
  const criticalTyres = filteredTyres.filter((t) => t.condition === "needs_replacement").length;

  const stats = [
    {
      title: "Total Tyres",
      value: totalTyres.toString(),
      change: `${tyresInService} in service`,
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Avg Tread Depth",
      value: `${avgTreadDepth.toFixed(1)} mm`,
      change: "Fleet average",
      icon: TrendingUp,
      color: "text-success",
    },
    {
      title: "Excellent/Good",
      value: filteredTyres.filter((t) => ["excellent", "good"].includes(t.condition)).length.toString(),
      change: "Healthy tyres",
      icon: CheckCircle,
      color: "text-info",
    },
    {
      title: "Needs Replacement",
      value: criticalTyres.toString(),
      change: "Critical attention",
      icon: AlertCircle,
      color: "text-warning",
    },
  ];

  // Brand distribution with better formatting
  const brandDistribution = useMemo((): BrandDistributionItem[] => {
    const counts = filteredTyres.reduce((acc, t) => {
      const brand = t.brand || 'Unknown';
      acc[brand] = (acc[brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const colors = [
      "#2563eb", // blue
      "#16a34a", // green
      "#dc2626", // red
      "#9333ea", // purple
      "#ea580c", // orange
      "#0891b2", // cyan
      "#ca8a04", // yellow
      "#be123c", // rose
    ];

    return Object.entries(counts).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
      percentage: ((value / filteredTyres.length) * 100).toFixed(1),
    }));
  }, [filteredTyres]);

  // Fleet performance with tread loss calculation
  const fleetPerformance = useMemo((): FleetPerformanceItem[] => {
    return fleetTypes
      .filter((ft) => ft !== "all")
      .map((fleetType) => {
        const fleetTyres = tyres.filter((t) => t.position?.startsWith(fleetType));
        const avgKm = fleetTyres.reduce((sum, t) => sum + (t.km_travelled || 0), 0) / fleetTyres.length || 0;
        
        // Calculate total tread lost based on position type
        const totalTreadLost = fleetTyres.reduce((sum, t) => {
          const positionType = getPositionType(t.position || t.current_fleet_position);
          if (!positionType) return sum;
          
          const initialDepth = INITIAL_TREAD_DEPTHS[positionType];
          const currentDepth = t.current_tread_depth || 0;
          const treadLost = Math.max(0, initialDepth - currentDepth);
          
          return sum + treadLost;
        }, 0);

        return {
          fleet: fleetType,
          avgKm: Math.round(avgKm),
          totalTreadLost: parseFloat(totalTreadLost.toFixed(1)),
          count: fleetTyres.length,
        };
      });
  }, [tyres, fleetTypes, getPositionType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading tyre analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tyre Analytics</h2>
          <p className="text-muted-foreground">Comprehensive tyre performance and distribution analysis</p>
        </div>
        <Select value={fleetFilter} onValueChange={setFleetFilter}>
          <SelectTrigger className="w-full sm:w-56">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
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

        <TabsContent value="brands" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Distribution</CardTitle>
              <CardDescription>
                Market share by tyre brand • Total: {filteredTyres.length} tyres
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                    <Pie
                      data={brandDistribution}
                      cx="50%"
                      cy="45%"
                      labelLine={{ stroke: '#666', strokeWidth: 1 }}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={180}
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
              <div className="mt-8 border-t pt-6">
                <h4 className="text-sm font-medium mb-4">Brand Summary</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {brandDistribution.map((brand) => (
                    <div key={brand.name} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.color }} />
                      <div>
                        <p className="font-medium text-sm">{brand.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {brand.value} tyres ({brand.percentage}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Type Performance</CardTitle>
              <CardDescription>
                Average kilometers traveled and total tread loss by fleet type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={fleetPerformance} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    barGap={8}
                    barSize={40}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="fleet" 
                      angle={-45} 
                      textAnchor="end" 
                      height={70}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      label={{ 
                        value: 'Average KM Traveled', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { fontSize: 12, fill: '#6b7280' }
                      }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      label={{ 
                        value: 'Total Tread Lost (mm)', 
                        angle: 90, 
                        position: 'insideRight',
                        style: { fontSize: 12, fill: '#6b7280' }
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

              {/* Performance Summary Table */}
              <div className="mt-8 border-t pt-6">
                <h4 className="text-sm font-medium mb-4">Performance Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fleetPerformance.map((fleet) => (
                    <div key={fleet.fleet} className="p-4 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm mb-3">Fleet {fleet.fleet}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tyres:</span>
                          <span className="font-medium">{fleet.count}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Avg KM:</span>
                          <span className="font-medium">{fleet.avgKm.toLocaleString()} km</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tread Lost:</span>
                          <span className="font-medium">{fleet.totalTreadLost} mm</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tread Depth Legend */}
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Initial tread depths:</span> Steer: 15mm, Drive: 22mm, Trailer: 15mm
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TyreAnalytics;