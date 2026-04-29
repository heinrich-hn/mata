import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
    addStyledSheet,
    addSummarySheet,
    createWorkbook,
    saveWorkbook,
} from "@/utils/excelStyles";
import {
    generateReportPDF,
    type ReportColumn,
    type ReportSection,
    type ReportSpec,
} from "@/lib/tripReportExports";
import {
    CalendarRange,
    Download,
    FileText,
    Filter,
    Loader2,
    RefreshCw,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type Trip = {
    id: string;
    trip_number?: string | null;
    fleet_vehicle_id?: string | null;
    fleet_number?: string | null;
    driver_name?: string | null;
    origin?: string | null;
    destination?: string | null;
    status?: string | null;
    departure_date?: string | null;
    planned_departure_date?: string | null;
    arrival_date?: string | null;
    planned_arrival_date?: string | null;
    distance_km?: number | null;
    base_revenue?: number | null;
    additional_revenue?: number | null;
    final_invoice_amount?: number | null;
    vehicle_type?: string | null;
};

type GapRow = {
    fleet: string;
    vehicleType: string;
    driver: string;
    route: string;
    origin: string;
    destination: string;
    tripNumber: string;
    prevTripNumber: string;
    prevArrival: Date;
    nextDeparture: Date;
    gapDays: number;
    distanceKm: number;
    revenueUSD: number;
};

type FilterState = {
    from: string;
    to: string;
    vehicleTypes: Set<string>;
    routes: Set<string>;
    drivers: Set<string>;
    fleets: Set<string>;
};

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const todayISO = () => new Date().toISOString().split("T")[0];
const monthsAgoISO = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d.toISOString().split("T")[0];
};

const safeNum = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

const fmtDate = (d: Date) => d.toLocaleDateString();

