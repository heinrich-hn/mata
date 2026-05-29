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

    // ── Summary sheet ──────────────────────────────────────────────────────
    const uniqueVehicles = new Set(records.map((r) => r.fleetNumber)).size;
    const uniqueLocations = new Set(records.map((r) => r.location)).size;
    const completed = records.filter((r) => r.entryTime && r.exitTime).length;
    const totalDwell = records.reduce(
        (sum, r) => sum + (r.durationMinutes && r.durationMinutes > 0 ? r.durationMinutes : 0),
        0,
    );

    const summaryData: { Metric: string; Value: string | number }[] = [
        { Metric: "Total Movements", Value: records.length },
        { Metric: "Completed Visits (Entry + Exit)", Value: completed },
        { Metric: "Open Visits (No Exit)", Value: records.length - completed },
        { Metric: "Unique Vehicles", Value: uniqueVehicles },
        { Metric: "Unique Locations", Value: uniqueLocations },
        { Metric: "Total Dwell Time", Value: formatDuration(totalDwell) },
        { Metric: "", Value: "" },
        ...summaryLines.map((line) => {
            const [k, ...rest] = line.split(": ");
            return { Metric: k, Value: rest.join(": ") };
        }),
        { Metric: "Report Generated", Value: reportDate },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 32 }, { wch: 48 }];
    if (summarySheet["A1"]) summarySheet["A1"].s = xlHeader;
    if (summarySheet["B1"]) summarySheet["B1"].s = xlHeader;
    for (let r = 1; r <= summaryData.length; r++) {
        const rA = XLSX.utils.encode_cell({ r, c: 0 });
        const rB = XLSX.utils.encode_cell({ r, c: 1 });
        if (summarySheet[rA] && summarySheet[rA].v !== "") summarySheet[rA].s = xlMetricLabel;
        if (summarySheet[rB] && summarySheet[rA]?.v !== "") {
            summarySheet[rB].s = { ...xlMetricValue, numFmt: "General" };
        }
    }
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

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
    const primaryColor: [number, number, number] = pdfColors.navy;
    const textColor: [number, number, number] = pdfColors.textPrimary;
    const mutedColor: [number, number, number] = pdfColors.textMuted;

    // Header — corporate banner
    doc.setFillColor(...pdfColors.navy);
    doc.rect(0, 0, pageWidth, 3, "F");

    doc.setTextColor(...pdfColors.navy);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, 12, 14);

    doc.setTextColor(...pdfColors.textMuted);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(SYSTEM_NAME, 12, 19);

    doc.setTextColor(...pdfColors.navy);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("VEHICLE MOVEMENT REPORT", pageWidth - 12, 14, { align: "right" });

    doc.setTextColor(...pdfColors.textMuted);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${reportDate}`, pageWidth - 12, 19, { align: "right" });

    doc.setDrawColor(...pdfColors.navy);
    doc.setLineWidth(0.5);
    doc.line(12, 23, pageWidth - 12, 23);

    let yPos = 30;

    // Filter summary block
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Report Filters", 15, yPos);
    yPos += 6;

    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const line of buildFilterSummary(filters)) {
        doc.text(line, 15, yPos);
        yPos += 5;
    }
    yPos += 4;

    // Summary metrics
    const uniqueVehicles = new Set(records.map((r) => r.fleetNumber)).size;
    const uniqueLocations = new Set(records.map((r) => r.location)).size;
    const completed = records.filter((r) => r.entryTime && r.exitTime).length;

    autoTable(doc, {
        startY: yPos,
        head: [["Total Movements", "Completed Visits", "Open Visits", "Vehicles", "Locations"]],
        body: [
            [
                records.length.toString(),
                completed.toString(),
                (records.length - completed).toString(),
                uniqueVehicles.toString(),
                uniqueLocations.toString(),
            ],
        ],
        theme: "grid",
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
        },
        bodyStyles: { textColor, fontSize: 10, halign: "center" },
        margin: { left: 15, right: 15 },
    });

    yPos = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 10;

    // Movement detail table
    doc.setTextColor(...primaryColor);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Movement Detail", 15, yPos);
    yPos += 4;

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
