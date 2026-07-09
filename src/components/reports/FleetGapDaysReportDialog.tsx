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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
    actual_departure_date?: string | null;
    arrival_date?: string | null;
    planned_arrival_date?: string | null;
    actual_arrival_date?: string | null;
    offloading_completed_at?: string | null;
    completed_at?: string | null;
    distance_km?: number | null;
    base_revenue?: number | null;
    additional_revenue?: number | null;
    final_invoice_amount?: number | null;
    vehicle_type?: string | null;
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

// Convert any date-like value into a stable UTC-midnight day key. Strings that
// look like "yyyy-mm-dd[Thh:mm:ss...]" are parsed positionally so timezone
// drift can't shift the day by ±1.
const toDayKey = (raw: string | number | Date | null | undefined): number | null => {
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
        if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

// ISO 8601 week number (Monday-start, week containing Thursday belongs to that year).
const isoWeekKey = (d: Date): string => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

// Convert an HTML <input type="week"> value (e.g. "2026-W18") to the Monday
// (start) and Sunday (end) ISO date strings (yyyy-mm-dd) for that ISO week.
const isoWeekToDateRange = (weekStr: string): { from: string; to: string } | null => {
    const m = /^(\d{4})-W(\d{2})$/.exec(weekStr);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    // Per ISO 8601: week 1 contains the year's first Thursday. Find Jan 4 (always in week 1)
    // and walk back to its Monday, then add (week-1)*7 days.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; // 1..7 (Mon..Sun)
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
    const monday = new Date(week1Monday);
    monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const toISO = (d: Date) => d.toISOString().split("T")[0];
    return { from: toISO(monday), to: toISO(sunday) };
};

// Convert a yyyy-mm-dd string to its ISO week key (yyyy-Www) for the <input type="week"> control.
const dateToIsoWeekInput = (iso: string): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return "";
    return isoWeekKey(new Date(y, m - 1, d));
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// Local (timezone-safe) yyyy-mm-dd for a Date.
const localISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// One-click reporting periods.
const QUICK_RANGES: { label: string; range: () => { from: string; to: string } }[] = [
    { label: "This Week", range: () => isoWeekToDateRange(isoWeekKey(new Date()))! },
    {
        label: "Last Week",
        range: () => {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            return isoWeekToDateRange(isoWeekKey(d))!;
        },
    },
    {
        label: "This Month",
        range: () => {
            const n = new Date();
            return { from: localISO(new Date(n.getFullYear(), n.getMonth(), 1)), to: localISO(n) };
        },
    },
    {
        label: "Last Month",
        range: () => {
            const n = new Date();
            return {
                from: localISO(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
                to: localISO(new Date(n.getFullYear(), n.getMonth(), 0)),
            };
        },
    },
    { label: "Last 3 Months", range: () => ({ from: monthsAgoISO(3), to: todayISO() }) },
    { label: "Last 6 Months", range: () => ({ from: monthsAgoISO(6), to: todayISO() }) },
    {
        label: "This Year",
        range: () => {
            const n = new Date();
            return { from: localISO(new Date(n.getFullYear(), 0, 1)), to: localISO(n) };
        },
    },
];

const fmtDateLong = (d: Date) =>
    d.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });

// Number formatting matching the user's example: "5.00", "12.00", etc.
const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Fleets included in the Gap Days report. Anything outside this list is
// excluded from both the dropdown and the report output.
const REPORT_FLEETS = new Set([
    "21H",
    "22H",
    "23H",
    "24H",
    "26H",
    "28H",
    "29H",
    "30H",
    "31H",
    "32H",
    "33H",
    "34H",
]);