const weekKey = (d: Date) => {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// ── Stat helpers ────────────────────────────────────────────────────────────
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const stdDev = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
};
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// ── Component ───────────────────────────────────────────────────────────────
export const FleetGapDaysReportDialog = ({ open, onOpenChange }: Props) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [allTrips, setAllTrips] = useState<Trip[]>([]);
    const [filters, setFilters] = useState<FilterState>({
        from: monthsAgoISO(3),
        to: todayISO(),
        vehicleTypes: new Set(),
        routes: new Set(),
        drivers: new Set(),
        fleets: new Set(),
    });

    // ── Fetch trips + vehicle metadata once when opened ─────────────────────
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("trips")
                    .select("*, vehicles:fleet_vehicle_id(fleet_number, vehicle_type)")
                    .order("departure_date", { ascending: true });
                if (error) throw error;
                const trips: Trip[] = (data || []).map((t: Record<string, unknown>) => {
                    const v = t.vehicles as { fleet_number?: string; vehicle_type?: string } | null;
                    return {
                        ...(t as Trip),
                        fleet_number: v?.fleet_number || null,
                        vehicle_type: v?.vehicle_type || null,
                    };
                });
                if (!cancelled) setAllTrips(trips);
            } catch (err) {
                console.error(err);
                if (!cancelled)
                    toast({
                        title: "Failed to load trips",
                        description: err instanceof Error ? err.message : "Unknown error",
                        variant: "destructive",
                    });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, toast]);

    // ── Derive option lists from loaded trips ───────────────────────────────
    const options = useMemo(() => {
        const vts = new Set<string>();
        const drs = new Set<string>();
        const fls = new Set<string>();
        const rts = new Set<string>();
        for (const t of allTrips) {
            if (t.vehicle_type) vts.add(t.vehicle_type);
            if (t.driver_name) drs.add(t.driver_name);
            if (t.fleet_number) fls.add(t.fleet_number);
            if (t.origin && t.destination) rts.add(`${t.origin} → ${t.destination}`);
        }
        return {
            vehicleTypes: [...vts].sort(),
            drivers: [...drs].sort(),
            fleets: [...fls].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            routes: [...rts].sort(),
        };
    }, [allTrips]);

    // ── Build filtered gap rows ─────────────────────────────────────────────
    const gapRows = useMemo<GapRow[]>(() => {
        const fromDate = filters.from ? new Date(filters.from) : null;
        const toDate = filters.to ? new Date(`${filters.to}T23:59:59`) : null;

        const trips = allTrips.filter((t) => {
            if (!t.fleet_number) return false;
            if (filters.vehicleTypes.size && !filters.vehicleTypes.has(t.vehicle_type || ""))
                return false;
            if (filters.drivers.size && !filters.drivers.has(t.driver_name || "")) return false;
            if (filters.fleets.size && !filters.fleets.has(t.fleet_number || "")) return false;
            if (filters.routes.size) {
                const r = `${t.origin || ""} → ${t.destination || ""}`;
                if (!filters.routes.has(r)) return false;
            }
            const dep = t.departure_date || t.planned_departure_date;
            if (!dep) return false;
            const depD = new Date(dep);
            if (fromDate && depD < fromDate) return false;
            if (toDate && depD > toDate) return false;
            return true;
        });

        const byFleet = new Map<string, Trip[]>();
        for (const t of trips) {
            const fn = t.fleet_number!;
            if (!byFleet.has(fn)) byFleet.set(fn, []);
            byFleet.get(fn)!.push(t);
        }
        const rows: GapRow[] = [];
        for (const [fleet, list] of byFleet.entries()) {
            list.sort((a, b) => {
                const da = new Date(a.departure_date || a.planned_departure_date || 0).getTime();
                const db = new Date(b.departure_date || b.planned_departure_date || 0).getTime();
                return da - db;
            });
            for (let i = 1; i < list.length; i++) {
                const prev = list[i - 1];
                const curr = list[i];
                const prevEnd = new Date(prev.arrival_date || prev.planned_arrival_date || 0);
                const currStart = new Date(
                    curr.departure_date || curr.planned_departure_date || 0,
                );
                if (Number.isNaN(prevEnd.getTime()) || Number.isNaN(currStart.getTime()))
                    continue;
                const gap = Math.max(
                    0,
                    Math.floor((currStart.getTime() - prevEnd.getTime()) / 86400000),
                );
                rows.push({
                    fleet,
                    vehicleType: curr.vehicle_type || prev.vehicle_type || "Unknown",
                    driver: curr.driver_name || "—",
                    route: `${curr.origin || "—"} → ${curr.destination || "—"}`,
                    origin: curr.origin || "—",
                    destination: curr.destination || "—",
                    tripNumber: curr.trip_number || curr.id.slice(0, 8),
                    prevTripNumber: prev.trip_number || prev.id.slice(0, 8),
                    prevArrival: prevEnd,
                    nextDeparture: currStart,
                    gapDays: gap,
                    distanceKm: safeNum(curr.distance_km),
                    revenueUSD:
                        safeNum(curr.final_invoice_amount) ||
                        safeNum(curr.base_revenue) + safeNum(curr.additional_revenue),
                });
            }
        }
        return rows;
    }, [allTrips, filters]);

    // ── Live preview KPIs ───────────────────────────────────────────────────
    const kpi = useMemo(() => {
        const gaps = gapRows.map((r) => r.gapDays);
        const fleets = new Set(gapRows.map((r) => r.fleet));
        const idle = gapRows.filter((r) => r.gapDays > 0).length;
        const longGaps = gapRows.filter((r) => r.gapDays >= 7).length;
        return {
            measured: gapRows.length,
            fleets: fleets.size,
            totalGapDays: gaps.reduce((a, b) => a + b, 0),
            avg: round(mean(gaps)),
            median: round(median(gaps)),
            stdDev: round(stdDev(gaps)),
            max: gaps.length ? Math.max(...gaps) : 0,
            min: gaps.length ? Math.min(...gaps) : 0,
            idleEvents: idle,
            longIdleEvents: longGaps,
            utilisationPct:
                gapRows.length > 0
                    ? round(((gapRows.length - idle) / gapRows.length) * 100)
                    : 0,
        };
    }, [gapRows]);

    const toggleSet = (key: keyof FilterState, value: string) => {
        setFilters((prev) => {
            const next = new Set(prev[key] as Set<string>);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return { ...prev, [key]: next };
        });
    };

    const clearAll = () =>
        setFilters((p) => ({
            ...p,
            vehicleTypes: new Set(),
            routes: new Set(),
            drivers: new Set(),
            fleets: new Set(),
        }));

    // ── Excel export with rich analytics ────────────────────────────────────
    const handleExport = async () => {
        if (gapRows.length === 0) {
            toast({
                title: "Nothing to export",
                description: "Adjust filters — current selection has no gap data.",
                variant: "destructive",
            });
            return;
        }
        setExporting(true);
        try {
            const wb = createWorkbook();

            // 1) Executive Summary
            addSummarySheet(wb, "Executive Summary", {
                title: "FLEET GAP DAYS — EXECUTIVE SUMMARY",
                subtitle: `Period ${filters.from} → ${filters.to}`,
                rows: [
                    ["Reporting Period", `${filters.from} → ${filters.to}`],
                    ["Fleets Analysed", kpi.fleets],
                    ["Gap Events Measured", kpi.measured],
                    ["Idle Events (gap > 0)", kpi.idleEvents],
                    ["Extended Idle Events (≥ 7 days)", kpi.longIdleEvents],
                    ["Total Gap Days", kpi.totalGapDays],
                    ["Average Gap (days)", kpi.avg],
                    ["Median Gap (days)", kpi.median],
                    ["Std. Deviation (days)", kpi.stdDev],
                    ["Maximum Gap (days)", kpi.max],
                    ["Minimum Gap (days)", kpi.min],
                    ["Effective Utilisation %", `${kpi.utilisationPct}%`],
                ],
            });

            // 2) Filters Applied
            addSummarySheet(wb, "Filters Applied", {
                title: "FILTERS APPLIED TO THIS REPORT",
                rows: [
                    ["Date From", filters.from],
                    ["Date To", filters.to],
                    [
                        "Vehicle Types",
                        filters.vehicleTypes.size ? [...filters.vehicleTypes].join(", ") : "All",
                    ],
                    ["Fleets", filters.fleets.size ? [...filters.fleets].join(", ") : "All"],
                    ["Drivers", filters.drivers.size ? [...filters.drivers].join(", ") : "All"],
                    ["Routes", filters.routes.size ? [...filters.routes].join(", ") : "All"],
                ],
            });

            // 3) Gap Details
            addStyledSheet(wb, "Gap Details", {
                title: "FLEET GAP DAYS — DETAIL",
                subtitle: "Each gap = days between previous arrival and next departure",
                headers: [
                    "Fleet",
                    "Vehicle Type",
                    "Driver",
                    "Prev Trip #",
                    "Prev Arrival",
                    "Next Trip #",
                    "Next Departure",
                    "Route",
                    "Gap Days",
                    "Distance (km)",
                    "Revenue (USD)",
                ],
                rows: gapRows.map((r) => [
                    r.fleet,
                    r.vehicleType,
                    r.driver,
                    r.prevTripNumber,
                    fmtDate(r.prevArrival),
                    r.tripNumber,
                    fmtDate(r.nextDeparture),
                    r.route,
                    r.gapDays,
                    round(r.distanceKm, 0),
                    round(r.revenueUSD, 2),
                ]),
            });

            // Helper to compute breakdown rows
            const buildBreakdown = (
                grouper: (r: GapRow) => string,
            ): (string | number)[][] => {
                const map = new Map<string, GapRow[]>();
                for (const r of gapRows) {
                    const k = grouper(r) || "—";
                    if (!map.has(k)) map.set(k, []);
                    map.get(k)!.push(r);
                }
                const rows = [...map.entries()].map(([k, arr]) => {
                    const gaps = arr.map((r) => r.gapDays);
                    const total = gaps.reduce((a, b) => a + b, 0);
                    const idle = arr.filter((r) => r.gapDays > 0).length;
                    const utilisation =
                        arr.length > 0 ? round(((arr.length - idle) / arr.length) * 100) : 0;
                    return [
                        k,
                        arr.length,
                        total,
                        round(mean(gaps)),
                        round(median(gaps)),
                        round(stdDev(gaps)),
                        gaps.length ? Math.max(...gaps) : 0,
                        idle,
                        `${utilisation}%`,
                    ];
                });
                rows.sort((a, b) => Number(b[2]) - Number(a[2]));
                return rows;
            };

            const breakdownHeaders = [
                "Group",
                "Gap Events",
                "Total Gap Days",
                "Avg Gap",
                "Median Gap",
                "Std. Dev",
                "Max Gap",
                "Idle Events",
                "Utilisation %",
            ];

            // 4) By Fleet
            addStyledSheet(wb, "By Fleet", {
                title: "PERFORMANCE BREAKDOWN — BY FLEET",
                headers: ["Fleet", ...breakdownHeaders.slice(1)],
                rows: buildBreakdown((r) => r.fleet),
            });

            // 5) By Vehicle Type
            addStyledSheet(wb, "By Vehicle Type", {
                title: "PERFORMANCE BREAKDOWN — BY VEHICLE TYPE",
                headers: ["Vehicle Type", ...breakdownHeaders.slice(1)],
                rows: buildBreakdown((r) => r.vehicleType),
            });

            // 6) By Driver
            addStyledSheet(wb, "By Driver", {
                title: "PERFORMANCE BREAKDOWN — BY DRIVER",
                headers: ["Driver", ...breakdownHeaders.slice(1)],
                rows: buildBreakdown((r) => r.driver),
            });

            // 7) By Route
            addStyledSheet(wb, "By Route", {
                title: "PERFORMANCE BREAKDOWN — BY ROUTE",
                headers: ["Route", ...breakdownHeaders.slice(1)],
                rows: buildBreakdown((r) => r.route),
            });

            // 8) Weekly Trend with WoW change
            const weeklyMap = new Map<string, { totalGap: number; count: number }>();
            for (const r of gapRows) {
                const k = weekKey(r.nextDeparture);
                const e = weeklyMap.get(k) || { totalGap: 0, count: 0 };
                e.totalGap += r.gapDays;
                e.count += 1;
                weeklyMap.set(k, e);
            }
            const weeklySorted = [...weeklyMap.entries()].sort(([a], [b]) => a.localeCompare(b));
            const weeklyRows: (string | number)[][] = weeklySorted.map(([wk, v], idx) => {
                const avg = v.count > 0 ? v.totalGap / v.count : 0;
                let wow: string | number = "—";
                if (idx > 0) {
                    const prev = weeklySorted[idx - 1][1];
                    const prevAvg = prev.count > 0 ? prev.totalGap / prev.count : 0;
                    if (prevAvg > 0) wow = `${round(((avg - prevAvg) / prevAvg) * 100)}%`;
                }
                return [wk, v.count, v.totalGap, round(avg), wow];
            });
            addStyledSheet(wb, "Weekly Trend", {
                title: "GAP DAYS — WEEKLY TREND",
                subtitle: "Avg gap per week with week-over-week change",
                headers: ["Week", "Gap Events", "Total Gap Days", "Avg Gap", "WoW Δ"],
                rows: weeklyRows,
            });

            // 9) Monthly Trend with MoM change
            const monthlyMap = new Map<string, { totalGap: number; count: number }>();
            for (const r of gapRows) {
                const k = monthKey(r.nextDeparture);
                const e = monthlyMap.get(k) || { totalGap: 0, count: 0 };
                e.totalGap += r.gapDays;
                e.count += 1;
                monthlyMap.set(k, e);
            }
            const monthlySorted = [...monthlyMap.entries()].sort(([a], [b]) =>
                a.localeCompare(b),
            );
            const monthlyRows: (string | number)[][] = monthlySorted.map(([mk, v], idx) => {
                const avg = v.count > 0 ? v.totalGap / v.count : 0;
                let mom: string | number = "—";
                if (idx > 0) {
                    const prev = monthlySorted[idx - 1][1];
                    const prevAvg = prev.count > 0 ? prev.totalGap / prev.count : 0;
                    if (prevAvg > 0) mom = `${round(((avg - prevAvg) / prevAvg) * 100)}%`;
                }
                return [mk, v.count, v.totalGap, round(avg), mom];
            });
            addStyledSheet(wb, "Monthly Trend", {
                title: "GAP DAYS — MONTHLY TREND",
                subtitle: "Avg gap per month with month-over-month change",
                headers: ["Month", "Gap Events", "Total Gap Days", "Avg Gap", "MoM Δ"],
                rows: monthlyRows,
            });

            // 10) Period Comparison: split current period in half (recent vs prior)
            if (gapRows.length >= 2) {
                const sortedByDate = [...gapRows].sort(
                    (a, b) => a.nextDeparture.getTime() - b.nextDeparture.getTime(),
                );
                const mid = Math.floor(sortedByDate.length / 2);
                const prior = sortedByDate.slice(0, mid);
                const recent = sortedByDate.slice(mid);

                const stat = (arr: GapRow[]) => {
                    const gaps = arr.map((r) => r.gapDays);
                    const total = gaps.reduce((a, b) => a + b, 0);
                    const idle = arr.filter((r) => r.gapDays > 0).length;
                    return {
                        events: arr.length,
                        total,
                        avg: round(mean(gaps)),
                        median: round(median(gaps)),
                        max: gaps.length ? Math.max(...gaps) : 0,
                        idle,
                        utilisation:
                            arr.length > 0 ? round(((arr.length - idle) / arr.length) * 100) : 0,
                    };
                };
                const sp = stat(prior);
                const sr = stat(recent);
                const delta = (a: number, b: number) =>
                    a === 0 ? "—" : `${round(((b - a) / a) * 100)}%`;

                addStyledSheet(wb, "Period Comparison", {
                    title: "PERFORMANCE COMPARISON — PRIOR HALF vs RECENT HALF",
                    subtitle: "Splits the filtered window in half for trend direction",
                    headers: ["Metric", "Prior Half", "Recent Half", "Δ (%)"],
                    rows: [
                        ["Gap Events", sp.events, sr.events, delta(sp.events, sr.events)],
                        ["Total Gap Days", sp.total, sr.total, delta(sp.total, sr.total)],
                        ["Avg Gap (days)", sp.avg, sr.avg, delta(sp.avg, sr.avg)],
                        ["Median Gap (days)", sp.median, sr.median, delta(sp.median, sr.median)],
                        ["Max Gap (days)", sp.max, sr.max, delta(sp.max, sr.max)],
                        ["Idle Events", sp.idle, sr.idle, delta(sp.idle, sr.idle)],
                        [
                            "Utilisation %",
                            `${sp.utilisation}%`,
                            `${sr.utilisation}%`,
                            delta(sp.utilisation, sr.utilisation),
                        ],
                    ],
                });
            }

            // 11) Top 10 longest gaps + Top/Bottom fleets
            const topGaps = [...gapRows]
                .sort((a, b) => b.gapDays - a.gapDays)
                .slice(0, 10)
                .map((r) => [
                    r.fleet,
                    r.vehicleType,
                    r.driver,
                    r.route,
                    fmtDate(r.prevArrival),
                    fmtDate(r.nextDeparture),
                    r.gapDays,
                ]);
            addStyledSheet(wb, "Top 10 Longest Gaps", {
                title: "TOP 10 LONGEST IDLE GAPS",
                headers: [
                    "Fleet",
                    "Vehicle Type",
                    "Driver",
                    "Route",
                    "Prev Arrival",
                    "Next Departure",
                    "Gap Days",
                ],
                rows: topGaps,
            });

            const fleetBreakdown = buildBreakdown((r) => r.fleet);
            const top5Fleets = fleetBreakdown.slice(0, 5);
            const bottom5Fleets = [...fleetBreakdown]
                .sort((a, b) => Number(a[2]) - Number(b[2]))
                .slice(0, 5);
            addStyledSheet(wb, "Fleet Leaderboard", {
                title: "FLEETS — TOP 5 (MOST IDLE) vs BOTTOM 5 (LEAST IDLE)",
                headers: ["Rank", "Group", ...breakdownHeaders.slice(1)],
                rows: [
                    ...top5Fleets.map((r, i) => [`Top ${i + 1}`, ...r]),
                    ["", "", "", "", "", "", "", "", "", ""],
                    ...bottom5Fleets.map((r, i) => [`Bottom ${i + 1}`, ...r]),
                ],
            });

            const fname = `Fleet_Gap_Days_${filters.from}_to_${filters.to}.xlsx`;
            await saveWorkbook(wb, fname);
            toast({
                title: "Report exported",
                description: `${fname} downloaded with ${kpi.measured} gap events across ${kpi.fleets} fleets.`,
            });
            onOpenChange(false);
        } catch (err) {
            console.error(err);
            toast({
                title: "Export failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            setExporting(false);
        }
    };

    // ── Professional PDF export ─────────────────────────────────────────────
    const handleExportPdf = async () => {
        if (gapRows.length === 0) {
            toast({
                title: "Nothing to export",
                description: "Adjust filters — current selection has no gap data.",
                variant: "destructive",
            });
            return;
        }
        setExportingPdf(true);
        try {
            // Shared breakdown helper (mirrors Excel logic)
            const buildBreakdownRows = (
                grouper: (r: GapRow) => string,
                limit?: number,
            ): (string | number)[][] => {
                const map = new Map<string, GapRow[]>();
                for (const r of gapRows) {
                    const k = grouper(r) || "—";
                    if (!map.has(k)) map.set(k, []);
                    map.get(k)!.push(r);
                }
                const rows = [...map.entries()].map(([k, arr]) => {
                    const gaps = arr.map((r) => r.gapDays);
                    const total = gaps.reduce((a, b) => a + b, 0);
                    const idle = arr.filter((r) => r.gapDays > 0).length;
                    const utilisation =
                        arr.length > 0 ? round(((arr.length - idle) / arr.length) * 100) : 0;
                    return [
                        k,
                        arr.length,
                        total,
                        round(mean(gaps)),
                        round(median(gaps)),
                        round(stdDev(gaps)),
                        gaps.length ? Math.max(...gaps) : 0,
                        idle,
                        utilisation,
                    ] as (string | number)[];
                });
                rows.sort((a, b) => Number(b[2]) - Number(a[2]));
                return limit ? rows.slice(0, limit) : rows;
            };

            const breakdownColumns = (groupHeader: string): ReportColumn[] => [
                { header: groupHeader, width: 28, align: "left" },
                { header: "Gap Events", width: 14, align: "right", format: "integer" },
                { header: "Total Gap Days", width: 16, align: "right", format: "integer" },
                { header: "Avg Gap", width: 12, align: "right", format: "decimal" },
                { header: "Median Gap", width: 14, align: "right", format: "decimal" },
                { header: "Std. Dev", width: 12, align: "right", format: "decimal" },
                { header: "Max Gap", width: 12, align: "right", format: "integer" },
                { header: "Idle Events", width: 14, align: "right", format: "integer" },
                { header: "Utilisation %", width: 14, align: "right", format: "decimal" },
            ];

            const sections: ReportSection[] = [];

            // 1) Executive Summary table
            sections.push({
                heading: "Executive Summary",
                columns: [
                    { header: "Metric", width: 32, align: "left" },
                    { header: "Value", width: 24, align: "right" },
                ],
                rows: [
                    ["Reporting Period", `${filters.from} → ${filters.to}`],
                    ["Fleets Analysed", kpi.fleets],
                    ["Gap Events Measured", kpi.measured],
                    ["Idle Events (gap > 0)", kpi.idleEvents],
                    ["Extended Idle Events (≥ 7 days)", kpi.longIdleEvents],
                    ["Total Gap Days", kpi.totalGapDays],
                    ["Average Gap (days)", kpi.avg],
                    ["Median Gap (days)", kpi.median],
                    ["Std. Deviation (days)", kpi.stdDev],
                    ["Maximum Gap (days)", kpi.max],
                    ["Minimum Gap (days)", kpi.min],
                    ["Effective Utilisation %", `${kpi.utilisationPct}%`],
                ],
            });

            // 2) Filters Applied
            sections.push({
                heading: "Filters Applied",
                columns: [
                    { header: "Filter", width: 22, align: "left" },
                    { header: "Value", width: 60, align: "left" },
                ],
                rows: [
                    ["Date From", filters.from],
                    ["Date To", filters.to],
                    [
                        "Vehicle Types",
                        filters.vehicleTypes.size ? [...filters.vehicleTypes].join(", ") : "All",
                    ],
                    ["Fleets", filters.fleets.size ? [...filters.fleets].join(", ") : "All"],
                    ["Drivers", filters.drivers.size ? [...filters.drivers].join(", ") : "All"],
                    ["Routes", filters.routes.size ? [...filters.routes].join(", ") : "All"],
                ],
            });

            // 3) Top 10 Longest Gaps
            sections.push({
                heading: "Top 10 Longest Idle Gaps",
                columns: [
                    { header: "Fleet", width: 14, align: "left" },
                    { header: "Vehicle Type", width: 18, align: "left" },
                    { header: "Driver", width: 22, align: "left" },
                    { header: "Route", width: 36, align: "left" },
                    { header: "Prev Arrival", width: 16, align: "left" },
                    { header: "Next Departure", width: 16, align: "left" },
                    { header: "Gap Days", width: 12, align: "right", format: "integer" },
                ],
                rows: [...gapRows]
                    .sort((a, b) => b.gapDays - a.gapDays)
                    .slice(0, 10)
                    .map((r) => [
                        r.fleet,
                        r.vehicleType,
                        r.driver,
                        r.route,
                        fmtDate(r.prevArrival),
                        fmtDate(r.nextDeparture),
                        r.gapDays,
                    ]),
            });

            // 4–7) Breakdowns (drivers/routes capped to top 20 for PDF readability)
            sections.push({
                heading: "Performance Breakdown — By Fleet",
                columns: breakdownColumns("Fleet"),
                rows: buildBreakdownRows((r) => r.fleet),
            });
            sections.push({
                heading: "Performance Breakdown — By Vehicle Type",
                columns: breakdownColumns("Vehicle Type"),
                rows: buildBreakdownRows((r) => r.vehicleType),
            });
            sections.push({
                heading: "Performance Breakdown — By Driver (Top 20)",
                columns: breakdownColumns("Driver"),
                rows: buildBreakdownRows((r) => r.driver, 20),
            });
            sections.push({
                heading: "Performance Breakdown — By Route (Top 20)",
                columns: breakdownColumns("Route"),
                rows: buildBreakdownRows((r) => r.route, 20),
            });

            // 8) Weekly Trend
            const weeklyMap = new Map<string, { totalGap: number; count: number }>();
            for (const r of gapRows) {
                const k = weekKey(r.nextDeparture);
                const e = weeklyMap.get(k) || { totalGap: 0, count: 0 };
                e.totalGap += r.gapDays;
                e.count += 1;
                weeklyMap.set(k, e);
            }
            const weeklySorted = [...weeklyMap.entries()].sort(([a], [b]) => a.localeCompare(b));
            sections.push({
                heading: "Weekly Trend (WoW Δ)",
                columns: [
                    { header: "Week", width: 16, align: "left" },
                    { header: "Gap Events", width: 14, align: "right", format: "integer" },
                    { header: "Total Gap Days", width: 16, align: "right", format: "integer" },
                    { header: "Avg Gap", width: 12, align: "right", format: "decimal" },
                    { header: "WoW Δ", width: 12, align: "right" },
                ],
                rows: weeklySorted.map(([wk, v], idx) => {
                    const avg = v.count > 0 ? v.totalGap / v.count : 0;
                    let wow: string | number = "—";
                    if (idx > 0) {
                        const prev = weeklySorted[idx - 1][1];
                        const prevAvg = prev.count > 0 ? prev.totalGap / prev.count : 0;
                        if (prevAvg > 0) wow = `${round(((avg - prevAvg) / prevAvg) * 100)}%`;
                    }
                    return [wk, v.count, v.totalGap, round(avg), wow];
                }),
            });

            // 9) Monthly Trend
            const monthlyMap = new Map<string, { totalGap: number; count: number }>();
            for (const r of gapRows) {
                const k = monthKey(r.nextDeparture);
                const e = monthlyMap.get(k) || { totalGap: 0, count: 0 };
                e.totalGap += r.gapDays;
                e.count += 1;
                monthlyMap.set(k, e);
            }
            const monthlySorted = [...monthlyMap.entries()].sort(([a], [b]) =>
                a.localeCompare(b),
            );
            sections.push({
                heading: "Monthly Trend (MoM Δ)",
                columns: [
                    { header: "Month", width: 16, align: "left" },
                    { header: "Gap Events", width: 14, align: "right", format: "integer" },
                    { header: "Total Gap Days", width: 16, align: "right", format: "integer" },
                    { header: "Avg Gap", width: 12, align: "right", format: "decimal" },
                    { header: "MoM Δ", width: 12, align: "right" },
                ],
                rows: monthlySorted.map(([mk, v], idx) => {
                    const avg = v.count > 0 ? v.totalGap / v.count : 0;
                    let mom: string | number = "—";
                    if (idx > 0) {
                        const prev = monthlySorted[idx - 1][1];
                        const prevAvg = prev.count > 0 ? prev.totalGap / prev.count : 0;
                        if (prevAvg > 0) mom = `${round(((avg - prevAvg) / prevAvg) * 100)}%`;
                    }
                    return [mk, v.count, v.totalGap, round(avg), mom];
                }),
            });

            // 10) Period Comparison
            if (gapRows.length >= 2) {
                const sortedByDate = [...gapRows].sort(
                    (a, b) => a.nextDeparture.getTime() - b.nextDeparture.getTime(),
                );
                const mid = Math.floor(sortedByDate.length / 2);
                const prior = sortedByDate.slice(0, mid);
                const recent = sortedByDate.slice(mid);
                const stat = (arr: GapRow[]) => {
                    const gaps = arr.map((r) => r.gapDays);
                    const total = gaps.reduce((a, b) => a + b, 0);
                    const idle = arr.filter((r) => r.gapDays > 0).length;
                    return {
                        events: arr.length,
                        total,
                        avg: round(mean(gaps)),
                        median: round(median(gaps)),
                        max: gaps.length ? Math.max(...gaps) : 0,
                        idle,
                        utilisation:
                            arr.length > 0
                                ? round(((arr.length - idle) / arr.length) * 100)
                                : 0,
                    };
                };
                const sp = stat(prior);
                const sr = stat(recent);
                const delta = (a: number, b: number) =>
                    a === 0 ? "—" : `${round(((b - a) / a) * 100)}%`;
                sections.push({
                    heading: "Period Comparison — Prior Half vs Recent Half",
                    columns: [
                        { header: "Metric", width: 26, align: "left" },
                        { header: "Prior Half", width: 16, align: "right" },
                        { header: "Recent Half", width: 16, align: "right" },
                        { header: "Δ (%)", width: 14, align: "right" },
                    ],
                    rows: [
                        ["Gap Events", sp.events, sr.events, delta(sp.events, sr.events)],
                        ["Total Gap Days", sp.total, sr.total, delta(sp.total, sr.total)],
                        ["Avg Gap (days)", sp.avg, sr.avg, delta(sp.avg, sr.avg)],
                        ["Median Gap (days)", sp.median, sr.median, delta(sp.median, sr.median)],
                        ["Max Gap (days)", sp.max, sr.max, delta(sp.max, sr.max)],
                        ["Idle Events", sp.idle, sr.idle, delta(sp.idle, sr.idle)],
                        [
                            "Utilisation %",
                            `${sp.utilisation}%`,
                            `${sr.utilisation}%`,
                            delta(sp.utilisation, sr.utilisation),
                        ],
                    ],
                });
            }

            // 11) Fleet Leaderboard (Top 5 + Bottom 5)
            const fleetBreakdown = buildBreakdownRows((r) => r.fleet);
            const top5 = fleetBreakdown.slice(0, 5);
            const bottom5 = [...fleetBreakdown]
                .sort((a, b) => Number(a[2]) - Number(b[2]))
                .slice(0, 5);
            sections.push({
                heading: "Fleet Leaderboard — Top 5 (Most Idle) vs Bottom 5 (Least Idle)",
                columns: [
                    { header: "Rank", width: 12, align: "left" },
                    ...breakdownColumns("Fleet"),
                ],
                rows: [
                    ...top5.map((r, i) => [`Top ${i + 1}`, ...r]),
                    ...bottom5.map((r, i) => [`Bottom ${i + 1}`, ...r]),
                ],
            });

            const spec: ReportSpec = {
                title: "Fleet Gap Days — Advanced Analytics Report",
                subtitle: "Idle time analysis with multi-dimension breakdowns and trends",
                dateFrom: filters.from,
                dateTo: filters.to,
                filenameBase: `Fleet_Gap_Days_${filters.from}_to_${filters.to}`,
                summary: [
                    { label: "Gap Events", value: kpi.measured.toLocaleString() },
                    { label: "Fleets", value: kpi.fleets.toLocaleString() },
                    { label: "Total Gap Days", value: kpi.totalGapDays.toLocaleString() },
                    { label: "Avg Gap", value: `${kpi.avg} d` },
                    { label: "Idle Events", value: kpi.idleEvents.toLocaleString() },
                    { label: "Utilisation", value: `${kpi.utilisationPct}%` },
                ],
                sections,
            };

            generateReportPDF(spec);
            toast({
                title: "PDF report generated",
                description: `${kpi.measured} gap events across ${kpi.fleets} fleets.`,
            });
            onOpenChange(false);
        } catch (err) {
            console.error(err);
            toast({
                title: "PDF export failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            setExportingPdf(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                            <CalendarRange className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                Trip Management
                            </p>
                            <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                Fleet Gap Days — Advanced Report
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                                Filter by vehicle type, route, or driver and export a multi-sheet
                                analytics workbook with trends, breakdowns and comparisons.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6 py-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-slate-500">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading trips…
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Date Range */}
                            <section>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
                                    Reporting Period
                                </p>
                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="flex flex-col">
                                        <Label className="text-xs text-slate-600 dark:text-slate-300 mb-1">
                                            From
                                        </Label>
                                        <Input
                                            type="date"
                                            value={filters.from}
                                            max={filters.to || undefined}
                                            onChange={(e) =>
                                                setFilters((p) => ({ ...p, from: e.target.value }))
                                            }
                                            className="h-9 w-[160px]"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <Label className="text-xs text-slate-600 dark:text-slate-300 mb-1">
                                            To
                                        </Label>
                                        <Input
                                            type="date"
                                            value={filters.to}
                                            min={filters.from || undefined}
                                            onChange={(e) =>
                                                setFilters((p) => ({ ...p, to: e.target.value }))
                                            }
                                            className="h-9 w-[160px]"
                                        />
                                    </div>
                                    <Select
                                        value=""
                                        onValueChange={(v) => {
                                            const months =
                                                v === "1m" ? 1 : v === "3m" ? 3 : v === "6m" ? 6 : 12;
                                            setFilters((p) => ({
                                                ...p,
                                                from: monthsAgoISO(months),
                                                to: todayISO(),
                                            }));
                                        }}
                                    >
                                        <SelectTrigger className="h-9 w-[160px]">
                                            <SelectValue placeholder="Quick range…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1m">Last Month</SelectItem>
                                            <SelectItem value="3m">Last 3 Months</SelectItem>
                                            <SelectItem value="6m">Last 6 Months</SelectItem>
                                            <SelectItem value="12m">Last 12 Months</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </section>

                            <Separator />

                            {/* Filters */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <Filter className="h-3.5 w-3.5" />
                                        Filters
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearAll}
                                        className="h-7 gap-1.5 text-xs text-slate-600 hover:text-slate-900"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Clear filters
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FilterGroup
                                        label="Vehicle Type"
                                        options={options.vehicleTypes}
                                        selected={filters.vehicleTypes}
                                        onToggle={(v) => toggleSet("vehicleTypes", v)}
                                    />
                                    <FilterGroup
                                        label="Driver"
                                        options={options.drivers}
                                        selected={filters.drivers}
                                        onToggle={(v) => toggleSet("drivers", v)}
                                    />
                                    <FilterGroup
                                        label="Fleet"
                                        options={options.fleets}
                                        selected={filters.fleets}
                                        onToggle={(v) => toggleSet("fleets", v)}
                                    />
                                    <FilterGroup
                                        label="Route"
                                        options={options.routes}
                                        selected={filters.routes}
                                        onToggle={(v) => toggleSet("routes", v)}
                                    />
                                </div>
                            </section>

                            <Separator />

                            {/* Live KPI Preview */}
                            <section>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
                                    Preview — Computed from current filters
                                </p>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <KpiTile label="Gap Events" value={kpi.measured.toLocaleString()} />
                                    <KpiTile label="Fleets" value={kpi.fleets.toLocaleString()} />
                                    <KpiTile label="Total Gap Days" value={kpi.totalGapDays.toLocaleString()} />
                                    <KpiTile label="Avg Gap" value={`${kpi.avg} d`} />
                                    <KpiTile label="Median Gap" value={`${kpi.median} d`} />
                                    <KpiTile label="Max Gap" value={`${kpi.max} d`} />
                                    <KpiTile
                                        label="Idle Events"
                                        value={kpi.idleEvents.toLocaleString()}
                                        accent="amber"
                                    />
                                    <KpiTile
                                        label="Utilisation"
                                        value={`${kpi.utilisationPct}%`}
                                        accent="emerald"
                                    />
                                </div>
                            </section>
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="flex w-full flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Excel: 11 sheets · PDF: 11 sections — Executive Summary · Filters · Top 10 · 4 Breakdowns · Weekly · Monthly · Period Comparison · Leaderboard
                        </p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleExport}
                                disabled={exporting || exportingPdf || loading || gapRows.length === 0}
                                variant="outline"
                                className="gap-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                            >
                                {exporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                {exporting ? "Generating…" : "Export Excel"}
                            </Button>
                            <Button
                                onClick={handleExportPdf}
                                disabled={exporting || exportingPdf || loading || gapRows.length === 0}
                                className="gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                            >
                                {exportingPdf ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <FileText className="h-4 w-4" />
                                )}
                                {exportingPdf ? "Generating…" : "Export PDF"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ── Sub-components ──────────────────────────────────────────────────────────
const KpiTile = ({
    label,
    value,
    accent = "slate",
}: {
    label: string;
    value: string;
    accent?: "slate" | "emerald" | "amber";
}) => {
    const accentMap: Record<string, string> = {
        slate: "bg-slate-500/70",
        emerald: "bg-emerald-500/70",
        amber: "bg-amber-500/70",
    };
    return (
        <div className="relative overflow-hidden rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className={`absolute inset-x-0 top-0 h-[2px] ${accentMap[accent]}`} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {value}
            </p>
        </div>
    );
};

const FilterGroup = ({
    label,
    options,
    selected,
    onToggle,
}: {
    label: string;
    options: string[];
    selected: Set<string>;
    onToggle: (v: string) => void;
}) => {
    return (
        <div className="rounded-lg border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-3 py-2 dark:border-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {label}
                </p>
                {selected.size > 0 && (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                        {selected.size} selected
                    </Badge>
                )}
            </div>
            <ScrollArea className="h-32 px-3 py-2">
                {options.length === 0 ? (
                    <p className="py-2 text-xs text-slate-400">No values available</p>
                ) : (
                    <div className="space-y-1.5">
                        {options.map((opt) => {
                            const id = `${label}-${opt}`;
                            return (
                                <label
                                    key={opt}
                                    htmlFor={id}
                                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900/40"
                                >
                                    <Checkbox
                                        id={id}
                                        checked={selected.has(opt)}
                                        onCheckedChange={() => onToggle(opt)}
                                    />
                                    <span className="truncate">{opt}</span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};

export default FleetGapDaysReportDialog;
