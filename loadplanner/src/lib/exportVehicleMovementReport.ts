/**
 * Vehicle Movement Report exporter.
 *
 * Builds a "vehicle entry/exit at locations" report from raw geofence events
 * and renders it to professionally styled Excel (xlsx-js-style) and PDF
 * (jsPDF + autoTable) documents that match the look of the other LoadPlan™
 * reports (see exportReportsToPdf.ts / exportTripsToExcel.ts).
 */

import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

import {
    BRAND,
    COMPANY_NAME,
    SYSTEM_NAME,
    pdfColors,
    xlHeader,
    xlMetricLabel,
    xlMetricValue,
} from "@/lib/exportStyles";

// Type extension for jspdf-autotable
interface jsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subset of the `geofence_events` table row used to build movement records. */
export interface RawGeofenceEvent {
    event_type: string;
    geofence_name: string | null;
    vehicle_registration: string | null;
    telematics_asset_id: string | null;
    event_time: string;
    load_number: string | null;
    source: string | null;
}

/** Resolved vehicle metadata keyed by telematics asset id and/or registration. */
export interface VehicleMeta {
    fleetNumber: string;
    registration: string;
    type: string;
}

/** A single visit: one vehicle's entry into and exit from a location. */
export interface MovementRecord {
    fleetNumber: string;
    registration: string;
    vehicleType: string;
    location: string;
    entryTime: string | null;
    exitTime: string | null;
    durationMinutes: number | null;
    loadNumber: string | null;
    source: string | null;
}

export interface MovementReportFilters {
    startDate: Date;
    endDate: Date;
    /** Selected fleet types (vehicle types), or "all". */
    fleetTypes: string[] | "all";
    /** Selected vehicles (fleet numbers), or "all". */
    vehicles: string[] | "all";
    /** Selected location names, or "all". */
    locations: string[] | "all";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEntry(eventType: string): boolean {
    return /entry|enter|arriv/i.test(eventType);
}

function isExit(eventType: string): boolean {
    return /exit|leav|depart/i.test(eventType);
}

function formatDuration(minutes: number | null): string {
    if (minutes === null || !isFinite(minutes) || minutes < 0) return "—";
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : format(d, "dd/MM/yyyy");
}

function fmtTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : format(d, "HH:mm");
}

/**
 * Pair entry/exit geofence events into movement records.
 *
 * Events are grouped by (vehicle, location) and walked in chronological order:
 * an `entry` opens a visit which is closed by the next `exit`. Unmatched
 * entries (still inside) and unmatched exits are surfaced as partial records so
 * no movement is silently dropped from the report.
 */
export function buildMovementRecords(
    events: RawGeofenceEvent[],
    resolveVehicle: (event: RawGeofenceEvent) => VehicleMeta,
): MovementRecord[] {
    // Group by vehicle key + location.
    const groups = new Map<
        string,
        { meta: VehicleMeta; location: string; events: RawGeofenceEvent[] }
    >();

    for (const ev of events) {
        const location = (ev.geofence_name || "Unknown Location").trim();
        const meta = resolveVehicle(ev);
        const vehicleKey =
            ev.telematics_asset_id ||
            ev.vehicle_registration ||
            meta.fleetNumber ||
            "unknown";
        const key = `${vehicleKey}::${location}`;
        let group = groups.get(key);
        if (!group) {
            group = { meta, location, events: [] };
            groups.set(key, group);
        }
        group.events.push(ev);
    }

    const records: MovementRecord[] = [];

    for (const group of groups.values()) {
        const sorted = [...group.events].sort(
            (a, b) =>
                new Date(a.event_time).getTime() - new Date(b.event_time).getTime(),
        );

        let openEntry: RawGeofenceEvent | null = null;

        const pushRecord = (
            entry: RawGeofenceEvent | null,
            exit: RawGeofenceEvent | null,
        ) => {
            const entryTime = entry?.event_time ?? null;
            const exitTime = exit?.event_time ?? null;
            let durationMinutes: number | null = null;
            if (entryTime && exitTime) {
                durationMinutes =
                    (new Date(exitTime).getTime() - new Date(entryTime).getTime()) /
                    60000;
            }
            records.push({
                fleetNumber: group.meta.fleetNumber,
                registration: group.meta.registration,
                vehicleType: group.meta.type,
                location: group.location,
                entryTime,
                exitTime,
                durationMinutes,
                loadNumber: (exit ?? entry)?.load_number ?? null,
                source: (entry ?? exit)?.source ?? null,
            });
        };

        for (const ev of sorted) {
            if (isEntry(ev.event_type)) {
                // A new entry before the previous one closed → record the open visit.
                if (openEntry) pushRecord(openEntry, null);
                openEntry = ev;
            } else if (isExit(ev.event_type)) {
                pushRecord(openEntry, ev);
                openEntry = null;
            }
            // Other event types (dwell, speeding, …) are ignored for this report.
        }

        if (openEntry) pushRecord(openEntry, null);
    }

    // Most recent activity first.
    records.sort((a, b) => {
        const at = new Date(a.entryTime || a.exitTime || 0).getTime();
        const bt = new Date(b.entryTime || b.exitTime || 0).getTime();
        return bt - at;
    });

    return records;
}

