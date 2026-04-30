import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import FleetGapDaysReportDialog from "@/components/reports/FleetGapDaysReportDialog";
import {
    AlertTriangle,
    BarChart3,
    Calendar,
    Car,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    FileSpreadsheet,
    FileText,
    Fuel,
    Gauge,
    Receipt,
    RefreshCw,
    Search,
    ShoppingCart,
    TrendingDown,
    TrendingUp,
    Truck,
    Users,
    Wrench,
    Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Lazy imports for export functions ────────────────────────────────────────
import {
    exportAllTyresToExcel,
    exportAllTyresToPDF,
    exportBrandSummaryToExcel,
    exportBrandSummaryToPDF,
} from "@/utils/tyreExport";
import {
    exportSchedulesToExcel,
    exportSchedulesToPDF,
    exportHistoryToExcel,
    exportHistoryToPDF,
    exportOverdueToExcel,
    exportOverdueToPDF,
} from "@/lib/maintenanceExport";
import { generateAllFaultsPDF } from "@/lib/faultExport";
import { generateBatchInspectionPDF } from "@/lib/inspectionPdfExport";
import {
    addStyledSheet,
    addSummarySheet,
    createWorkbook,
    saveWorkbook,
    statusColours,
} from "@/utils/excelStyles";

// ── Types ────────────────────────────────────────────────────────────────────
type Vehicle = {
    id: string;
    fleet_number?: string;
    registration_number?: string;
    make?: string;
    model?: string;
    active?: boolean;
    status?: string;
    vehicle_type?: string;
    tonnage?: number;
    current_odometer?: number;
};

type Inspection = {
    id: string;
    inspection_date: string;
    report_number?: string;
    vehicle_name?: string;
    vehicle_id?: string;
    inspector_name?: string;
    location?: string;
    meter_reading?: number;
    vehicle_safe_to_use?: boolean;
    maintenance_priority?: string;
    vehicle_category?: string;
    vehicle_status?: string;
};

type JobCard = {
    id: string;
    job_number?: string;
    vehicle_id?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    created_at?: string;
    description?: string;
    estimated_cost?: number;
    vehicles?: Vehicle | null;
};

type Trip = {
    id: string;
    trip_number?: string;
    fleet_vehicle_id?: string;
    fleet_number?: string;
    driver_name?: string;
    origin?: string;
    destination?: string;
    status?: string;
    departure_date?: string;
    planned_departure_date?: string;
    arrival_date?: string;
    planned_arrival_date?: string;
    base_revenue?: number;
    additional_revenue?: number;
    distance_km?: number;
    rate_per_km?: number;
    final_invoice_amount?: number;
};

type Driver = {
    id: string;
    first_name?: string;
    last_name?: string;
    driver_number?: string;
    license_number?: string;
    license_expiry?: string;
    phone?: string;
    status?: string;
    email?: string;
};

type DieselRecord = {
    id: string;
    date?: string;
    fleet_number?: string;
    driver_name?: string;
    fuel_station?: string;
    litres_filled?: number;
    cost_per_litre?: number;
    total_cost?: number;
    km_reading?: number;
    km_per_litre?: number;
};

type PartsRequest = {
    id: string;
    ir_number?: string;
    part_name?: string;
    status?: string;
    urgency_level?: string;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
    make_brand?: string;
    requested_by?: string;
    created_at?: string;
};

type ActionItem = {
    id: string;
    title?: string;
    status?: string;
    priority?: string;
    assigned_to?: string;
    due_date?: string;
    created_at?: string;
    description?: string;
};

type BrandSummary = {
    brand: string;
    bayCount: number;
    installedCount: number;
    totalQty: number;
    totalCost: number;
    totalKm: number;
    totalMmWorn: number;
    avgCostPerTyre: number;
    avgCostPerKm: number | null;
    avgCostPerMm: number | null;
};

type ReportItem = {
    id: string;
    label: string;
    description: string;
    formats: ("excel" | "pdf")[];
    onExport: (format: "excel" | "pdf") => Promise<void>;
};

type ReportSection = {
    title: string;
    icon: React.ElementType;
    description: string;
    badge?: string;
    reports: ReportItem[];
};

type Tyre = {
    id: string;
    brand?: string;
    current_fleet_position?: string;
    purchase_cost_zar?: number;
    km_travelled?: number;
    initial_tread_depth?: number;
    current_tread_depth?: number;
};

// ── Enhanced Types for Analytics ─────────────────────────────────────────────
type DateRange = {
    from: Date;
    to: Date;
};

type KPIMetrics = {
    totalVehicles: number;
    activeVehicles: number;
    vehiclesInWorkshop: number;
    overdueMaintenance: number;
    openJobCards: number;
    openFaults: number;
    fuelEfficiency: number;
    totalTripsThisMonth: number;
    revenueThisMonth: number;
    maintenanceCostThisMonth: number;
    tyreCostPerKm: number;
    averageGapDays: number;
    driverUtilization: number;
};

type TrendData = {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        color: string;
    }[];
};

type DashboardFilters = {
    dateRange: DateRange;
    selectedFleets: string[];
    selectedDrivers: string[];
    metricType: "daily" | "weekly" | "monthly";
};