// ── Component ───────────────────────────────────────────────────────────────
export const FleetGapDaysReportDialog = ({ open, onOpenChange }: Props) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [allTrips, setAllTrips] = useState<Trip[]>([]);
    const [allVehicles, setAllVehicles] = useState<
        { fleet_number: string; vehicle_type: string | null }[]
    >([]);
    const [periodMode, setPeriodMode] = useState<"date" | "week">("date");
    const [includeWeekly, setIncludeWeekly] = useState(true);
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
                // Page through trips to bypass PostgREST's default 1000-row cap.
                const PAGE_SIZE = 1000;
                const fetchTripsPage = (from: number, to: number) =>
                    supabase
                        .from("trips")
                        .select(
                            "*, vehicles:fleet_vehicle_id(fleet_number, vehicle_type), wialon_vehicles:vehicle_id(fleet_number, name)"
                        )
                        .order("departure_date", { ascending: true })
                        .range(from, to);
                const tripsAll: Record<string, unknown>[] = [];
                for (let page = 0; page < 50; page++) {
                    const from = page * PAGE_SIZE;
                    const to = from + PAGE_SIZE - 1;
                    const { data, error } = await fetchTripsPage(from, to);
                    if (error) throw error;
                    const rows = (data || []) as Record<string, unknown>[];
                    tripsAll.push(...rows);
                    if (rows.length < PAGE_SIZE) break;
                }
                const vehiclesRes = await supabase
                    .from("vehicles")
                    .select("fleet_number, vehicle_type, active")
                    .eq("active", true);
                if (vehiclesRes.error) throw vehiclesRes.error;
                const tripsRes = { data: tripsAll, error: null as null };
                const extractFleetFromName = (name: string | null | undefined): string | null => {
                    if (!name) return null;
                    const first = name.split(" - ")[0]?.trim();
                    if (first && /^[\d]+[A-Z]+$|^[A-Z]+$/.test(first)) return first;
                    return null;
                };
                const trips: Trip[] = (tripsRes.data || []).map((t: Record<string, unknown>) => {
                    const v = t.vehicles as { fleet_number?: string; vehicle_type?: string } | null;
                    const w = t.wialon_vehicles as { fleet_number?: string; name?: string } | null;
                    const fleetNumber =
                        v?.fleet_number ||
                        w?.fleet_number ||
                        extractFleetFromName(w?.name) ||
                        null;
                    return {
                        ...(t as Trip),
                        fleet_number: fleetNumber,
                        vehicle_type: v?.vehicle_type || null,
                    };
                });
                const vehicles = (vehiclesRes.data || [])
                    .filter((v) => v.fleet_number)
                    .map((v) => ({
                        fleet_number: v.fleet_number as string,
                        vehicle_type: (v.vehicle_type as string | null) ?? null,
                    }));
                if (!cancelled) {
                    setAllTrips(trips);
                    setAllVehicles(vehicles);
                }
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

    // ── Derive option lists from loaded trips + vehicles ────────────────────
    const options = useMemo(() => {
        const vts = new Set<string>();
        const drs = new Set<string>();
        const fls = new Set<string>();
        const rts = new Set<string>();
        for (const v of allVehicles) {
            if (v.vehicle_type) vts.add(v.vehicle_type);
            if (v.fleet_number && REPORT_FLEETS.has(v.fleet_number)) fls.add(v.fleet_number);
        }
        for (const t of allTrips) {
            if (t.vehicle_type) vts.add(t.vehicle_type);
            if (t.driver_name) drs.add(t.driver_name);
            if (t.fleet_number && REPORT_FLEETS.has(t.fleet_number)) fls.add(t.fleet_number);
            if (t.origin && t.destination) rts.add(`${t.origin} → ${t.destination}`);
        }
        return {
            vehicleTypes: [...vts].sort(),
            drivers: [...drs].sort(),
            fleets: [...fls].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            routes: [...rts].sort(),
        };
    }, [allTrips, allVehicles]);

    // ── Aggregate gap rows by week × fleet ─────────────────────────────────
    type FleetWeekRow = {
        fleet: string;
        week: string;
        gaps: number;
        totalGapDays: number;
        avgGapDays: number;
    };
    type WeekBlock = {
        week: string;
        rows: FleetWeekRow[];
        totalDaysStanding: number;
        totalWorkingDays: number;
        pctStanding: number;
        pctMinus5: number;
    };

    // Build the fleet universe + per-fleet on-trip-day set, plus the week
    // blocks. A "gap day" is any day in the selected window where a fleet
    // has no trip activity (between departure_date and arrival_date,
    // inclusive). Every ISO week that overlaps the window is reported,
    // even if it contains zero gap days, and trucks with no trips at all
    // contribute 7 gap days per week.
    const { weekBlocks, totalFleetsInScope } = useMemo(() => {
        const fromDate = filters.from ? new Date(filters.from) : null;
        const toDate = filters.to ? new Date(`${filters.to}T23:59:59`) : null;
        if (!fromDate || !toDate) {
            return { weekBlocks: [] as WeekBlock[], totalFleetsInScope: 0 };
        }

        // Fleet universe: only the report's allow-listed fleets, further
        // narrowed by the user's non-date filters.
        const fleetUniverse = new Set<string>();
        for (const v of allVehicles) {
            if (!v.fleet_number) continue;
            if (!REPORT_FLEETS.has(v.fleet_number)) continue;
            if (filters.vehicleTypes.size && !filters.vehicleTypes.has(v.vehicle_type || ""))
                continue;
            if (filters.fleets.size && !filters.fleets.has(v.fleet_number)) continue;
            fleetUniverse.add(v.fleet_number);
        }
        // Also include any allow-listed fleet that has trips but is missing
        // from the vehicles table.
        for (const t of allTrips) {
            if (!t.fleet_number) continue;
            if (!REPORT_FLEETS.has(t.fleet_number)) continue;
            if (filters.vehicleTypes.size && !filters.vehicleTypes.has(t.vehicle_type || ""))
                continue;
            if (filters.fleets.size && !filters.fleets.has(t.fleet_number)) continue;
            if (filters.drivers.size && !filters.drivers.has(t.driver_name || "")) continue;
            if (filters.routes.size) {
                const r = `${t.origin || ""} → ${t.destination || ""}`;
                if (!filters.routes.has(r)) continue;
            }
            fleetUniverse.add(t.fleet_number);
        }

        // Per-fleet set of UTC midnights when the fleet was on a trip. The
        // load day = first available of actual/planned/declared departure.
        // The offload day = first available of offloading_completed_at,
        // actual_arrival_date, arrival_date, planned_arrival_date — falling
        // back to the load day when none is set (single-day trip).
        const onTripDays = new Map<string, Set<number>>();
        for (const t of allTrips) {
            if (!t.fleet_number || !fleetUniverse.has(t.fleet_number)) continue;
            // A trip counts as completed when it has a completed_at timestamp
            // OR a status that represents a finished trip in this codebase.
            const status = (t.status || "").toLowerCase();
            const isCompleted =
                !!t.completed_at ||
                status === "completed" ||
                status === "paid" ||
                status === "invoiced";
            if (!isCompleted) continue;
            if (filters.drivers.size && !filters.drivers.has(t.driver_name || "")) continue;
            if (filters.routes.size) {
                const r = `${t.origin || ""} → ${t.destination || ""}`;
                if (!filters.routes.has(r)) continue;
            }
            const depDay = toDayKey(
                t.actual_departure_date ||
                t.departure_date ||
                t.planned_departure_date ||
                null,
            );
            if (depDay == null) continue;
            const arrDay =
                toDayKey(
                    t.offloading_completed_at ||
                    t.actual_arrival_date ||
                    t.arrival_date ||
                    t.planned_arrival_date ||
                    null,
                ) ?? depDay;
            const startDay = Math.min(depDay, arrDay);
            const endDay = Math.max(depDay, arrDay);
            let set = onTripDays.get(t.fleet_number);
            if (!set) {
                set = new Set();
                onTripDays.set(t.fleet_number, set);
            }
            for (let d = startDay; d <= endDay; d += 86400000) set.add(d);
        }

        // Walk every day in the window for every fleet in the universe.
        const startUTC = Date.UTC(
            fromDate.getFullYear(),
            fromDate.getMonth(),
            fromDate.getDate(),
        );
        const endUTC = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
        // Buckets: week → fleet → { gaps (distinct intervals within the week), total }
        const buckets = new Map<string, Map<string, { gaps: number; total: number }>>();
        // Always create an entry for every ISO week that overlaps the window.
        const allWeeks = new Set<string>();
        for (let d = startUTC; d <= endUTC; d += 86400000) {
            const dt = new Date(d);
            const local = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
            allWeeks.add(isoWeekKey(local));
        }
        for (const wk of allWeeks) buckets.set(wk, new Map());

        for (const fleet of fleetUniverse) {
            const onSet = onTripDays.get(fleet) || new Set<number>();
            let prevWasGap = false;
            let prevWeek = "";
            for (let d = startUTC; d <= endUTC; d += 86400000) {
                if (onSet.has(d)) {
                    prevWasGap = false;
                    continue;
                }
                const dt = new Date(d);
                const local = new Date(
                    dt.getUTCFullYear(),
                    dt.getUTCMonth(),
                    dt.getUTCDate(),
                );
                const wk = isoWeekKey(local);
                const fmap = buckets.get(wk)!;
                const e = fmap.get(fleet) || { gaps: 0, total: 0 };
                if (!prevWasGap || prevWeek !== wk) e.gaps += 1;
                e.total += 1;
                fmap.set(fleet, e);
                prevWasGap = true;
                prevWeek = wk;
            }
        }

        const sortedWeeks = [...allWeeks].sort().reverse(); // most recent first
        const totalWorkingDaysPerWeek = fleetUniverse.size * 7; // Mon–Sun
        const blocks: WeekBlock[] = sortedWeeks.map((wk) => {
            const fmap = buckets.get(wk)!;
            const rows: FleetWeekRow[] = [...fmap.entries()]
                .map(([fleet, v]) => ({
                    fleet,
                    week: wk,
                    gaps: v.gaps,
                    totalGapDays: v.total,
                    avgGapDays: v.gaps > 0 ? v.total / v.gaps : 0,
                }))
                .sort((a, b) =>
                    a.fleet.localeCompare(b.fleet, undefined, { numeric: true }),
                );
            const totalDaysStanding = rows.reduce((s, r) => s + r.totalGapDays, 0);
            const pctStanding =
                totalWorkingDaysPerWeek > 0
                    ? (totalDaysStanding / totalWorkingDaysPerWeek) * 100
                    : 0;
            return {
                week: wk,
                rows,
                totalDaysStanding,
                totalWorkingDays: totalWorkingDaysPerWeek,
                pctStanding: Math.round(pctStanding),
                pctMinus5: Math.max(0, Math.round(pctStanding) - 5),
            };
        });
        return { weekBlocks: blocks, totalFleetsInScope: fleetUniverse.size };
    }, [allTrips, allVehicles, filters]);

    // ── Live preview KPIs ───────────────────────────────────────────────────
    const kpi = useMemo(() => {
        const totalGapDays = weekBlocks.reduce((s, b) => s + b.totalDaysStanding, 0);
        const measured = weekBlocks.reduce(
            (s, b) => s + b.rows.reduce((ss, r) => ss + r.gaps, 0),
            0,
        );
        return {
            measured,
            fleets: totalFleetsInScope,
            weeks: weekBlocks.length,
            totalGapDays,
        };
    }, [weekBlocks, totalFleetsInScope]);

    // ── Period grand total: all weeks in the range combined, per fleet ──────
    const periodTotal = useMemo(() => {
        const byFleet = new Map<string, { gaps: number; total: number }>();
        for (const b of weekBlocks) {
            for (const r of b.rows) {
                const e = byFleet.get(r.fleet) || { gaps: 0, total: 0 };
                e.gaps += r.gaps;
                e.total += r.totalGapDays;
                byFleet.set(r.fleet, e);
            }
        }
        const rows: FleetWeekRow[] = [...byFleet.entries()]
            .map(([fleet, v]) => ({
                fleet,
                week: "",
                gaps: v.gaps,
                totalGapDays: v.total,
                avgGapDays: v.gaps > 0 ? v.total / v.gaps : 0,
            }))
            .sort((a, b) => a.fleet.localeCompare(b.fleet, undefined, { numeric: true }));
        const totalDaysStanding = rows.reduce((s, r) => s + r.totalGapDays, 0);
        const totalWorkingDays = weekBlocks.reduce((s, b) => s + b.totalWorkingDays, 0);
        const pctStanding =
            totalWorkingDays > 0
                ? Math.round((totalDaysStanding / totalWorkingDays) * 100)
                : 0;
        return {
            rows,
            totalDaysStanding,
            totalWorkingDays,
            pctStanding,
            pctMinus5: Math.max(0, pctStanding - 5),
        };
    }, [weekBlocks]);

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

    // ── Excel export (professional weekly format) ───────────────────────────
    const handleExport = async () => {
        if (weekBlocks.length === 0) {
            toast({
                title: "Nothing to export",
                description: "Adjust filters — current selection has no gap data.",
                variant: "destructive",
            });
            return;
        }
        setExporting(true);
        try {
            const wb = new ExcelJS.Workbook();
            wb.creator = "Car Craft Co Fleet Management";
            wb.created = new Date();

            const ws = wb.addWorksheet("Fleet Gap Days — Weekly", {
                views: [{ state: "normal", showGridLines: false }],
                pageSetup: {
                    paperSize: 9, // A4
                    orientation: "portrait",
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: {
                        left: 0.5,
                        right: 0.5,
                        top: 0.6,
                        bottom: 0.6,
                        header: 0.3,
                        footer: 0.3,
                    },
                },
            });

            // Column widths (5 columns: Fleet | Week/Period | Gaps | Total Gap Days | Avg Gap Days)
            ws.columns = [
                { width: 14 },
                { width: 26 },
                { width: 12 },
                { width: 18 },
                { width: 16 },
            ];

            // Tokens
            const NAVY = "FF1F3864";
            const NAVY_LIGHT = "FFE8EEF6";
            const ALT = "FFF7F9FC";
            const BORDER = "FFD9D9D9";
            const GREY_TEXT = "FF666666";
            const WHITE = "FFFFFFFF";
            const TOTAL_BG = "FFD1FAE5";
            const TOTAL_TXT = "FF065F46";

            const thinBorder = {
                top: { style: "thin" as const, color: { argb: BORDER } },
                bottom: { style: "thin" as const, color: { argb: BORDER } },
                left: { style: "thin" as const, color: { argb: BORDER } },
                right: { style: "thin" as const, color: { argb: BORDER } },
            };

            let cursor = 1;

            // Period grand total always leads; weekly blocks follow when enabled.
            const periodLabel = `${filters.from} → ${filters.to}`;
            const renderBlocks = [
                {
                    title: "FLEET GAP DAYS — PERIOD TOTAL",
                    col2: "Period",
                    week: periodLabel,
                    rows: periodTotal.rows.map((r) => ({ ...r, week: periodLabel })),
                    totalDaysStanding: periodTotal.totalDaysStanding,
                    totalWorkingDays: periodTotal.totalWorkingDays,
                    pctStanding: periodTotal.pctStanding,
                    pctMinus5: periodTotal.pctMinus5,
                },
                ...(includeWeekly
                    ? weekBlocks.map((b) => ({
                        title: "FLEET GAP DAYS — WEEKLY",
                        col2: "Week",
                        ...b,
                    }))
                    : []),
            ];

            for (let bIdx = 0; bIdx < renderBlocks.length; bIdx++) {
                const block = renderBlocks[bIdx];

                // Title row
                ws.mergeCells(cursor, 1, cursor, 5);
                const titleCell = ws.getCell(cursor, 1);
                titleCell.value = block.title;
                titleCell.font = {
                    name: "Calibri",
                    bold: true,
                    size: 14,
                    color: { argb: NAVY },
                };
                titleCell.alignment = { vertical: "middle", horizontal: "left" };
                ws.getRow(cursor).height = 26;
                cursor += 1;

                // Subtitle row
                ws.mergeCells(cursor, 1, cursor, 5);
                const subCell = ws.getCell(cursor, 1);
                subCell.value = `Generated: ${fmtDateLong(new Date())} • Car Craft Co Fleet Management • ${block.week}`;
                subCell.font = {
                    name: "Calibri",
                    italic: true,
                    size: 9,
                    color: { argb: GREY_TEXT },
                };
                subCell.alignment = { vertical: "middle", horizontal: "left" };
                ws.getRow(cursor).height = 16;
                cursor += 2; // blank spacer row

                // Header row
                const headerRow = ws.getRow(cursor);
                headerRow.values = ["Fleet", block.col2, "Gaps", "Total Gap Days", "Avg Gap Days"];
                headerRow.height = 22;
                headerRow.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: NAVY },
                    };
                    cell.font = {
                        name: "Calibri",
                        bold: true,
                        size: 10,
                        color: { argb: WHITE },
                    };
                    cell.alignment = {
                        vertical: "middle",
                        horizontal: "center",
                        wrapText: true,
                    };
                    cell.border = thinBorder;
                });
                cursor += 1;

                // Data rows
                block.rows.forEach((r, i) => {
                    const row = ws.getRow(cursor);
                    row.values = [
                        r.fleet,
                        r.week,
                        r.gaps,
                        r.totalGapDays,
                        round(r.avgGapDays, 2),
                    ];
                    row.eachCell((cell, colNum) => {
                        cell.font = { name: "Calibri", size: 10, color: { argb: "FF111827" } };
                        cell.alignment = {
                            vertical: "middle",
                            horizontal: colNum <= 2 ? "left" : "right",
                        };
                        cell.border = thinBorder;
                        if (i % 2 === 1) {
                            cell.fill = {
                                type: "pattern",
                                pattern: "solid",
                                fgColor: { argb: ALT },
                            };
                        }
                        if (colNum >= 3 && typeof cell.value === "number") {
                            cell.numFmt = "#,##0.00";
                        }
                    });
                    cursor += 1;
                });

                // Total Days Standing Between Trips (highlighted)
                {
                    const row = ws.getRow(cursor);
                    ws.mergeCells(cursor, 1, cursor, 3);
                    row.getCell(1).value = "Total Days Standing Between Trips";
                    row.getCell(4).value = block.totalDaysStanding;
                    row.getCell(1).font = {
                        name: "Calibri",
                        bold: true,
                        size: 10,
                        color: { argb: NAVY },
                    };
                    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
                    row.getCell(1).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: NAVY_LIGHT },
                    };
                    row.getCell(4).font = {
                        name: "Calibri",
                        bold: true,
                        size: 10,
                        color: { argb: NAVY },
                    };
                    row.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
                    row.getCell(4).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: NAVY_LIGHT },
                    };
                    row.getCell(4).numFmt = "#,##0.00";
                    row.getCell(5).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: NAVY_LIGHT },
                    };
                    [1, 2, 3, 4, 5].forEach((c) => (row.getCell(c).border = thinBorder));
                    row.height = 20;
                    cursor += 2; // spacer
                }

                // Total Working Days
                {
                    const row = ws.getRow(cursor);
                    ws.mergeCells(cursor, 1, cursor, 3);
                    row.getCell(1).value = "Total Working Days";
                    row.getCell(4).value = block.totalWorkingDays;
                    row.getCell(1).font = { name: "Calibri", bold: true, size: 10 };
                    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
                    row.getCell(4).font = { name: "Calibri", bold: true, size: 10 };
                    row.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
                    row.getCell(4).numFmt = "#,##0.00";
                    [1, 2, 3, 4, 5].forEach((c) => (row.getCell(c).border = thinBorder));
                    cursor += 1;
                }

                // Percentage of Days Standing
                {
                    const row = ws.getRow(cursor);
                    ws.mergeCells(cursor, 1, cursor, 3);
                    row.getCell(1).value = "Percentage of Days Standing";
                    row.getCell(4).value = `${block.pctStanding}%`;
                    row.getCell(1).font = { name: "Calibri", bold: true, size: 10 };
                    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
                    row.getCell(4).font = { name: "Calibri", bold: true, size: 10 };
                    row.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
                    [1, 2, 3, 4, 5].forEach((c) => (row.getCell(c).border = thinBorder));
                    cursor += 2; // spacer
                }

                // Total Percentage -5%
                {
                    const row = ws.getRow(cursor);
                    ws.mergeCells(cursor, 1, cursor, 3);
                    row.getCell(1).value = "Total Percentage -5%";
                    row.getCell(4).value = `${block.pctMinus5}%`;
                    row.getCell(1).font = {
                        name: "Calibri",
                        bold: true,
                        size: 10,
                        color: { argb: TOTAL_TXT },
                    };
                    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
                    row.getCell(1).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: TOTAL_BG },
                    };
                    row.getCell(4).font = {
                        name: "Calibri",
                        bold: true,
                        size: 10,
                        color: { argb: TOTAL_TXT },
                    };
                    row.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
                    row.getCell(4).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: TOTAL_BG },
                    };
                    row.getCell(5).fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: TOTAL_BG },
                    };
                    [1, 2, 3, 4, 5].forEach((c) => (row.getCell(c).border = thinBorder));
                    cursor += 1;
                }

                // Spacer between blocks
                if (bIdx < renderBlocks.length - 1) cursor += 3;
            }

            const fname = `Fleet_Gap_Days_${includeWeekly ? "Weekly_" : "Total_"}${filters.from}_to_${filters.to}.xlsx`;
            const buffer = await wb.xlsx.writeBuffer();
            saveAs(
                new Blob([buffer], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }),
                fname,
            );
            toast({
                title: "Report exported",
                description: `${fname} • ${weekBlocks.length} week${weekBlocks.length === 1 ? "" : "s"}`,
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

    // ── PDF export (professional weekly format) ─────────────────────────────
    const handleExportPdf = async () => {
        if (weekBlocks.length === 0) {
            toast({
                title: "Nothing to export",
                description: "Adjust filters — current selection has no gap data.",
                variant: "destructive",
            });
            return;
        }
        setExportingPdf(true);
        try {
            const doc = new jsPDF("portrait", "mm", "a4") as jsPDF & {
                lastAutoTable: { finalY: number };
            };
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const NAVY: [number, number, number] = [31, 56, 100];
            const ALT: [number, number, number] = [247, 249, 252];
            const NAVY_LIGHT: [number, number, number] = [232, 238, 246];
            const TOTAL_BG: [number, number, number] = [209, 250, 229];
            const TOTAL_TXT: [number, number, number] = [6, 95, 70];
            const generatedAt = fmtDateLong(new Date());

            const drawHeaderBand = (title: string) => {
                doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
                doc.rect(0, 0, pageWidth, 20, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(13);
                doc.text(title, 14, 13);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.text("Car Craft Co Fleet Management", pageWidth - 14, 13, {
                    align: "right",
                });
            };

            const drawSubLine = (label: string, y: number) => {
                doc.setTextColor(102, 102, 102);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(9);
                doc.text(
                    `Generated: ${generatedAt} • Car Craft Co Fleet Management`,
                    14,
                    y,
                );
                doc.setFont("helvetica", "bold");
                doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
                doc.text(label, pageWidth - 14, y, { align: "right" });
            };

            // Period grand total always leads; weekly pages follow when enabled.
            const periodLabel = `${filters.from} → ${filters.to}`;
            const renderBlocks = [
                {
                    title: "FLEET GAP DAYS — PERIOD TOTAL",
                    col2: "Period",
                    subLabel: periodLabel,
                    week: periodLabel,
                    rows: periodTotal.rows.map((r) => ({ ...r, week: periodLabel })),
                    totalDaysStanding: periodTotal.totalDaysStanding,
                    totalWorkingDays: periodTotal.totalWorkingDays,
                    pctStanding: periodTotal.pctStanding,
                    pctMinus5: periodTotal.pctMinus5,
                },
                ...(includeWeekly
                    ? weekBlocks.map((b) => ({
                        title: "FLEET GAP DAYS — WEEKLY",
                        col2: "Week",
                        subLabel: `Week ${b.week}`,
                        ...b,
                    }))
                    : []),
            ];

            for (let bIdx = 0; bIdx < renderBlocks.length; bIdx++) {
                const block = renderBlocks[bIdx];
                if (bIdx > 0) doc.addPage();

                drawHeaderBand(block.title);
                drawSubLine(block.subLabel, 28);

                const tableStartY = 34;
                autoTable(doc, {
                    startY: tableStartY,
                    head: [["Fleet", block.col2, "Gaps", "Total Gap Days", "Avg Gap Days"]],
                    body: block.rows.map((r) => [
                        r.fleet,
                        r.week,
                        fmt2(r.gaps),
                        fmt2(r.totalGapDays),
                        fmt2(r.avgGapDays),
                    ]),
                    theme: "grid",
                    styles: {
                        font: "helvetica",
                        fontSize: 9,
                        cellPadding: 2.6,
                        valign: "middle",
                        lineColor: [217, 217, 217],
                        lineWidth: 0.1,
                    },
                    headStyles: {
                        fillColor: NAVY,
                        textColor: 255,
                        fontStyle: "bold",
                        halign: "center",
                        fontSize: 9.5,
                    },
                    bodyStyles: { textColor: [17, 24, 39] },
                    alternateRowStyles: { fillColor: ALT },
                    columnStyles: {
                        0: { halign: "left", cellWidth: 28 },
                        1: { halign: "left", cellWidth: 44 },
                        2: { halign: "right", cellWidth: 26 },
                        3: { halign: "right", cellWidth: 36 },
                        4: { halign: "right", cellWidth: 32 },
                    },
                    margin: { left: 14, right: 14 },
                });

                let y = doc.lastAutoTable.finalY + 4;
                const valueColX = pageWidth - 14;
                const labelX = 14;

                // Total Days Standing Between Trips (highlighted band)
                const bandH = 8;
                doc.setFillColor(NAVY_LIGHT[0], NAVY_LIGHT[1], NAVY_LIGHT[2]);
                doc.rect(14, y, pageWidth - 28, bandH, "F");
                doc.setDrawColor(217, 217, 217);
                doc.setLineWidth(0.1);
                doc.rect(14, y, pageWidth - 28, bandH, "S");
                doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text("Total Days Standing Between Trips", labelX + 2, y + 5.5);
                doc.text(fmt2(block.totalDaysStanding), valueColX - 2, y + 5.5, {
                    align: "right",
                });
                y += bandH + 6;

                // Total Working Days
                doc.setTextColor(17, 24, 39);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text("Total Working Days", labelX, y);
                doc.text(fmt2(block.totalWorkingDays), valueColX, y, { align: "right" });
                y += 6;

                // Percentage of Days Standing
                doc.text("Percentage of Days Standing", labelX, y);
                doc.text(`${block.pctStanding}%`, valueColX, y, { align: "right" });
                y += 8;

                // Total Percentage -5% (highlighted)
                doc.setFillColor(TOTAL_BG[0], TOTAL_BG[1], TOTAL_BG[2]);
                doc.rect(14, y - 5, pageWidth - 28, 8, "F");
                doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
                doc.setLineWidth(0.3);
                doc.rect(14, y - 5, pageWidth - 28, 8, "S");
                doc.setTextColor(TOTAL_TXT[0], TOTAL_TXT[1], TOTAL_TXT[2]);
                doc.setFont("helvetica", "bold");
                doc.text("Total Percentage -5%", labelX + 2, y + 0.5);
                doc.text(`${block.pctMinus5}%`, valueColX - 2, y + 0.5, { align: "right" });
            }

            // Footer on every page
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setDrawColor(226, 232, 240);
                doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 120);
                doc.setFont("helvetica", "normal");
                doc.text(
                    "Car Craft Co Fleet Management • Fleet Gap Days",
                    14,
                    pageHeight - 6,
                );
                doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, {
                    align: "right",
                });
            }

            doc.save(`Fleet_Gap_Days_${includeWeekly ? "Weekly_" : "Total_"}${filters.from}_to_${filters.to}.pdf`);
            toast({
                title: "PDF report generated",
                description: `${weekBlocks.length} week${weekBlocks.length === 1 ? "" : "s"} • ${kpi.fleets} fleet${kpi.fleets === 1 ? "" : "s"}`,
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
                                Fleet Gap Days — Weekly Report
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                                Per-week summary of standing days by fleet, with utilisation totals.
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
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        Reporting Period
                                    </p>
                                    <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setPeriodMode("date")}
                                            className={`px-3 py-1 text-xs font-medium ${periodMode === "date"
                                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                                : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                }`}
                                        >
                                            Date
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Snap current from/to to ISO-week boundaries so
                                                // the week pickers show valid weeks immediately —
                                                // no need to click a Quick Range first.
                                                const fromWk = isoWeekToDateRange(
                                                    dateToIsoWeekInput(filters.from),
                                                );
                                                const toWk = isoWeekToDateRange(
                                                    dateToIsoWeekInput(filters.to),
                                                );
                                                if (fromWk && toWk) {
                                                    setFilters((p) => ({
                                                        ...p,
                                                        from: fromWk.from,
                                                        to: toWk.to,
                                                    }));
                                                }
                                                setPeriodMode("week");
                                            }}
                                            className={`px-3 py-1 text-xs font-medium ${periodMode === "week"
                                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                                : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                }`}
                                        >
                                            Week
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-end gap-3">
                                    {periodMode === "date" ? (
                                        <>
                                            <div className="flex flex-col">
                                                <Label className="text-xs text-slate-600 dark:text-slate-300 mb-1">
                                                    From
                                                </Label>
                                                <Input
                                                    type="date"
                                                    value={filters.from}
                                                    max={filters.to || undefined}
                                                    onChange={(e) =>
                                                        setFilters((p) => ({
                                                            ...p,
                                                            from: e.target.value,
                                                        }))
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
                                                        setFilters((p) => ({
                                                            ...p,
                                                            to: e.target.value,
                                                        }))
                                                    }
                                                    className="h-9 w-[160px]"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col">
                                            <Label className="text-xs text-slate-600 dark:text-slate-300 mb-1">
                                                Week
                                            </Label>
                                            <Input
                                                type="week"
                                                value={dateToIsoWeekInput(filters.from)}
                                                onChange={(e) => {
                                                    const r = isoWeekToDateRange(e.target.value);
                                                    if (r)
                                                        setFilters((p) => ({
                                                            ...p,
                                                            from: r.from,
                                                            to: r.to,
                                                        }));
                                                }}
                                                className="h-9 w-[180px]"
                                            />
                                            {filters.from && filters.to && (
                                                <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                    {filters.from} → {filters.to}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* One-click quick ranges */}
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {QUICK_RANGES.map((q) => {
                                        const r = q.range();
                                        const active =
                                            filters.from === r.from && filters.to === r.to;
                                        return (
                                            <button
                                                key={q.label}
                                                type="button"
                                                onClick={() => {
                                                    setPeriodMode("date");
                                                    setFilters((p) => ({
                                                        ...p,
                                                        from: r.from,
                                                        to: r.to,
                                                    }));
                                                }}
                                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${active
                                                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                                    }`}
                                            >
                                                {q.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Report contents */}
                                <label
                                    htmlFor="gapdays-include-weekly"
                                    className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                                >
                                    <Checkbox
                                        id="gapdays-include-weekly"
                                        checked={includeWeekly}
                                        onCheckedChange={(c) => setIncludeWeekly(c === true)}
                                    />
                                    Include week-by-week breakdown (the period total is always
                                    included)
                                </label>
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
                                    <KpiTile label="Weeks" value={kpi.weeks.toLocaleString()} />
                                    <KpiTile label="Fleets" value={kpi.fleets.toLocaleString()} />
                                    <KpiTile
                                        label="Gap Events"
                                        value={kpi.measured.toLocaleString()}
                                    />
                                    <KpiTile
                                        label="Total Gap Days"
                                        value={kpi.totalGapDays.toLocaleString()}
                                        accent="amber"
                                    />
                                </div>
                            </section>
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="flex w-full flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Period total first{includeWeekly ? ", then per-week blocks" : " (weekly breakdown off)"}: Fleet · Gaps · Total Gap Days · Avg Gap Days.
                        </p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleExport}
                                disabled={
                                    exporting || exportingPdf || loading || weekBlocks.length === 0
                                }
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
                                disabled={
                                    exporting || exportingPdf || loading || weekBlocks.length === 0
                                }
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