// ---------------------------------------------------------------------------
// Shared metadata helpers
// ---------------------------------------------------------------------------

function describeFilter(values: string[] | "all", allLabel: string): string {
    if (values === "all" || values.length === 0) return allLabel;
    if (values.length <= 3) return values.join(", ");
    return `${values.slice(0, 3).join(", ")} +${values.length - 3} more`;
}

function buildFilterSummary(filters: MovementReportFilters): string[] {
    return [
        `Date Range: ${format(filters.startDate, "dd/MM/yyyy")} – ${format(filters.endDate, "dd/MM/yyyy")}`,
        `Fleets: ${describeFilter(filters.fleetTypes, "All Fleets")}`,
        `Vehicles: ${describeFilter(filters.vehicles, "All Vehicles")}`,
        `Locations: ${describeFilter(filters.locations, "All Locations")}`,
    ];
}

function buildFilename(ext: string): string {
    return `Matanuska_Vehicle_Movement_Report_${format(new Date(), "yyyy-MM-dd")}.${ext}`;
}

// ---------------------------------------------------------------------------
// Aggregations — power the summary cards & breakdown tables
// ---------------------------------------------------------------------------

interface LocationStat {
    location: string;
    visits: number;
    completed: number;
    uniqueVehicles: number;
    totalDwellMin: number;
    avgDwellMin: number | null;
}

interface VehicleStat {
    fleetNumber: string;
    registration: string;
    vehicleType: string;
    visits: number;
    uniqueLocations: number;
    totalDwellMin: number;
    lastSeen: string | null;
}

interface ReportStats {
    total: number;
    completed: number;
    open: number;
    uniqueVehicles: number;
    uniqueLocations: number;
    totalDwellMin: number;
    avgDwellMin: number | null;
    longest: MovementRecord | null;
    byLocation: LocationStat[];
    byVehicle: VehicleStat[];
}

