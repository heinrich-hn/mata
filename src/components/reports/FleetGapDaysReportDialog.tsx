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
    nextDeparture: Date;
    gapDays: number;
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

// ISO 8601 week number (Monday-start, week containing Thursday belongs to that year).
const isoWeekKey = (d: Date): string => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

const fmtDateLong = (d: Date) =>
    d.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });

// Number formatting matching the user's example: "5.00", "12.00", etc.
const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

    // ── Build filtered gap rows + total fleets in scope ─────────────────────
    const { gapRows, totalFleetsInScope } = useMemo(() => {
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

        const fleetSet = new Set<string>();
        const byFleet = new Map<string, Trip[]>();
        for (const t of trips) {
            const fn = t.fleet_number!;
            fleetSet.add(fn);
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
                // Count calendar days strictly between prevEnd and currStart.
                // Example: prevEnd = 26/04, currStart = 28/04 → 1 gap day (27/04).
                // Same-day or next-day continuation → 0 gap days.
                const prevEndDay = Date.UTC(
                    prevEnd.getFullYear(),
                    prevEnd.getMonth(),
                    prevEnd.getDate(),
                );
                const currStartDay = Date.UTC(
                    currStart.getFullYear(),
                    currStart.getMonth(),
                    currStart.getDate(),
                );
                const dayDiff = Math.round((currStartDay - prevEndDay) / 86400000);
                const gap = Math.max(0, dayDiff - 1);
                rows.push({
                    fleet,
                    nextDeparture: currStart,
                    gapDays: gap,
                });
            }
        }
        return { gapRows: rows, totalFleetsInScope: fleetSet.size };
    }, [allTrips, filters]);

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

    const weekBlocks = useMemo<WeekBlock[]>(() => {
        const buckets = new Map<string, Map<string, { gaps: number; total: number }>>();
        for (const r of gapRows) {
            const wk = isoWeekKey(r.nextDeparture);
            if (!buckets.has(wk)) buckets.set(wk, new Map());
            const fleetMap = buckets.get(wk)!;
            const e = fleetMap.get(r.fleet) || { gaps: 0, total: 0 };
            e.gaps += 1;
            e.total += r.gapDays;
            fleetMap.set(r.fleet, e);
        }
        const sortedWeeks = [...buckets.keys()].sort().reverse(); // most recent first
        const totalWorkingDaysPerWeek = totalFleetsInScope * 7;
        return sortedWeeks.map((wk) => {
            const fleetMap = buckets.get(wk)!;
            const rows: FleetWeekRow[] = [...fleetMap.entries()]
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
    }, [gapRows, totalFleetsInScope]);

    // ── Live preview KPIs ───────────────────────────────────────────────────
    const kpi = useMemo(() => {
        const totalGapDays = gapRows.reduce((s, r) => s + r.gapDays, 0);
        return {
            measured: gapRows.length,
            fleets: totalFleetsInScope,
            weeks: weekBlocks.length,
            totalGapDays,
        };
    }, [gapRows, totalFleetsInScope, weekBlocks]);

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

            // Column widths (5 columns: Fleet | Week | Gaps | Total Gap Days | Avg Gap Days)
            ws.columns = [
                { width: 14 },
                { width: 14 },
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

            for (let bIdx = 0; bIdx < weekBlocks.length; bIdx++) {
                const block = weekBlocks[bIdx];

                // Title row
                ws.mergeCells(cursor, 1, cursor, 5);
                const titleCell = ws.getCell(cursor, 1);
                titleCell.value = "FLEET GAP DAYS — WEEKLY";
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
                headerRow.values = ["Fleet", "Week", "Gaps", "Total Gap Days", "Avg Gap Days"];
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

                // Spacer between weekly blocks
                if (bIdx < weekBlocks.length - 1) cursor += 3;
            }

            const fname = `Fleet_Gap_Days_Weekly_${filters.from}_to_${filters.to}.xlsx`;
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

            const drawHeaderBand = () => {
                doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
                doc.rect(0, 0, pageWidth, 20, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(13);
                doc.text("FLEET GAP DAYS — WEEKLY", 14, 13);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.text("Car Craft Co Fleet Management", pageWidth - 14, 13, {
                    align: "right",
                });
            };

            const drawSubLine = (week: string, y: number) => {
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
                doc.text(`Week ${week}`, pageWidth - 14, y, { align: "right" });
            };

            for (let bIdx = 0; bIdx < weekBlocks.length; bIdx++) {
                const block = weekBlocks[bIdx];
                if (bIdx > 0) doc.addPage();

                drawHeaderBand();
                drawSubLine(block.week, 28);

                const tableStartY = 34;
                autoTable(doc, {
                    startY: tableStartY,
                    head: [["Fleet", "Week", "Gaps", "Total Gap Days", "Avg Gap Days"]],
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
                        1: { halign: "left", cellWidth: 28 },
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

            doc.save(`Fleet_Gap_Days_Weekly_${filters.from}_to_${filters.to}.pdf`);
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
                            Per-week blocks: Fleet · Week · Gaps · Total Gap Days · Avg Gap Days, with utilisation totals.
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