// ── Main Component ───────────────────────────────────────────────────────────
const Reports = () => {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // Enhanced: Add view mode toggle between reports and analytics
    const [viewMode, setViewMode] = useState<"reports" | "analytics">("reports");

    // Enhanced: Analytics state management
    const [filters, setFilters] = useState<DashboardFilters>({
        dateRange: {
            from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            to: new Date(),
        },
        selectedFleets: [],
        selectedDrivers: [],
        metricType: "monthly",
    });
    const [kpiData, setKpiData] = useState<KPIMetrics | null>(null);
    const [trendData, setTrendData] = useState<TrendData | null>(null);
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [gapDaysDialogOpen, setGapDaysDialogOpen] = useState(false);

    // Enhanced: Auto-refresh analytics every 5 minutes when enabled
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            loadAnalytics();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh, filters]);

    // Enhanced: Load analytics when switching to analytics view or changing filters
    useEffect(() => {
        if (viewMode === "analytics") {
            loadAnalytics();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, filters]);

    // ── Enhanced: Advanced Analytics Engine ───────────────────────────────────
    const loadAnalytics = async () => {
        setIsLoadingAnalytics(true);
        try {
            // Fetch all required data in parallel for performance
            const [
                vehicles,
                jobCards,
                faults,
                maintenanceSchedules,
                trips,
                dieselRecords,
                tyres,
                drivers,
            ] = await Promise.all([
                fetchVehicles(),
                fetchJobCards(),
                fetchFaults(),
                fetchMaintenanceSchedules(),
                fetchTripsWithFleet(),
                fetchDieselRecords(),
                fetchTyres(),
                fetchDrivers(),
            ]);

            // Calculate comprehensive KPIs
            const now = new Date();
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const metrics: KPIMetrics = {
                totalVehicles: vehicles.length,
                activeVehicles: vehicles.filter((v: Record<string, unknown>) => v.active).length,
                vehiclesInWorkshop: vehicles.filter((v: Record<string, unknown>) => v.status === "workshop").length,
                overdueMaintenance: maintenanceSchedules.filter(
                    (s: Record<string, unknown>) => new Date(s.next_due_date as string) < now && s.status !== "completed"
                ).length,
                openJobCards: jobCards.filter((j: JobCard) =>
                    ["open", "in_progress", "pending"].includes(j.status?.toLowerCase() || "")
                ).length,
                openFaults: faults.filter((f: Record<string, unknown>) =>
                    ["open", "reported", "in_progress"].includes((f.status as string)?.toLowerCase() || "")
                ).length,
                fuelEfficiency: calculateFuelEfficiency(dieselRecords),
                totalTripsThisMonth: trips.filter((t: Trip) =>
                    new Date(t.departure_date || t.planned_departure_date || "") >= thisMonth
                ).length,
                revenueThisMonth: trips
                    .filter((t: Trip) => new Date(t.departure_date || t.planned_departure_date || "") >= thisMonth)
                    .reduce((sum: number, t: Trip) => sum + (Number(t.base_revenue) || 0) + (Number(t.additional_revenue) || 0), 0),
                maintenanceCostThisMonth: jobCards
                    .filter((j: JobCard) => j.created_at && new Date(j.created_at) >= thisMonth)
                    .reduce((sum: number, j: JobCard) => sum + (Number(j.estimated_cost) || 0), 0),
                tyreCostPerKm: calculateTyreCostPerKm(tyres),
                averageGapDays: await calculateAverageGapDays(trips),
                driverUtilization: calculateDriverUtilization(drivers, trips),
            };

            setKpiData(metrics);

            // Calculate trends for visualization
            const trends = await calculateTrends(filters.metricType, filters.dateRange);
            setTrendData(trends);
            setLastRefreshed(new Date());

        } catch (error) {
            console.error("Failed to load analytics:", error);
            toast({
                title: "Analytics Error",
                description: "Failed to load analytics data. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingAnalytics(false);
        }
    };

    // ── Enhanced: Analytics Helper Functions ─────────────────────────────────

    /**
     * Calculates fuel efficiency from diesel records
     * @returns km per litre average
     */
    const calculateFuelEfficiency = (records: DieselRecord[]): number => {
        const validRecords = records.filter(
            (r) => (r.litres_filled || 0) > 0 && (r.km_reading || 0) > 0
        );
        if (validRecords.length === 0) return 0;

        const totalLitres = validRecords.reduce((sum, r) => sum + (Number(r.litres_filled) || 0), 0);
        const totalKm = validRecords.reduce((sum, r) => sum + (Number(r.km_reading) || 0), 0);

        return totalLitres > 0 ? totalKm / totalLitres : 0;
    };

    /**
     * Calculates tyre cost efficiency per kilometer
     * @returns cost in Rands per km
     */
    const calculateTyreCostPerKm = (tyres: Tyre[]): number => {
        const tyresWithData = tyres.filter(
            (t) => (t.purchase_cost_zar || 0) > 0 && (t.km_travelled || 0) > 0
        );
        if (tyresWithData.length === 0) return 0;

        const totalCost = tyresWithData.reduce((sum, t) => sum + (Number(t.purchase_cost_zar) || 0), 0);
        const totalKm = tyresWithData.reduce((sum, t) => sum + (Number(t.km_travelled) || 0), 0);

        return totalKm > 0 ? totalCost / totalKm : 0;
    };

    /**
     * Calculates average gap days between trips for all fleets
     * @returns average number of days between trips
     */
    const calculateAverageGapDays = async (trips: Trip[]): Promise<number> => {
        const dated = trips.filter(
            (t) => t.fleet_number && (t.departure_date || t.planned_departure_date) && (t.arrival_date || t.planned_arrival_date)
        );

        const byFleet = new Map<string, Trip[]>();
        for (const t of dated) {
            const fn = t.fleet_number!;
            if (!byFleet.has(fn)) byFleet.set(fn, []);
            byFleet.get(fn)!.push(t);
        }

        let totalGapDays = 0;
        let gapCount = 0;

        for (const fleetTrips of byFleet.values()) {
            fleetTrips.sort((a, b) => {
                const da = new Date(a.departure_date || a.planned_departure_date || "").getTime();
                const db = new Date(b.departure_date || b.planned_departure_date || "").getTime();
                return da - db;
            });

            for (let i = 1; i < fleetTrips.length; i++) {
                const prevEnd = new Date(fleetTrips[i - 1].arrival_date || fleetTrips[i - 1].planned_arrival_date || "");
                const currStart = new Date(fleetTrips[i].departure_date || fleetTrips[i].planned_departure_date || "");
                const gap = Math.max(0, Math.floor((currStart.getTime() - prevEnd.getTime()) / 86400000));
                totalGapDays += gap;
                gapCount++;
            }
        }

        return gapCount > 0 ? totalGapDays / gapCount : 0;
    };

    /**
     * Calculates driver utilization percentage
     * @returns percentage of active drivers currently on trips
     */
    const calculateDriverUtilization = (drivers: Driver[], trips: Trip[]): number => {
        const activeDrivers = drivers.filter((d) => d.status === "active").length;
        const driversOnTrip = new Set(
            trips
                .filter((t) => ["in_progress", "dispatched"].includes(t.status?.toLowerCase() || ""))
                .map((t) => t.driver_name)
        ).size;

        return activeDrivers > 0 ? (driversOnTrip / activeDrivers) * 100 : 0;
    };

    /**
     * Calculates trend data for visualization
     */
    const calculateTrends = async (
        metricType: "daily" | "weekly" | "monthly",
        dateRange: DateRange
    ): Promise<TrendData> => {
        // Generate date labels based on metric type
        const labels: string[] = [];
        const currentDate = new Date(dateRange.from);

        while (currentDate <= dateRange.to) {
            if (metricType === "daily") {
                labels.push(currentDate.toLocaleDateString());
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (metricType === "weekly") {
                labels.push(`Week ${Math.ceil(currentDate.getDate() / 7)}`);
                currentDate.setDate(currentDate.getDate() + 7);
            } else {
                labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }

        // Fetch historical data
        const trips = await fetchTripsWithFleet();
        const maintenanceSchedules = await fetchMaintenanceSchedules(); // Changed from fetchMaintenanceHistory to match actual function name
        const dieselRecords = await fetchDieselRecords();

        // Initialize trend data arrays
        const revenueData = labels.map(() => 0);
        const maintenanceCostData = labels.map(() => 0);
        const fuelConsumptionData = labels.map(() => 0);

        // Process trip data for revenue trends
        trips.forEach((trip) => {
            const tripDate = new Date(trip.departure_date || trip.planned_departure_date || "");
            const index = getDateIndex(tripDate, labels, metricType);
            if (index >= 0) {
                revenueData[index] += (Number(trip.base_revenue) || 0) + (Number(trip.additional_revenue) || 0);
            }
        });

        // Process maintenance cost trends (using maintenance schedules as proxy for cost tracking)
        maintenanceSchedules.forEach((record: Record<string, unknown>) => {
            const completionDate = new Date(record.next_due_date as string);
            const index = getDateIndex(completionDate, labels, metricType);
            if (index >= 0) {
                maintenanceCostData[index] += Number(record.estimated_cost) || 0;
            }
        });

        // Process fuel consumption trends
        dieselRecords.forEach((record) => {
            const recordDate = new Date(record.date || "");
            const index = getDateIndex(recordDate, labels, metricType);
            if (index >= 0) {
                fuelConsumptionData[index] += Number(record.litres_filled) || 0;
            }
        });

        return {
            labels,
            datasets: [
                {
                    label: "Revenue (R)",
                    data: revenueData,
                    color: "#10b981", // Green
                },
                {
                    label: "Maintenance Cost (R)",
                    data: maintenanceCostData,
                    color: "#ef4444", // Red
                },
                {
                    label: "Fuel Consumption (L)",
                    data: fuelConsumptionData,
                    color: "#3b82f6", // Blue
                },
            ],
        };
    };

    /**
     * Helper to get index for date in labels array
     */
    const getDateIndex = (
        date: Date,
        labels: string[],
        metricType: "daily" | "weekly" | "monthly"
    ): number => {
        if (isNaN(date.getTime())) return -1;

        if (metricType === "daily") {
            return labels.indexOf(date.toLocaleDateString());
        } else if (metricType === "weekly") {
            const weekNum = Math.ceil(date.getDate() / 7);
            return labels.indexOf(`Week ${weekNum}`);
        } else {
            const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return labels.indexOf(monthYear);
        }
    };

    // ── Enhanced: KPI Card Component ─────────────────────────────────────────
    const KPICard = ({
        title,
        value,
        icon: Icon,
        trend,
        description,
        color
    }: {
        title: string;
        value: string | number;
        icon: React.ElementType;
        trend?: "up" | "down" | "neutral";
        description?: string;
        color?: string;
    }) => {
        // Static lookup so Tailwind's JIT picks up these classes.
        const accentMatch = (color || "").match(/text-(\w+)-(\d{3})/);
        const accentTone = (accentMatch?.[1] ?? "slate") as
            | "slate" | "blue" | "green" | "yellow" | "red" | "orange"
            | "purple" | "indigo" | "teal" | "cyan";
        const accentMap: Record<string, { bar: string; icon: string }> = {
            slate: { bar: "bg-slate-500/80", icon: "bg-slate-50 dark:bg-slate-900/50" },
            blue: { bar: "bg-blue-500/80", icon: "bg-blue-50 dark:bg-blue-950/40" },
            green: { bar: "bg-emerald-500/80", icon: "bg-emerald-50 dark:bg-emerald-950/40" },
            yellow: { bar: "bg-amber-500/80", icon: "bg-amber-50 dark:bg-amber-950/40" },
            red: { bar: "bg-rose-500/80", icon: "bg-rose-50 dark:bg-rose-950/40" },
            orange: { bar: "bg-orange-500/80", icon: "bg-orange-50 dark:bg-orange-950/40" },
            purple: { bar: "bg-violet-500/80", icon: "bg-violet-50 dark:bg-violet-950/40" },
            indigo: { bar: "bg-indigo-500/80", icon: "bg-indigo-50 dark:bg-indigo-950/40" },
            teal: { bar: "bg-teal-500/80", icon: "bg-teal-50 dark:bg-teal-950/40" },
            cyan: { bar: "bg-cyan-500/80", icon: "bg-cyan-50 dark:bg-cyan-950/40" },
        };
        const accent = accentMap[accentTone];
        if (!accent && import.meta.env.DEV) {
            console.warn(
                `[Reports/KPICard] Unknown accent tone "${accentTone}" derived from color="${color}". Falling back to "slate". Add it to accentMap or pass a supported tone.`,
            );
        }
        const { bar: accentBar, icon: iconBg } = accent ?? accentMap.slate;
        return (
            <Card className="relative overflow-hidden border-slate-200/80 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800">
                <div className={`absolute inset-x-0 top-0 h-[3px] ${accentBar}`} />
                <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0 pt-5">
                    <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            {title}
                        </p>
                    </div>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md ${iconBg}`}>
                        <Icon className={`h-4 w-4 ${color || "text-slate-500"}`} />
                    </div>
                </CardHeader>
                <CardContent className="pb-5">
                    <div className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
                        {typeof value === "number" && title.includes("Revenue")
                            ? `R${value.toLocaleString()}`
                            : typeof value === "number" && title.includes("Efficiency")
                                ? `${value.toFixed(1)} km/L`
                                : typeof value === "number" && title.includes("Cost")
                                    ? `R${value.toFixed(2)}`
                                    : typeof value === "number" && title.includes("Utilization")
                                        ? `${value.toFixed(1)}%`
                                        : value}
                    </div>
                    {trend && description && (
                        <div className="mt-2 flex items-center gap-1.5">
                            {trend === "up" ? (
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            ) : trend === "down" ? (
                                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                            ) : null}
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {description}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    // ── Enhanced: Mini Bar Chart Component for Trends ────────────────────────
    const MiniBarChart = ({ data, maxValue }: { data: number[]; maxValue: number }) => (
        <div className="flex items-end gap-1 h-16">
            {data.map((value, index) => {
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                return (
                    <TooltipProvider key={index}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t cursor-pointer"
                                    style={{ height: `${height}%` }}
                                />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">{value.toLocaleString()}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
        </div>
    );

    // ── Helper: Format large numbers ─────────────────────────────────────────
    const formatNumber = (num: number): string => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    // ── Toggle section collapse state ────────────────────────────────────────
    const toggleSection = (sectionTitle: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionTitle)) {
                next.delete(sectionTitle);
            } else {
                next.add(sectionTitle);
            }
            return next;
        });
    };

    // ── Expand/Collapse all sections in a category ───────────────────────────
    const toggleAllWorkshop = (expand: boolean) => {
        const workshopTitles = sections.filter(s => s.badge === "Workshop").map(s => s.title);
        setExpandedSections(prev => {
            const next = new Set(prev);
            workshopTitles.forEach(title => {
                if (expand) {
                    next.add(title);
                } else {
                    next.delete(title);
                }
            });
            return next;
        });
    };

    const toggleAllOperations = (expand: boolean) => {
        const opsTitles = sections.filter(s => s.badge === "Operations").map(s => s.title);
        setExpandedSections(prev => {
            const next = new Set(prev);
            opsTitles.forEach(title => {
                if (expand) {
                    next.add(title);
                } else {
                    next.delete(title);
                }
            });
            return next;
        });
    };

    // ── Helper: wrap export call with loading & toast ────────────────────────
    const runExport = async (id: string, fmt: "excel" | "pdf", fn: () => Promise<void>) => {
        setLoadingKey(`${id}:${fmt}`);
        try {
            await fn();
            toast({ title: "Export complete", description: "Your file has been downloaded." });
        } catch (err) {
            console.error("Export failed", err);
            toast({ title: "Export failed", description: String(err), variant: "destructive" });
        } finally {
            setLoadingKey(null);
        }
    };

    // ── Data fetchers (called on demand) ─────────────────────────────────────

    const fetchTyres = async (): Promise<Tyre[]> => {
        const { data, error } = await supabase.from("tyres").select("*");
        if (error) throw error;
        return data || [];
    };

    const fetchMaintenanceSchedules = async () => {
        const { data, error } = await supabase
            .from("maintenance_schedules")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("next_due_date") as { data: Record<string, unknown>[] | null; error: unknown };
        if (error) throw error;
        return data || [];
    };

    const fetchMaintenanceHistory = async () => {
        const { data, error } = await supabase
            .from("maintenance_schedule_history")
            .select("*, maintenance_schedules(service_type, vehicle_id)")
            .order("completed_date", { ascending: false }) as { data: Record<string, unknown>[] | null; error: unknown };
        if (error) throw error;
        return data || [];
    };

    const fetchOverdueSchedules = async () => {
        const today = new Date().toISOString().split("T")[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = supabase as any;
        const { data, error } = await client
            .from("maintenance_schedules")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .lt("next_due_date", today)
            .neq("status", "completed")
            .order("next_due_date");
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchFaults = async () => {
        const { data, error } = await supabase
            .from("vehicle_faults")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("reported_date", { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const fetchInspections = async (): Promise<Inspection[]> => {
        const { data, error } = await supabase
            .from("inspections")
            .select("*")
            .order("inspection_date", { ascending: false });
        if (error) throw error;
        return (data || []) as Inspection[];
    };

    const fetchJobCards = async (): Promise<JobCard[]> => {
        const { data, error } = await supabase
            .from("job_cards")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        const cards = (data || []) as JobCard[];
        const vehicleIds = [...new Set(cards.map((c: JobCard) => c.vehicle_id).filter(Boolean))];
        if (vehicleIds.length === 0) return cards;
        const { data: vehicles } = await supabase
            .from("vehicles")
            .select("id, fleet_number, registration_number, make, model")
            .in("id", vehicleIds);
        const vehicleMap = new Map((vehicles || []).map((v: Vehicle) => [v.id, v]));
        return cards.map((c: JobCard) => ({ ...c, vehicles: c.vehicle_id ? vehicleMap.get(c.vehicle_id) || null : null }));
    };

    const fetchTripsWithFleet = async (): Promise<Trip[]> => {
        const { data, error } = await supabase
            .from("trips")
            .select("*, vehicles:fleet_vehicle_id(fleet_number)")
            .order("departure_date", { ascending: true });
        if (error) throw error;
        return (data || []).map((t: Record<string, unknown>) => ({
            ...t,
            fleet_number: (t.vehicles as { fleet_number?: string } | null)?.fleet_number || null,
        })) as Trip[];
    };

    const fetchDrivers = async (): Promise<Driver[]> => {
        const { data, error } = await supabase
            .from("drivers")
            .select("*")
            .order("first_name");
        if (error) throw error;
        return (data || []) as Driver[];
    };

    const fetchDieselRecords = async (): Promise<DieselRecord[]> => {
        const { data, error } = await supabase
            .from("diesel_records")
            .select("*")
            .order("date", { ascending: false });
        if (error) throw error;
        return (data || []) as DieselRecord[];
    };

    const fetchProcurementRequests = async (): Promise<PartsRequest[]> => {
        const { data, error } = await supabase
            .from("parts_requests")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as PartsRequest[];
    };

    const fetchActionLog = async (): Promise<ActionItem[]> => {
        const { data, error } = await supabase
            .from("action_items")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as ActionItem[];
    };

    const fetchVehicles = async () => {
        const { data, error } = await supabase
            .from("vehicles")
            .select("*")
            .order("fleet_number");
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchWorkOrders = async () => {
        const { data, error } = await supabase
            .from("work_orders")
            .select("*, vehicles(fleet_number, registration_number, make, model)")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchIncidents = async () => {
        const { data, error } = await supabase
            .from("incidents")
            .select("*")
            .order("incident_date", { ascending: false });
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchInvoices = async () => {
        const { data, error } = await supabase
            .from("invoices")
            .select("*, trips(trip_number, driver_name, origin, destination)")
            .order("invoice_date", { ascending: false });
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    const fetchFuelBunkers = async () => {
        const { data, error } = await supabase
            .from("fuel_bunkers")
            .select("*")
            .order("name");
        if (error) throw error;
        return (data || []) as Record<string, unknown>[];
    };

    // ── Generic ExcelJS export builder ───────────────────────────────────────
    const exportGenericExcel = async (
        filename: string,
        sheetName: string,
        title: string,
        headers: string[],
        rows: (string | number | null | undefined)[][],
        cellStyler?: (row: (string | number | null | undefined)[], col: number) => Partial<import("exceljs").Font> | undefined,
    ) => {
        const wb = createWorkbook();
        addStyledSheet(wb, sheetName, { title, headers, rows, cellStyler });
        await saveWorkbook(wb, filename);
    };

    const exportGenericPdf = async (
        title: string,
        headers: string[],
        rows: string[][],
        filename: string,
    ) => {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(16);
        doc.text(title, 14, 18);
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26);
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 32,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [242, 246, 252] },
        });
        doc.save(filename);
    };

    // ── Report Sections ──────────────────────────────────────────────────────
    const sections: ReportSection[] = [
        // ── WORKSHOP MANAGEMENT ──────────────────────────────────────────────
        {
            title: "Job Cards",
            icon: ClipboardList,
            description: "Job card records, costs, and status",
            badge: "Workshop",
            reports: [
                {
                    id: "job-cards-all",
                    label: "All Job Cards",
                    description: "Complete job card register with status, priority, and assignment details",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const cards = await fetchJobCards();
                        const headers = ["Job Card #", "Fleet", "Registration", "Status", "Priority", "Assigned To", "Created", "Description"];
                        const rows = cards.map((c: JobCard) => [
                            c.job_number || c.id?.slice(0, 8),
                            c.vehicles?.fleet_number || "-",
                            c.vehicles?.registration_number || "-",
                            c.status || "-",
                            c.priority || "-",
                            c.assignee || "-",
                            c.created_at ? new Date(c.created_at).toLocaleDateString() : "-",
                            c.description || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Job_Cards_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Job Cards", "ALL JOB CARDS REPORT", headers, rows,
                                (row, col) => col === 4 ? statusColours[String(row[3]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL JOB CARDS REPORT", headers, rows.map(r => r.map(String)),
                                `Job_Cards_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Inspections & Faults",
            icon: Search,
            description: "Vehicle inspections and fault tracking reports",
            badge: "Workshop",
            reports: [
                {
                    id: "inspections-all",
                    label: "All Inspections",
                    description: "Inspection history with results and inspector details",
                    formats: ["pdf"],
                    onExport: async () => {
                        const inspections = await fetchInspections();
                        const mapped = inspections.map((ins: Inspection) => ({
                            inspection_number: ins.report_number || ins.id?.slice(0, 8),
                            inspection_date: ins.inspection_date,
                            vehicle_registration: ins.vehicle_name || "-",
                            vehicle_make: "",
                            vehicle_model: "",
                            inspector_name: ins.inspector_name || "-",
                            fault_count: 0,
                            corrective_action_status: ins.maintenance_priority || "-",
                            linked_work_order: "-",
                            inspection_type: ins.vehicle_category || "-",
                            notes: "",
                            status: ins.vehicle_status || (ins.vehicle_safe_to_use ? "safe" : "unsafe"),
                            template_name: "-",
                        }));
                        await generateBatchInspectionPDF(mapped);
                    },
                },
                {
                    id: "faults-all",
                    label: "All Faults",
                    description: "Complete fault register with severity and resolution status",
                    formats: ["pdf"],
                    onExport: async () => {
                        const faults = await fetchFaults();
                        await generateAllFaultsPDF(faults as unknown as Parameters<typeof generateAllFaultsPDF>[0]);
                    },
                },
            ],
        },
        {
            title: "Tyre Management",
            icon: Gauge,
            description: "Fleet tyre inventory, health, and brand analysis",
            badge: "Workshop",
            reports: [
                {
                    id: "tyres-all",
                    label: "All Tyres Report",
                    description: "Every tyre in the fleet with tread depth, condition, and position",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const tyres = await fetchTyres();
                        if (fmt === "excel") await exportAllTyresToExcel(tyres as unknown as Parameters<typeof exportAllTyresToExcel>[0]);
                        else await exportAllTyresToPDF(tyres as unknown as Parameters<typeof exportAllTyresToPDF>[0]);
                    },
                },
                {
                    id: "tyres-brand-summary",
                    label: "Brand Performance Summary",
                    description: "Cost/KM and cost/MM analysis by tyre brand",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const tyres = await fetchTyres();
                        const brandMap = new Map<string, BrandSummary>();
                        tyres.forEach((t: Tyre) => {
                            const brand = t.brand || "Unknown";
                            const existing = brandMap.get(brand);
                            const e = existing || {
                                brand,
                                bayCount: 0,
                                installedCount: 0,
                                totalQty: 0,
                                totalCost: 0,
                                totalKm: 0,
                                totalMmWorn: 0,
                                avgCostPerTyre: 0,
                                avgCostPerKm: null,
                                avgCostPerMm: null
                            };
                            e.totalQty += 1;
                            if (t.current_fleet_position) e.installedCount += 1; else e.bayCount += 1;
                            e.totalCost += t.purchase_cost_zar || 0;
                            e.totalKm += t.km_travelled || 0;
                            if (t.initial_tread_depth && t.current_tread_depth) e.totalMmWorn += Math.max(0, t.initial_tread_depth - t.current_tread_depth);
                            brandMap.set(brand, e);
                        });
                        const brandData = Array.from(brandMap.values()).map((d: BrandSummary) => ({
                            ...d,
                            avgCostPerTyre: d.totalQty > 0 ? d.totalCost / d.totalQty : 0,
                            avgCostPerKm: d.totalKm > 0 ? d.totalCost / d.totalKm : null,
                            avgCostPerMm: d.totalMmWorn > 0 ? d.totalCost / d.totalMmWorn : null,
                        }));
                        const gt = brandData.reduce((acc: BrandSummary, b: BrandSummary) => ({
                            brand: "TOTAL",
                            bayCount: acc.bayCount + b.bayCount,
                            installedCount: acc.installedCount + b.installedCount,
                            totalQty: acc.totalQty + b.totalQty,
                            totalCost: acc.totalCost + b.totalCost,
                            totalKm: acc.totalKm + b.totalKm,
                            totalMmWorn: acc.totalMmWorn + b.totalMmWorn,
                            avgCostPerTyre: 0,
                            avgCostPerKm: null,
                            avgCostPerMm: null,
                        }), { brand: "", bayCount: 0, installedCount: 0, totalQty: 0, totalCost: 0, totalKm: 0, totalMmWorn: 0, avgCostPerTyre: 0, avgCostPerKm: null, avgCostPerMm: null });
                        if (fmt === "excel") await exportBrandSummaryToExcel(brandData, gt);
                        else await exportBrandSummaryToPDF(brandData, gt);
                    },
                },
            ],
        },
        {
            title: "Maintenance Scheduling",
            icon: Calendar,
            description: "Service schedules, history, and overdue alerts",
            badge: "Workshop",
            reports: [
                {
                    id: "maintenance-schedules",
                    label: "Service Schedules",
                    description: "All upcoming and active maintenance schedules",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const schedules = await fetchMaintenanceSchedules();
                        if (fmt === "excel") await exportSchedulesToExcel(schedules as unknown as Parameters<typeof exportSchedulesToExcel>[0]);
                        else await exportSchedulesToPDF(schedules as unknown as Parameters<typeof exportSchedulesToPDF>[0]);
                    },
                },
                {
                    id: "maintenance-history",
                    label: "Maintenance History",
                    description: "Completed maintenance records with costs and duration",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const history = await fetchMaintenanceHistory();
                        if (fmt === "excel") await exportHistoryToExcel(history as unknown as Parameters<typeof exportHistoryToExcel>[0]);
                        else await exportHistoryToPDF(history as unknown as Parameters<typeof exportHistoryToPDF>[0]);
                    },
                },
                {
                    id: "maintenance-overdue",
                    label: "Overdue Alerts",
                    description: "Maintenance tasks past their due date",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const overdue = await fetchOverdueSchedules();
                        if (fmt === "excel") await exportOverdueToExcel(overdue as unknown as Parameters<typeof exportOverdueToExcel>[0]);
                        else await exportOverdueToPDF(overdue as unknown as Parameters<typeof exportOverdueToPDF>[0]);
                    },
                },
            ],
        },
        {
            title: "Procurement & Inventory",
            icon: ShoppingCart,
            description: "Parts requests, stock levels, and restock alerts",
            badge: "Workshop",
            reports: [
                {
                    id: "procurement-requests",
                    label: "All Parts Requests",
                    description: "Complete parts request register with status and cost",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const requests = await fetchProcurementRequests();
                        const headers = ["Request #", "Part Name", "Fleet", "Status", "Priority", "Qty", "Unit Cost", "Total Cost", "Requested By", "Date"];
                        const rows = requests.map((r: PartsRequest) => [
                            r.ir_number || r.id.slice(0, 8),
                            r.part_name || "-",
                            r.make_brand || "-",
                            r.status || "-",
                            r.urgency_level || "-",
                            r.quantity ?? 0,
                            r.unit_price != null ? Number(r.unit_price).toFixed(2) : "0.00",
                            r.total_price != null ? Number(r.total_price).toFixed(2) : "0.00",
                            r.requested_by || "-",
                            r.created_at ? new Date(r.created_at).toLocaleDateString() : "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Parts_Requests_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Parts Requests", "ALL PARTS REQUESTS", headers, rows,
                                (row, col) => col === 4 ? statusColours[String(row[3]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL PARTS REQUESTS", headers, rows.map(r => r.map(String)),
                                `Parts_Requests_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Fleet Vehicles",
            icon: Car,
            description: "Vehicle fleet register and status",
            badge: "Workshop",
            reports: [
                {
                    id: "vehicles-all",
                    label: "Vehicle Fleet Register",
                    description: "Complete vehicle register with type, make, model, and odometer",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const vehicles = await fetchVehicles();
                        const headers = ["Fleet #", "Registration", "Make", "Model", "Type", "Tonnage", "Active", "Odometer"];
                        const rows = vehicles.map((v: Record<string, unknown>) => [
                            (v.fleet_number as string) || "-",
                            (v.registration_number as string) || "-",
                            (v.make as string) || "-",
                            (v.model as string) || "-",
                            (v.vehicle_type as string) || "-",
                            v.tonnage != null ? String(v.tonnage) : "-",
                            v.active ? "Yes" : "No",
                            v.current_odometer != null ? Number(v.current_odometer).toLocaleString() : "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Fleet_Register_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Fleet Register", "FLEET VEHICLE REGISTER", headers, rows,
                            );
                        } else {
                            await exportGenericPdf("FLEET VEHICLE REGISTER", headers, rows.map(r => r.map(String)),
                                `Fleet_Register_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Work Orders",
            icon: Wrench,
            description: "Work order tracking, costs, and completion",
            badge: "Workshop",
            reports: [
                {
                    id: "work-orders-all",
                    label: "All Work Orders",
                    description: "Complete work order register with status, priority, and costs",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const orders = await fetchWorkOrders();
                        const headers = ["WO #", "Title", "Fleet", "Registration", "Status", "Priority", "Technician", "Est. Cost", "Actual Cost", "Created"];
                        const rows = orders.map((o: Record<string, unknown>) => {
                            const v = o.vehicles as Record<string, unknown> | null;
                            return [
                                (o.work_order_number as string) || (o.id as string)?.slice(0, 8),
                                (o.title as string) || "-",
                                (v?.fleet_number as string) || "-",
                                (v?.registration_number as string) || "-",
                                (o.status as string) || "-",
                                (o.priority as string) || "-",
                                (o.assigned_technician as string) || "-",
                                o.estimated_total_cost != null ? Number(o.estimated_total_cost).toFixed(2) : "-",
                                o.actual_total_cost != null ? Number(o.actual_total_cost).toFixed(2) : "-",
                                o.created_at ? new Date(o.created_at as string).toLocaleDateString() : "-",
                            ];
                        });
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Work_Orders_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Work Orders", "ALL WORK ORDERS REPORT", headers, rows,
                                (row, col) => col === 5 ? statusColours[String(row[4]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL WORK ORDERS REPORT", headers, rows.map(r => r.map(String)),
                                `Work_Orders_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Incidents & Accidents",
            icon: AlertTriangle,
            description: "Incident reports, severity, and resolution tracking",
            badge: "Workshop",
            reports: [
                {
                    id: "incidents-all",
                    label: "All Incidents",
                    description: "Complete incident register with type, severity, and status",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const incidents = await fetchIncidents();
                        const headers = ["Incident #", "Date", "Type", "Location", "Severity", "Status", "Driver", "Vehicle", "Reported By"];
                        const rows = incidents.map((i: Record<string, unknown>) => [
                            (i.incident_number as string) || (i.id as string)?.slice(0, 8),
                            i.incident_date ? new Date(i.incident_date as string).toLocaleDateString() : "-",
                            (i.incident_type as string) || "-",
                            (i.location as string) || "-",
                            i.severity_rating != null ? String(i.severity_rating) : "-",
                            (i.status as string) || "-",
                            (i.driver_name as string) || "-",
                            (i.vehicle_number as string) || "-",
                            (i.reported_by as string) || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Incidents_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Incidents", "ALL INCIDENTS REPORT", headers, rows,
                                (row, col) => col === 6 ? statusColours[String(row[5]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ALL INCIDENTS REPORT", headers, rows.map(r => r.map(String)),
                                `Incidents_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Trip Management",
            icon: Truck,
            description: "Trip records, routes, revenue, and cost analysis",
            badge: "Operations",
            reports: [
                {
                    id: "trips-all",
                    label: "All Trips",
                    description: "Complete trip register with route, driver, revenue, and status",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const trips = await fetchTripsWithFleet();
                        const sortedByFleet = [...trips].sort((a, b) => {
                            const fa = a.fleet_number || '';
                            const fb = b.fleet_number || '';
                            if (fa !== fb) return fa.localeCompare(fb);
                            const da = new Date(a.departure_date || a.planned_departure_date || '').getTime() || 0;
                            const db = new Date(b.departure_date || b.planned_departure_date || '').getTime() || 0;
                            return da - db;
                        });
                        const gapMap = new Map<string, number>();
                        const prevArrivalByFleet = new Map<string, Date>();
                        for (const t of sortedByFleet) {
                            const fn = t.fleet_number;
                            const dep = t.departure_date || t.planned_departure_date;
                            const arr = t.arrival_date || t.planned_arrival_date;
                            if (fn && dep) {
                                const prev = prevArrivalByFleet.get(fn);
                                if (prev) {
                                    const gap = Math.max(0, Math.floor((new Date(dep).getTime() - prev.getTime()) / 86400000));
                                    gapMap.set(t.id, gap);
                                }
                            }
                            if (fn && arr) prevArrivalByFleet.set(fn, new Date(arr));
                        }
                        const headers = ["Trip #", "Fleet", "Driver", "Origin", "Destination", "Status", "Start Date", "End Date", "Revenue", "Additional Revenue", "Gap Days", "Actual Cost"];
                        const rows = trips.map((t: Trip) => [
                            t.trip_number || t.id?.slice(0, 8),
                            t.fleet_number || "-",
                            t.driver_name || "-",
                            t.origin || "-",
                            t.destination || "-",
                            t.status || "-",
                            (t.departure_date || t.planned_departure_date) ? new Date((t.departure_date || t.planned_departure_date)!).toLocaleDateString() : "-",
                            (t.arrival_date || t.planned_arrival_date) ? new Date((t.arrival_date || t.planned_arrival_date)!).toLocaleDateString() : "-",
                            Number((Number(t.base_revenue) || 0) + (Number(t.additional_revenue) || 0)).toFixed(2),
                            t.additional_revenue ? Number(t.additional_revenue).toFixed(2) : "0.00",
                            gapMap.has(t.id) ? gapMap.get(t.id)! : "-",
                            t.distance_km != null && t.rate_per_km != null ? Number(Number(t.distance_km) * Number(t.rate_per_km)).toFixed(2) : "-",
                        ]);
                        if (fmt === "excel") {
                            const wb = createWorkbook();
                            addStyledSheet(wb, "Trips", {
                                title: "ALL TRIPS REPORT",
                                headers, rows,
                                cellStyler: (row, col) => col === 6 ? statusColours[String(row[5]).toLowerCase()] : undefined,
                            });
                            const totalRevenue = trips.reduce((s, t) => s + (Number(t.base_revenue) || 0) + (Number(t.additional_revenue) || 0), 0);
                            const totalCost = trips.reduce((s, t) => s + (Number(t.final_invoice_amount) || 0), 0);
                            addSummarySheet(wb, "Summary", {
                                title: "TRIPS SUMMARY",
                                rows: [
                                    ["Total Trips", trips.length],
                                    ["Total Revenue", `$${totalRevenue.toLocaleString()}`],
                                    ["Total Cost", `$${totalCost.toLocaleString()}`],
                                    ["Net Profit", `$${(totalRevenue - totalCost).toLocaleString()}`],
                                ],
                            });
                            await saveWorkbook(wb, `Trips_${new Date().toISOString().split("T")[0]}.xlsx`);
                        } else {
                            await exportGenericPdf("ALL TRIPS REPORT", headers, rows.map(r => r.map(String)),
                                `Trips_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
                {
                    id: "trips-fleet-gap-days",
                    label: "Fleet Gap Days (Advanced)",
                    description: "Filter by vehicle type, route, or driver. Multi-sheet workbook with trends, breakdowns and period comparison.",
                    formats: ["excel"],
                    onExport: async () => {
                        setGapDaysDialogOpen(true);
                    },
                },
            ],
        },
        {
            title: "Driver Management",
            icon: Users,
            description: "Driver records and performance data",
            badge: "Operations",
            reports: [
                {
                    id: "drivers-all",
                    label: "Driver Register",
                    description: "All drivers with licence, contact, and assignment details",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const drivers = await fetchDrivers();
                        const headers = ["Name", "Driver #", "Licence", "Licence Expiry", "Phone", "Status", "Email"];
                        const rows = drivers.map((d: Driver) => [
                            [d.first_name, d.last_name].filter(Boolean).join(" ") || "-",
                            d.driver_number || "-",
                            d.license_number || "-",
                            d.license_expiry ? new Date(d.license_expiry).toLocaleDateString() : "-",
                            d.phone || "-",
                            d.status || "-",
                            d.email || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Drivers_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Drivers", "DRIVER REGISTER", headers, rows,
                                (row, col) => col === 6 ? statusColours[String(row[5]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("DRIVER REGISTER", headers, rows.map(r => r.map(String)),
                                `Drivers_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Diesel Management",
            icon: Fuel,
            description: "Fuel consumption, cost tracking, and efficiency",
            badge: "Operations",
            reports: [
                {
                    id: "diesel-all",
                    label: "All Diesel Records",
                    description: "Complete diesel fill-up register with KM/L and cost analysis",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const records = await fetchDieselRecords();
                        const headers = ["Date", "Fleet", "Driver", "Station", "Litres", "Cost/L", "Total Cost", "KM Reading", "KM/L"];
                        const rows = records.map((r: DieselRecord) => [
                            r.date ? new Date(r.date).toLocaleDateString() : "-",
                            r.fleet_number || "-",
                            r.driver_name || "-",
                            r.fuel_station || "-",
                            r.litres_filled != null ? Number(r.litres_filled).toFixed(1) : "0",
                            r.cost_per_litre != null ? Number(r.cost_per_litre).toFixed(2) : "0.00",
                            r.total_cost != null ? Number(r.total_cost).toFixed(2) : "0.00",
                            r.km_reading ?? "-",
                            r.km_per_litre != null ? Number(r.km_per_litre).toFixed(2) : "-",
                        ]);
                        if (fmt === "excel") {
                            const wb = createWorkbook();
                            addStyledSheet(wb, "Diesel Records", { title: "DIESEL CONSUMPTION REPORT", headers, rows });
                            const totalLitres = records.reduce((s, r) => s + (Number(r.litres_filled) || 0), 0);
                            const totalCost = records.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
                            addSummarySheet(wb, "Summary", {
                                title: "DIESEL SUMMARY",
                                rows: [
                                    ["Total Records", records.length],
                                    ["Total Litres", totalLitres.toLocaleString()],
                                    ["Total Cost", `$${totalCost.toLocaleString()}`],
                                    ["Avg Cost/Litre", totalLitres > 0 ? `$${(totalCost / totalLitres).toFixed(2)}` : "N/A"],
                                ],
                            });
                            await saveWorkbook(wb, `Diesel_Records_${new Date().toISOString().split("T")[0]}.xlsx`);
                        } else {
                            await exportGenericPdf("DIESEL CONSUMPTION REPORT", headers, rows.map(r => r.map(String)),
                                `Diesel_Records_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Action Log",
            icon: ClipboardList,
            description: "Operational action items and follow-ups",
            badge: "Operations",
            reports: [
                {
                    id: "action-log-all",
                    label: "Action Log Export",
                    description: "All action log entries with status, assignee, and due dates",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const entries = await fetchActionLog();
                        const headers = ["Title", "Status", "Priority", "Assigned To", "Due Date", "Created", "Description"];
                        const rows = entries.map((e: ActionItem) => [
                            e.title || "-",
                            e.status || "-",
                            e.priority || "-",
                            e.assigned_to || "-",
                            e.due_date ? new Date(e.due_date).toLocaleDateString() : "-",
                            e.created_at ? new Date(e.created_at).toLocaleDateString() : "-",
                            e.description || "-",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Action_Log_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Action Log", "ACTION LOG REPORT", headers, rows,
                                (row, col) => col === 2 ? statusColours[String(row[1]).toLowerCase()] : undefined,
                            );
                        } else {
                            await exportGenericPdf("ACTION LOG REPORT", headers, rows.map(r => r.map(String)),
                                `Action_Log_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Invoicing",
            icon: Receipt,
            description: "Invoice records, payment tracking, and revenue",
            badge: "Operations",
            reports: [
                {
                    id: "invoices-all",
                    label: "All Invoices",
                    description: "Complete invoice register with amounts, status, and trip details",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const invoices = await fetchInvoices();
                        const headers = ["Invoice #", "Trip #", "Driver", "Route", "Date", "Amount", "Status", "Paid At", "Reference"];
                        const rows = invoices.map((inv: Record<string, unknown>) => {
                            const trip = inv.trips as Record<string, unknown> | null;
                            return [
                                (inv.invoice_number as string) || (inv.id as string)?.slice(0, 8),
                                (trip?.trip_number as string) || "-",
                                (trip?.driver_name as string) || "-",
                                trip ? `${(trip.origin as string) || "?"} → ${(trip.destination as string) || "?"}` : "-",
                                inv.invoice_date ? new Date(inv.invoice_date as string).toLocaleDateString() : "-",
                                inv.amount != null ? Number(inv.amount).toFixed(2) : "0.00",
                                (inv.status as string) || "-",
                                inv.paid_at ? new Date(inv.paid_at as string).toLocaleDateString() : "-",
                                (inv.payment_reference as string) || "-",
                            ];
                        });
                        if (fmt === "excel") {
                            const wb = createWorkbook();
                            addStyledSheet(wb, "Invoices", {
                                title: "ALL INVOICES REPORT",
                                headers, rows,
                                cellStyler: (row, col) => col === 7 ? statusColours[String(row[6]).toLowerCase()] : undefined,
                            });
                            const totalAmount = invoices.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.amount) || 0), 0);
                            const paidCount = invoices.filter((i: Record<string, unknown>) => i.paid_at).length;
                            addSummarySheet(wb, "Summary", {
                                title: "INVOICING SUMMARY",
                                rows: [
                                    ["Total Invoices", invoices.length],
                                    ["Total Amount", `R${totalAmount.toLocaleString()}`],
                                    ["Paid", paidCount],
                                    ["Outstanding", invoices.length - paidCount],
                                ],
                            });
                            await saveWorkbook(wb, `Invoices_${new Date().toISOString().split("T")[0]}.xlsx`);
                        } else {
                            await exportGenericPdf("ALL INVOICES REPORT", headers, rows.map(r => r.map(String)),
                                `Invoices_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
        {
            title: "Fuel Bunkers",
            icon: Fuel,
            description: "Fuel bunker levels, capacity, and stock status",
            badge: "Operations",
            reports: [
                {
                    id: "fuel-bunkers-all",
                    label: "Fuel Bunker Status",
                    description: "All fuel bunkers with capacity, current level, and cost",
                    formats: ["excel", "pdf"],
                    onExport: async (fmt) => {
                        const bunkers = await fetchFuelBunkers();
                        const headers = ["Name", "Fuel Type", "Capacity (L)", "Current Level (L)", "% Full", "Min Alert (L)", "Unit Cost", "Active"];
                        const rows = bunkers.map((b: Record<string, unknown>) => [
                            (b.name as string) || "-",
                            (b.fuel_type as string) || "-",
                            b.capacity_liters != null ? Number(b.capacity_liters).toLocaleString() : "-",
                            b.current_level_liters != null ? Number(b.current_level_liters).toLocaleString() : "-",
                            b.capacity_liters && b.current_level_liters != null ? `${((Number(b.current_level_liters) / Number(b.capacity_liters)) * 100).toFixed(1)}%` : "-",
                            b.min_level_alert != null ? Number(b.min_level_alert).toLocaleString() : "-",
                            b.unit_cost != null ? Number(b.unit_cost).toFixed(2) : "-",
                            b.is_active ? "Yes" : "No",
                        ]);
                        if (fmt === "excel") {
                            await exportGenericExcel(
                                `Fuel_Bunkers_${new Date().toISOString().split("T")[0]}.xlsx`,
                                "Fuel Bunkers", "FUEL BUNKER STATUS REPORT", headers, rows,
                            );
                        } else {
                            await exportGenericPdf("FUEL BUNKER STATUS REPORT", headers, rows.map(r => r.map(String)),
                                `Fuel_Bunkers_${new Date().toISOString().split("T")[0]}.pdf`);
                        }
                    },
                },
            ],
        },
    ];

    // ── Filtering ────────────────────────────────────────────────────────────
    const filteredSections = sections
        .map((section) => ({
            ...section,
            reports: section.reports.filter(
                (r) =>
                    r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    section.title.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
        }))
        .filter((s) => s.reports.length > 0);

    const workshopSections = filteredSections.filter((s) => s.badge === "Workshop");
    const operationsSections = filteredSections.filter((s) => s.badge === "Operations");

    const totalReports = sections.reduce((s, sec) => s + sec.reports.length, 0);

    const workshopExpandedCount = workshopSections.filter(s => expandedSections.has(s.title)).length;
    const operationsExpandedCount = operationsSections.filter(s => expandedSections.has(s.title)).length;

    return (
        <Layout>
            <div className="space-y-6">
                {/* Page header — refined hero card */}
                <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-900/40">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Fleet Intelligence
                                </p>
                                <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                                    Reports &amp; Analytics Centre
                                </h1>
                                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                    Advanced reporting, analytics, and data export
                                    <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {totalReports} reports
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            {viewMode === "analytics" && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAutoRefresh(!autoRefresh)}
                                        className="h-9 gap-2"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin text-emerald-500" : "text-slate-500"}`} />
                                        <span className="text-xs">{autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}</span>
                                    </Button>
                                    {lastRefreshed && (
                                        <span className="hidden text-[11px] text-slate-500 sm:inline dark:text-slate-400">
                                            Updated {lastRefreshed.toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    placeholder="Search reports…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-9 border-slate-200 bg-white pl-9 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* View Mode Toggle between Reports and Analytics */}
                <Tabs
                    value={viewMode}
                    onValueChange={(v) => setViewMode(v as "reports" | "analytics")}
                    className="w-full"
                >
                    <TabsList className="inline-flex h-10 rounded-lg bg-slate-100/80 p-1 dark:bg-slate-900/50">
                        <TabsTrigger
                            value="reports"
                            className="gap-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                        >
                            <FileText className="h-4 w-4" />
                            Reports
                        </TabsTrigger>
                        <TabsTrigger
                            value="analytics"
                            className="gap-2 rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                        >
                            <BarChart3 className="h-4 w-4" />
                            Analytics Dashboard
                        </TabsTrigger>
                    </TabsList>

                    {/* Enhanced: Analytics Dashboard Content */}
                    <TabsContent value="analytics" className="mt-6 space-y-6">
                        {isLoadingAnalytics ? (
                            <div className="flex items-center justify-center rounded-xl border border-slate-200/80 bg-white py-20 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            </div>
                        ) : kpiData ? (
                            <>
                                {/* KPI Grid - Primary Metrics */}
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <KPICard
                                        title="Active Fleet"
                                        value={`${kpiData.activeVehicles}/${kpiData.totalVehicles} Active`}
                                        icon={Car}
                                        trend="up"
                                        description="Fleet operational status"
                                        color="text-blue-500"
                                    />
                                    <KPICard
                                        title="Revenue This Month"
                                        value={kpiData.revenueThisMonth}
                                        icon={Receipt}
                                        trend="up"
                                        description="+12.5% vs last month"
                                        color="text-green-500"
                                    />
                                    <KPICard
                                        title="Fuel Efficiency"
                                        value={kpiData.fuelEfficiency}
                                        icon={Fuel}
                                        trend="down"
                                        description="-0.3 km/L from avg"
                                        color="text-yellow-500"
                                    />
                                    <KPICard
                                        title="Maintenance Cost"
                                        value={kpiData.maintenanceCostThisMonth}
                                        icon={Wrench}
                                        trend="down"
                                        description="-8.2% vs last month"
                                        color="text-red-500"
                                    />
                                </div>

                                {/* KPI Grid - Secondary Metrics */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <KPICard
                                        title="Overdue Maintenance"
                                        value={kpiData.overdueMaintenance}
                                        icon={AlertTriangle}
                                        trend={kpiData.overdueMaintenance > 5 ? "up" : "down"}
                                        description={`${kpiData.overdueMaintenance} vehicles overdue`}
                                        color="text-orange-500"
                                    />
                                    <KPICard
                                        title="Open Job Cards"
                                        value={kpiData.openJobCards}
                                        icon={ClipboardList}
                                        trend="neutral"
                                        description="Workshop workload"
                                        color="text-purple-500"
                                    />
                                    <KPICard
                                        title="Open Faults"
                                        value={kpiData.openFaults}
                                        icon={Zap}
                                        trend={kpiData.openFaults > 10 ? "up" : "down"}
                                        description="Pending resolution"
                                        color="text-red-500"
                                    />
                                </div>

                                {/* KPI Grid - Tertiary Metrics */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <KPICard
                                        title="Tyre Cost per KM"
                                        value={kpiData.tyreCostPerKm}
                                        icon={Gauge}
                                        trend="down"
                                        description="Tyre cost efficiency"
                                        color="text-indigo-500"
                                    />
                                    <KPICard
                                        title="Avg Gap Days"
                                        value={kpiData.averageGapDays}
                                        icon={Calendar}
                                        trend={kpiData.averageGapDays > 3 ? "up" : "down"}
                                        description="Between trips"
                                        color="text-teal-500"
                                    />
                                    <KPICard
                                        title="Driver Utilization"
                                        value={kpiData.driverUtilization}
                                        icon={Users}
                                        trend="up"
                                        description="Of active drivers"
                                        color="text-cyan-500"
                                    />
                                    <KPICard
                                        title="Vehicles in Workshop"
                                        value={`${kpiData.vehiclesInWorkshop} vehicles`}
                                        icon={Wrench}
                                        trend="neutral"
                                        description="Downtime indicator"
                                        color="text-slate-500"
                                    />
                                </div>

                                {/* Enhanced: Trends Visualization */}
                                {trendData && (
                                    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
                                        <CardHeader className="border-b border-slate-200/70 dark:border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-base">Performance Trends</CardTitle>
                                                    <CardDescription>
                                                        Revenue, maintenance costs, and fuel consumption over time
                                                    </CardDescription>
                                                </div>
                                                <Select
                                                    value={filters.metricType}
                                                    onValueChange={(value: "daily" | "weekly" | "monthly") =>
                                                        setFilters({ ...filters, metricType: value })
                                                    }
                                                >
                                                    <SelectTrigger className="w-32">
                                                        <SelectValue placeholder="Metric" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="daily">Daily</SelectItem>
                                                        <SelectItem value="weekly">Weekly</SelectItem>
                                                        <SelectItem value="monthly">Monthly</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-6">
                                                {trendData.datasets.map((dataset, idx) => (
                                                    <div key={idx} className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium flex items-center gap-2">
                                                                <div
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: dataset.color }}
                                                                />
                                                                {dataset.label}
                                                            </span>
                                                            <span className="text-sm text-muted-foreground">
                                                                Total: {formatNumber(dataset.data.reduce((a, b) => a + b, 0))}
                                                            </span>
                                                        </div>
                                                        <MiniBarChart
                                                            data={dataset.data}
                                                            maxValue={Math.max(...dataset.data)}
                                                        />
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span>{trendData.labels[0]}</span>
                                                            <span>{trendData.labels[trendData.labels.length - 1]}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Enhanced: Quick Actions */}
                                <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
                                    <CardHeader className="border-b border-slate-200/70 dark:border-slate-800">
                                        <CardTitle className="text-base">Quick Exports</CardTitle>
                                        <CardDescription>
                                            Frequently used reports for instant download
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-5">
                                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                            {[
                                                {
                                                    label: "Fleet Register", icon: Car, onClick: () => {
                                                        sections.find(s => s.title === "Fleet Vehicles")?.reports[0].onExport("excel");
                                                    }
                                                },
                                                {
                                                    label: "Trip Summary", icon: Truck, onClick: () => {
                                                        sections.find(s => s.title === "Trip Management")?.reports[0].onExport("excel");
                                                    }
                                                },
                                                {
                                                    label: "Maintenance Report", icon: Wrench, onClick: () => {
                                                        sections.find(s => s.title === "Maintenance Scheduling")?.reports[0].onExport("excel");
                                                    }
                                                },
                                                {
                                                    label: "Driver Roster", icon: Users, onClick: () => {
                                                        sections.find(s => s.title === "Driver Management")?.reports[0].onExport("excel");
                                                    }
                                                },
                                            ].map((action, idx) => (
                                                <Button
                                                    key={idx}
                                                    variant="outline"
                                                    className="group h-auto flex-col gap-2 border-slate-200 py-4 hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-900/40"
                                                    onClick={action.onClick}
                                                >
                                                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition-colors group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700">
                                                        <action.icon className="h-4 w-4" />
                                                    </span>
                                                    <span className="text-xs font-medium">{action.label}</span>
                                                </Button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/40 py-16 text-center dark:border-slate-700 dark:bg-slate-900/20">
                                <BarChart3 className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                                <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                                    No analytics available
                                </p>
                                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                                    Load data to view performance metrics
                                </p>
                                <Button variant="outline" onClick={loadAnalytics}>
                                    Load Analytics
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    {/* Original Reports Content - Fully Preserved */}
                    <TabsContent value="reports" className="mt-6 space-y-6">
                        {/* Workshop Management */}
                        {workshopSections.length > 0 && (
                            <ReportCategoryCard
                                title="Workshop Management"
                                description="Maintenance, faults, parts, inspections and tyre operations"
                                icon={Wrench}
                                accent="amber"
                                count={workshopSections.reduce((s, sec) => s + sec.reports.length, 0)}
                                allExpanded={workshopExpandedCount >= workshopSections.length}
                                onToggleAll={() => toggleAllWorkshop(workshopExpandedCount < workshopSections.length)}
                            >
                                {workshopSections.map((section, idx) => {
                                    const Icon = section.icon;
                                    const isExpanded = expandedSections.has(section.title);
                                    return (
                                        <div
                                            key={section.title}
                                            className={idx === 0 ? "" : "border-t border-slate-200/70 dark:border-slate-800"}
                                        >
                                            <button
                                                onClick={() => toggleSection(section.title)}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/30"
                                            >
                                                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                                    <Icon className="h-3.5 w-3.5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        {section.title}
                                                    </span>
                                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {section.description}
                                                    </span>
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="h-5 border-slate-200 text-[10px] tabular-nums dark:border-slate-700"
                                                >
                                                    {section.reports.length}
                                                </Badge>
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                                )}
                                            </button>
                                            {isExpanded && (
                                                <div className="space-y-1.5 bg-slate-50/40 px-4 pb-4 pt-1 dark:bg-slate-900/20">
                                                    {section.reports.map((report) => (
                                                        <ReportRow
                                                            key={report.id}
                                                            report={report}
                                                            loadingKey={loadingKey}
                                                            onExport={(fmt) => runExport(report.id, fmt, () => report.onExport(fmt))}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </ReportCategoryCard>
                        )}

                        {/* Operations */}
                        {operationsSections.length > 0 && (
                            <ReportCategoryCard
                                title="Operations"
                                description="Trips, drivers, fuel, procurement and analytics"
                                icon={Truck}
                                accent="blue"
                                count={operationsSections.reduce((s, sec) => s + sec.reports.length, 0)}
                                allExpanded={operationsExpandedCount >= operationsSections.length}
                                onToggleAll={() => toggleAllOperations(operationsExpandedCount < operationsSections.length)}
                            >
                                {operationsSections.map((section, idx) => {
                                    const Icon = section.icon;
                                    const isExpanded = expandedSections.has(section.title);
                                    return (
                                        <div
                                            key={section.title}
                                            className={idx === 0 ? "" : "border-t border-slate-200/70 dark:border-slate-800"}
                                        >
                                            <button
                                                onClick={() => toggleSection(section.title)}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/30"
                                            >
                                                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                                    <Icon className="h-3.5 w-3.5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        {section.title}
                                                    </span>
                                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {section.description}
                                                    </span>
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="h-5 border-slate-200 text-[10px] tabular-nums dark:border-slate-700"
                                                >
                                                    {section.reports.length}
                                                </Badge>
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                                )}
                                            </button>
                                            {isExpanded && (
                                                <div className="space-y-1.5 bg-slate-50/40 px-4 pb-4 pt-1 dark:bg-slate-900/20">
                                                    {section.reports.map((report) => (
                                                        <ReportRow
                                                            key={report.id}
                                                            report={report}
                                                            loadingKey={loadingKey}
                                                            onExport={(fmt) => runExport(report.id, fmt, () => report.onExport(fmt))}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </ReportCategoryCard>
                        )}

                        {filteredSections.length === 0 && (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/40 py-16 dark:border-slate-700 dark:bg-slate-900/20">
                                <FileText className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                                <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                                    No reports found
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Try a different search term
                                </p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
            <FleetGapDaysReportDialog
                open={gapDaysDialogOpen}
                onOpenChange={setGapDaysDialogOpen}
            />
        </Layout>
    );
};

// ── Category Card (Workshop / Operations) ───────────────────────────────────
const ReportCategoryCard = ({
    title,
    description,
    icon: Icon,
    accent,
    count,
    allExpanded,
    onToggleAll,
    children,
}: {
    title: string;
    description: string;
    icon: React.ElementType;
    accent: "amber" | "blue";
    count: number;
    allExpanded: boolean;
    onToggleAll: () => void;
    children: React.ReactNode;
}) => {
    const accentMap: Record<string, { bar: string; chip: string; iconBg: string }> = {
        amber: {
            bar: "bg-amber-500/80",
            chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
            iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
        },
        blue: {
            bar: "bg-blue-500/80",
            chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
            iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
        },
    };
    const a = accentMap[accent];
    return (
        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className={`absolute inset-x-0 top-0 h-[3px] ${a.bar}`} />
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-md ${a.iconBg}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {title}
                            </h2>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${a.chip}`}>
                                {count}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {description}
                        </p>
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    onClick={onToggleAll}
                >
                    {allExpanded ? (
                        <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            Collapse All
                        </>
                    ) : (
                        <>
                            <ChevronRight className="h-3.5 w-3.5" />
                            Expand All
                        </>
                    )}
                </Button>
            </div>
            <div>{children}</div>
        </div>
    );
};

// ── Report Row Component ────────────────────────────────────────────────────
const ReportRow = ({
    report,
    loadingKey,
    onExport,
}: {
    report: ReportItem;
    loadingKey: string | null;
    onExport: (fmt: "excel" | "pdf") => void;
}) => {
    const excelLoading = loadingKey === `${report.id}:excel`;
    const pdfLoading = loadingKey === `${report.id}:pdf`;
    const anyLoading = excelLoading || pdfLoading;
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700 dark:hover:bg-slate-900/40">
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {report.label}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {report.description}
                </p>
            </div>
            <div className="flex flex-shrink-0 gap-1.5">
                {report.formats.includes("excel") && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-emerald-200 bg-emerald-50/60 text-xs text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                        disabled={anyLoading}
                        onClick={() => onExport("excel")}
                    >
                        {excelLoading ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                        )}
                        Excel
                    </Button>
                )}
                {report.formats.includes("pdf") && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-rose-200 bg-rose-50/60 text-xs text-rose-800 hover:bg-rose-100 hover:text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                        disabled={anyLoading}
                        onClick={() => onExport("pdf")}
                    >
                        {pdfLoading ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <FileText className="h-3.5 w-3.5" />
                        )}
                        PDF
                    </Button>
                )}
            </div>
        </div>
    );
};

export default Reports;