function computeStats(records: MovementRecord[]): ReportStats {
    const completedRecords = records.filter((r) => r.entryTime && r.exitTime);
    const totalDwellMin = records.reduce(
        (sum, r) => sum + (r.durationMinutes && r.durationMinutes > 0 ? r.durationMinutes : 0),
        0,
    );

    let longest: MovementRecord | null = null;
    for (const r of records) {
        if (r.durationMinutes != null && r.durationMinutes > 0) {
            if (!longest || r.durationMinutes > (longest.durationMinutes ?? 0)) longest = r;
        }
    }

    // By location.
    const locMap = new Map<string, { vehicles: Set<string>; rows: MovementRecord[] }>();
    for (const r of records) {
        let entry = locMap.get(r.location);
        if (!entry) {
            entry = { vehicles: new Set(), rows: [] };
            locMap.set(r.location, entry);
        }
        entry.vehicles.add(r.fleetNumber);
        entry.rows.push(r);
    }
    const byLocation: LocationStat[] = Array.from(locMap.entries())
        .map(([location, { vehicles, rows }]) => {
            const dwell = rows.reduce(
                (s, r) => s + (r.durationMinutes && r.durationMinutes > 0 ? r.durationMinutes : 0),
                0,
            );
            const completed = rows.filter((r) => r.entryTime && r.exitTime).length;
            return {
                location,
                visits: rows.length,
                completed,
                uniqueVehicles: vehicles.size,
                totalDwellMin: dwell,
                avgDwellMin: completed > 0 ? dwell / completed : null,
            };
        })
        .sort((a, b) => b.visits - a.visits);

    // By vehicle.
    const vehMap = new Map<
        string,
        { meta: MovementRecord; locations: Set<string>; rows: MovementRecord[]; lastSeen: number }
    >();
    for (const r of records) {
        const key = `${r.fleetNumber}::${r.registration}`;
        let entry = vehMap.get(key);
        if (!entry) {
            entry = { meta: r, locations: new Set(), rows: [], lastSeen: 0 };
            vehMap.set(key, entry);
        }
        entry.locations.add(r.location);
        entry.rows.push(r);
        const t = new Date(r.exitTime || r.entryTime || 0).getTime();
        if (t > entry.lastSeen) entry.lastSeen = t;
    }
    const byVehicle: VehicleStat[] = Array.from(vehMap.values())
        .map(({ meta, locations, rows, lastSeen }) => ({
            fleetNumber: meta.fleetNumber,
            registration: meta.registration,
            vehicleType: meta.vehicleType,
            visits: rows.length,
            uniqueLocations: locations.size,
            totalDwellMin: rows.reduce(
                (s, r) => s + (r.durationMinutes && r.durationMinutes > 0 ? r.durationMinutes : 0),
                0,
            ),
            lastSeen: lastSeen > 0 ? new Date(lastSeen).toISOString() : null,
        }))
        .sort((a, b) => b.visits - a.visits);

    return {
        total: records.length,
        completed: completedRecords.length,
        open: records.length - completedRecords.length,
        uniqueVehicles: new Set(records.map((r) => r.fleetNumber)).size,
        uniqueLocations: new Set(records.map((r) => r.location)).size,
        totalDwellMin,
        avgDwellMin: completedRecords.length > 0 ? totalDwellMin / completedRecords.length : null,
        longest,
        byLocation,
        byVehicle,
    };
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

const COLUMN_HEADERS = [
    "Fleet No",
    "Registration",
    "Fleet Type",
    "Location",
    "Entry Date",
    "Entry Time",
    "Exit Date",
    "Exit Time",
    "Duration",
    "Load No",
    "Source",
];

export function exportMovementReportToExcel(
    records: MovementRecord[],
    filters: MovementReportFilters,
): void {
    const workbook = XLSX.utils.book_new();
    const colCount = COLUMN_HEADERS.length;

    const reportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const summaryLines = buildFilterSummary(filters);

    // Title block (rows 0-3): company, title, subtitle, blank.
    const aoa: (string | number)[][] = [
        [COMPANY_NAME, ...Array(colCount - 1).fill("")],
        ["Vehicle Movement Report", ...Array(colCount - 1).fill("")],
        [`${summaryLines.join("  |  ")}  |  Generated: ${reportDate}`, ...Array(colCount - 1).fill("")],
        Array(colCount).fill(""),
        COLUMN_HEADERS,
    ];

    for (const r of records) {
        aoa.push([
            r.fleetNumber,
            r.registration,
            r.vehicleType,
            r.location,
            fmtDate(r.entryTime),
            fmtTime(r.entryTime),
            fmtDate(r.exitTime),
            fmtTime(r.exitTime),
            formatDuration(r.durationMinutes),
            r.loadNumber || "—",
            r.source || "—",
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws["!merges"] = merges;

    // Title styling
    const titleCompany = {
        font: { bold: true, sz: 12, color: { rgb: BRAND.white } },
        fill: { fgColor: { rgb: BRAND.navy } },
        alignment: { horizontal: "left" as const, vertical: "center" as const },
    };
    const titleMain = {
        font: { bold: true, sz: 18, color: { rgb: BRAND.white } },
        fill: { fgColor: { rgb: BRAND.navy } },
        alignment: { horizontal: "left" as const, vertical: "center" as const },
        border: { bottom: { style: "medium" as const, color: { rgb: BRAND.accent } } },
    };
    const titleSub = {
        font: { italic: true, sz: 9, color: { rgb: BRAND.white } },
        fill: { fgColor: { rgb: BRAND.navy } },
        alignment: { horizontal: "left" as const, vertical: "center" as const },
    };
    const A1 = XLSX.utils.encode_cell({ r: 0, c: 0 });
    const A2 = XLSX.utils.encode_cell({ r: 1, c: 0 });
    const A3 = XLSX.utils.encode_cell({ r: 2, c: 0 });
    if (ws[A1]) ws[A1].s = titleCompany;
    if (ws[A2]) ws[A2].s = titleMain;
    if (ws[A3]) ws[A3].s = titleSub;
    // Paint the merged title cells so the navy band spans full width.
    for (let c = 1; c < colCount; c++) {
        for (const [r, style] of [[0, titleCompany], [1, titleMain], [2, titleSub]] as const) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { v: "", t: "s" };
            ws[ref].s = style;
        }
    }
    const rows: XLSX.RowInfo[] = [];
    rows[0] = { hpt: 20 };
    rows[1] = { hpt: 30 };
    rows[2] = { hpt: 18 };
    ws["!rows"] = rows;

    // Header row (index 4)
    const headerRow = 4;
    for (let c = 0; c < colCount; c++) {
        const ref = XLSX.utils.encode_cell({ r: headerRow, c });
        if (ws[ref]) ws[ref].s = xlHeader;
    }

    // Data rows with alternating fills + borders
    const altA = { fill: { fgColor: { rgb: BRAND.white } } };
    const altB = { fill: { fgColor: { rgb: BRAND.offWhite } } };
    const dataBorder = {
        bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
        right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    };
    for (let i = 0; i < records.length; i++) {
        const r = headerRow + 1 + i;
        const fill = (i % 2 === 0 ? altA : altB).fill;
        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { v: "", t: "s" };
            ws[ref].s = {
                font: { sz: 10, color: { rgb: BRAND.charcoal } },
                fill,
                border: dataBorder,
                alignment: {
                    horizontal: (c === 8 ? "right" : "left") as "right" | "left",
                    vertical: "center" as const,
                },
            };
        }
    }

    ws["!cols"] = [
        { wch: 12 }, // Fleet No
        { wch: 14 }, // Registration
        { wch: 14 }, // Fleet Type
        { wch: 28 }, // Location
        { wch: 12 }, // Entry Date
        { wch: 10 }, // Entry Time
        { wch: 12 }, // Exit Date
        { wch: 10 }, // Exit Time
        { wch: 12 }, // Duration
        { wch: 14 }, // Load No
        { wch: 14 }, // Source
    ];

    XLSX.utils.book_append_sheet(workbook, ws, "Movement Detail");

    // Auto-filter across the detail table header + data rows.
    if (records.length > 0) {
        const lastRow = headerRow + records.length;
        ws["!autofilter"] = {
            ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({
                r: lastRow,
                c: colCount - 1,
            })}`,
        };
    }

    // ── Aggregations ────────────────────────────────────────────────────────
    const stats = computeStats(records);

    // Styled header applied to row 0 of a json_to_sheet worksheet.
    const styleSheetHeader = (sheet: XLSX.WorkSheet, cols: number) => {
        for (let c = 0; c < cols; c++) {
            const ref = XLSX.utils.encode_cell({ r: 0, c });
            if (sheet[ref]) sheet[ref].s = xlHeader;
        }
    };

    // ── Summary sheet ──────────────────────────────────────────────────────
    const summaryData: { Metric: string; Value: string | number }[] = [
        { Metric: "Total Movements", Value: stats.total },
        { Metric: "Completed Visits (Entry + Exit)", Value: stats.completed },
        { Metric: "Open Visits (No Exit)", Value: stats.open },
        { Metric: "Unique Vehicles", Value: stats.uniqueVehicles },
        { Metric: "Unique Locations", Value: stats.uniqueLocations },
        { Metric: "Total Dwell Time", Value: formatDuration(stats.totalDwellMin) },
        { Metric: "Average Dwell / Visit", Value: formatDuration(stats.avgDwellMin) },
        {
            Metric: "Longest Visit",
            Value: stats.longest
                ? `${stats.longest.fleetNumber} @ ${stats.longest.location} (${formatDuration(
                    stats.longest.durationMinutes,
                )})`
                : "—",
        },
        { Metric: "", Value: "" },
        ...summaryLines.map((line) => {
            const [k, ...rest] = line.split(": ");
            return { Metric: k, Value: rest.join(": ") };
        }),
        { Metric: "Report Generated", Value: reportDate },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 34 }, { wch: 52 }];
    styleSheetHeader(summarySheet, 2);
    for (let r = 1; r <= summaryData.length; r++) {
        const rA = XLSX.utils.encode_cell({ r, c: 0 });
        const rB = XLSX.utils.encode_cell({ r, c: 1 });
        if (summarySheet[rA] && summarySheet[rA].v !== "") summarySheet[rA].s = xlMetricLabel;
        if (summarySheet[rB] && summarySheet[rA]?.v !== "") {
            summarySheet[rB].s = { ...xlMetricValue, numFmt: "General" };
        }
    }
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // ── By Location sheet ────────────────────────────────────────────────
    const locationData = stats.byLocation.map((l) => ({
        Location: l.location,
        Visits: l.visits,
        Completed: l.completed,
        "Unique Vehicles": l.uniqueVehicles,
        "Total Dwell": formatDuration(l.totalDwellMin),
        "Avg Dwell / Visit": formatDuration(l.avgDwellMin),
    }));
    const locationSheet = XLSX.utils.json_to_sheet(
        locationData.length > 0
            ? locationData
            : [{ Location: "No data", Visits: "", Completed: "", "Unique Vehicles": "", "Total Dwell": "", "Avg Dwell / Visit": "" }],
    );
    locationSheet["!cols"] = [
        { wch: 32 },
        { wch: 10 },
        { wch: 12 },
        { wch: 16 },
        { wch: 14 },
        { wch: 18 },
    ];
    styleSheetHeader(locationSheet, 6);
    XLSX.utils.book_append_sheet(workbook, locationSheet, "By Location");

    // ── By Vehicle sheet ───────────────────────────────────────────────
    const vehicleData = stats.byVehicle.map((v) => ({
        "Fleet No": v.fleetNumber,
        Registration: v.registration,
        Type: v.vehicleType,
        Visits: v.visits,
        "Unique Locations": v.uniqueLocations,
        "Total Dwell": formatDuration(v.totalDwellMin),
        "Last Seen": v.lastSeen ? `${fmtDate(v.lastSeen)} ${fmtTime(v.lastSeen)}` : "—",
    }));
    const vehicleSheet = XLSX.utils.json_to_sheet(
        vehicleData.length > 0
            ? vehicleData
            : [{ "Fleet No": "No data", Registration: "", Type: "", Visits: "", "Unique Locations": "", "Total Dwell": "", "Last Seen": "" }],
    );
    vehicleSheet["!cols"] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 },
        { wch: 16 },
        { wch: 14 },
        { wch: 20 },
    ];
    styleSheetHeader(vehicleSheet, 7);
    XLSX.utils.book_append_sheet(workbook, vehicleSheet, "By Vehicle");

    // Use XLSX.write + Blob to avoid `fs` being pulled in by XLSX.writeFile in the browser.
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildFilename("xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PDF export
// ---------------------------------------------------------------------------

export function exportMovementReportToPdf(
    records: MovementRecord[],
    filters: MovementReportFilters,
): void {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const reportDate = format(new Date(), "MMMM d, yyyy");
    const reportTime = format(new Date(), "HH:mm");
    const primaryColor: [number, number, number] = pdfColors.navy;
    const textColor: [number, number, number] = pdfColors.textPrimary;
    const mutedColor: [number, number, number] = pdfColors.textMuted;

    const stats = computeStats(records);

    // ── Banner ───────────────────────────────────────────────────────────
    const bannerH = 24;
    doc.setFillColor(...pdfColors.navy);
    doc.rect(0, 0, pageWidth, bannerH, "F");
    // Accent underline strip.
    doc.setFillColor(...pdfColors.accent);
    doc.rect(0, bannerH, pageWidth, 1.2, "F");

    doc.setTextColor(...pdfColors.white);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, 12, 11);

    doc.setTextColor(...pdfColors.lightBlue);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(SYSTEM_NAME, 12, 17);

    doc.setTextColor(...pdfColors.white);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("VEHICLE MOVEMENT REPORT", pageWidth - 12, 11, { align: "right" });

    doc.setTextColor(...pdfColors.lightBlue);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${reportDate} ${reportTime}`, pageWidth - 12, 17, { align: "right" });

    let yPos = bannerH + 8;

    // ── Filter card ──────────────────────────────────────────────────────
    const filterLines = buildFilterSummary(filters);
    const filterCardH = 8 + filterLines.length * 4.6;
    doc.setFillColor(...pdfColors.offWhite);
    doc.setDrawColor(...pdfColors.gray);
    doc.setLineWidth(0.2);
    doc.roundedRect(12, yPos, pageWidth - 24, filterCardH, 1.5, 1.5, "FD");
    // Accent bar on the left edge.
    doc.setFillColor(...pdfColors.accent);
    doc.rect(12, yPos, 1.2, filterCardH, "F");

    doc.setTextColor(...primaryColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("REPORT FILTERS", 17, yPos + 5);

    doc.setTextColor(...textColor);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    let fy = yPos + 10;
    for (const line of filterLines) {
        doc.text(line, 17, fy);
        fy += 4.6;
    }
    yPos += filterCardH + 7;

    // ── Stat cards ───────────────────────────────────────────────────────
    const cards: { label: string; value: string; accent: [number, number, number] }[] = [
        { label: "Total Movements", value: String(stats.total), accent: pdfColors.navy },
        { label: "Completed Visits", value: String(stats.completed), accent: pdfColors.success },
        { label: "Open Visits", value: String(stats.open), accent: pdfColors.warning },
        { label: "Unique Vehicles", value: String(stats.uniqueVehicles), accent: pdfColors.blue },
        { label: "Unique Locations", value: String(stats.uniqueLocations), accent: pdfColors.teal },
        { label: "Total Dwell", value: formatDuration(stats.totalDwellMin), accent: pdfColors.purple },
        {
            label: "Avg Dwell / Visit",
            value: formatDuration(stats.avgDwellMin),
            accent: pdfColors.accent,
        },
    ];
    const gap = 4;
    const cardW = (pageWidth - 24 - gap * (cards.length - 1)) / cards.length;
    const cardH = 18;
    cards.forEach((card, i) => {
        const x = 12 + i * (cardW + gap);
        doc.setFillColor(...pdfColors.white);
        doc.setDrawColor(...pdfColors.gray);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, yPos, cardW, cardH, 1.5, 1.5, "FD");
        // Top accent strip.
        doc.setFillColor(...card.accent);
        doc.rect(x, yPos, cardW, 1.4, "F");

        doc.setTextColor(...card.accent);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text(card.value, x + cardW / 2, yPos + 9.5, { align: "center" });

        doc.setTextColor(...mutedColor);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.text(card.label.toUpperCase(), x + cardW / 2, yPos + 14.5, { align: "center" });
    });
    yPos += cardH + 10;

    // Shared accent section heading.
    const sectionHeading = (title: string) => {
        if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFillColor(...pdfColors.accent);
        doc.rect(12, yPos - 3.6, 1.4, 5, "F");
        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(title, 16, yPos);
        yPos += 4;
    };

    const sharedHeadStyles = {
        fillColor: primaryColor,
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: "bold" as const,
        fontSize: 9,
    };

    // ── Activity by Location ────────────────────────────────────────────
    sectionHeading("Activity by Location");
    autoTable(doc, {
        startY: yPos,
        head: [["Location", "Visits", "Completed", "Vehicles", "Total Dwell", "Avg Dwell"]],
        body: stats.byLocation.map((l) => [
            l.location,
            String(l.visits),
            String(l.completed),
            String(l.uniqueVehicles),
            formatDuration(l.totalDwellMin),
            formatDuration(l.avgDwellMin),
        ]),
        theme: "grid",
        headStyles: sharedHeadStyles,
        bodyStyles: { textColor, fontSize: 8 },
        alternateRowStyles: { fillColor: pdfColors.offWhite },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: "right", cellWidth: 24 },
            2: { halign: "right", cellWidth: 28 },
            3: { halign: "right", cellWidth: 26 },
            4: { halign: "right" },
            5: { halign: "right" },
        },
        margin: { left: 15, right: 15 },
    });
    yPos = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 9;

    // ── Activity by Vehicle ─────────────────────────────────────────────
    sectionHeading("Activity by Vehicle");
    autoTable(doc, {
        startY: yPos,
        head: [["Fleet No", "Registration", "Type", "Visits", "Locations", "Total Dwell", "Last Seen"]],
        body: stats.byVehicle.map((v) => [
            v.fleetNumber,
            v.registration,
            v.vehicleType,
            String(v.visits),
            String(v.uniqueLocations),
            formatDuration(v.totalDwellMin),
            v.lastSeen ? `${fmtDate(v.lastSeen)} ${fmtTime(v.lastSeen)}` : "—",
        ]),
        theme: "grid",
        headStyles: sharedHeadStyles,
        bodyStyles: { textColor, fontSize: 8 },
        alternateRowStyles: { fillColor: pdfColors.offWhite },
        columnStyles: {
            3: { halign: "right", cellWidth: 22 },
            4: { halign: "right", cellWidth: 24 },
            5: { halign: "right" },
        },
        margin: { left: 15, right: 15 },
    });
    yPos = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 9;

    // ── Movement detail table ───────────────────────────────────────────
    sectionHeading("Movement Detail");

    autoTable(doc, {
        startY: yPos,
        head: [[
            "Fleet No",
            "Registration",
            "Type",
            "Location",
            "Entry",
            "Exit",
            "Duration",
            "Load No",
        ]],
        body: records.map((r) => [
            r.fleetNumber,
            r.registration,
            r.vehicleType,
            r.location,
            r.entryTime ? `${fmtDate(r.entryTime)} ${fmtTime(r.entryTime)}` : "—",
            r.exitTime ? `${fmtDate(r.exitTime)} ${fmtTime(r.exitTime)}` : "—",
            formatDuration(r.durationMinutes),
            r.loadNumber || "—",
        ]),
        theme: "grid",
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
        },
        bodyStyles: { textColor, fontSize: 8 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 28 },
            2: { cellWidth: 24 },
            3: { cellWidth: 60 },
            4: { cellWidth: 38 },
            5: { cellWidth: 38 },
            6: { cellWidth: 24, halign: "right" },
            7: { cellWidth: 24 },
        },
        margin: { left: 15, right: 15 },
    });

    // Footer on each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text(
            `Page ${i} of ${pageCount} | ${SYSTEM_NAME} | Generated ${reportDate}`,
            pageWidth / 2,
            pageHeight - 6,
            { align: "center" },
        );
    }

    doc.save(buildFilename("pdf"));
}
