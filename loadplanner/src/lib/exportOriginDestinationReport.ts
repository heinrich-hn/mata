/**
 * Origin & Destination Loads Report exporter.
 *
 * Builds a "loads shipped from each origin" and "loads delivered to each
 * destination" report, broken down by week or month across the selected time
 * range, and renders it to professionally styled Excel (xlsx-js-style) and PDF
 * (jsPDF + autoTable) documents matching the other LoadPlan™ reports
 * (see exportReportsToPdf.ts / exportVehicleMovementReport.ts).
 */

import type { Load } from "@/hooks/useTrips";
import {
    COMPANY_NAME,
    SYSTEM_NAME,
    pdfColors,
    NUMBER_FORMATS,
    xlDataCell,
    xlNumericCell,
    applyHeaderStyle,
    applyTitleRows,
    applyTotalRow,
    applyAlternatingRowColors,
    applyAutoFilter,
    freezeHeaderRow,
} from "@/lib/exportStyles";
import {
    eachWeekOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    parseISO,
    startOfMonth,
    subMonths,
    addMonths,
} from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

// Type extension for jspdf-autotable
interface jsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

export type TimeRange = "3months" | "6months" | "12months" | "all";
export type Granularity = "weekly" | "monthly";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    "3months": "3 Months",
    "6months": "6 Months",
    "12months": "12 Months",
    all: "All Time",
};

export interface Bucket {
    key: string;
    label: string;
    start: Date;
    end: Date;
}

/** A location's load counts per time bucket plus its total. */
export interface LocationBreakdown {
    location: string;
    counts: number[];
    total: number;
}

function monthsFor(timeRange: TimeRange): number {
    return timeRange === "3months" ? 3 : timeRange === "6months" ? 6 : 12;
}

/** Earliest valid loading_date among the loads, or the fallback when none. */
function earliestLoadingDate(loads: Load[], fallback: Date): Date {
    let earliest: Date | null = null;
    for (const load of loads) {
        const d = parseISO(load.loading_date);
        if (isNaN(d.getTime())) continue;
        if (!earliest || d < earliest) earliest = d;
    }
    return earliest ?? fallback;
}

/** Build the ordered list of time buckets for the selected range/granularity. */
export function buildBuckets(
    timeRange: TimeRange,
    granularity: Granularity,
    loads?: Load[],
): Bucket[] {
    const now = new Date();

    if (granularity === "weekly") {
        const weeklyStart =
            timeRange === "all"
                ? earliestLoadingDate(loads ?? [], now)
                : subMonths(now, monthsFor(timeRange));
        return eachWeekOfInterval({ start: weeklyStart, end: now }, { weekStartsOn: 1 }).map(
            (weekStart) => ({
                key: format(weekStart, "yyyy-'W'II"),
                label: format(weekStart, "MMM d"),
                start: weekStart,
                end: endOfWeek(weekStart, { weekStartsOn: 1 }),
            }),
        );
    }

    const monthlyStart =
        timeRange === "all"
            ? earliestLoadingDate(loads ?? [], now)
            : subMonths(now, monthsFor(timeRange) - 1);

    const buckets: Bucket[] = [];
    let cursor = startOfMonth(monthlyStart);
    const lastMonth = startOfMonth(now);
    while (cursor <= lastMonth) {
        buckets.push({
            key: format(cursor, "yyyy-MM"),
            label: format(cursor, "MMM yy"),
            start: startOfMonth(cursor),
            end: endOfMonth(cursor),
        });
        cursor = addMonths(cursor, 1);
    }
    return buckets;
}

export function filterLoads(loads: Load[], timeRange: TimeRange): Load[] {
    if (timeRange === "all") return [...loads];
    const now = new Date();
    const startDate = subMonths(now, monthsFor(timeRange));
    return loads.filter((load) => {
        const d = parseISO(load.loading_date);
        return d >= startDate && d <= now;
    });
}

/** Find the index of the bucket that contains the given ISO date, or -1. */
function bucketIndexFor(buckets: Bucket[], iso: string | null | undefined): number {
    if (!iso) return -1;
    const d = parseISO(iso);
    if (isNaN(d.getTime())) return -1;
    return buckets.findIndex((b) => d >= b.start && d <= b.end);
}

/**
 * Aggregate loads by a location field (origin/destination) across the buckets.
 * Origins are bucketed by loading_date, destinations by delivery date.
 */
export function aggregate(
    loads: Load[],
    buckets: Bucket[],
    field: "origin" | "destination",
): LocationBreakdown[] {
    const map = new Map<string, number[]>();
    for (const load of loads) {
        const location = (field === "origin" ? load.origin : load.destination) || "Unknown";
        const dateIso =
            field === "origin" ? load.loading_date : load.offloading_date || load.loading_date;
        const idx = bucketIndexFor(buckets, dateIso);
        if (idx === -1) continue;
        if (!map.has(location)) map.set(location, new Array(buckets.length).fill(0));
        map.get(location)![idx] += 1;
    }
    return Array.from(map.entries())
        .map(([location, counts]) => ({
            location,
            counts,
            total: counts.reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.total - a.total);
}

/** Build origin → destination route totals. */
export function buildRoutes(loads: Load[]): { origin: string; destination: string; loads: number }[] {
    const routes = new Map<string, number>();
    for (const load of loads) {
        const key = `${load.origin || "Unknown"}|||${load.destination || "Unknown"}`;
        routes.set(key, (routes.get(key) || 0) + 1);
    }
    return Array.from(routes.entries())
        .map(([key, count]) => {
            const [origin, destination] = key.split("|||");
            return { origin, destination, loads: count };
        })
        .sort((a, b) => b.loads - a.loads);
}

function fileSlug(timeRange: TimeRange, granularity: Granularity): string {
    return `Origin-Destination-${granularity}-${timeRange}-${format(new Date(), "yyyy-MM-dd")}`;
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

export function exportOriginDestinationToExcel(
    loads: Load[],
    timeRange: TimeRange = "all",
    granularity: Granularity = "weekly",
): void {
    const data = filterLoads(loads, timeRange);
    const buckets = buildBuckets(timeRange, granularity, data);
    const origins = aggregate(data, buckets, "origin");
    const destinations = aggregate(data, buckets, "destination");
    const routes = buildRoutes(data);

    const wb = XLSX.utils.book_new();
    const periodText = timeRange === "all" ? "All Time" : `Last ${TIME_RANGE_LABELS[timeRange]}`;
    const generated = format(new Date(), "dd/MM/yyyy HH:mm");
    const rangeText =
        buckets.length > 0
            ? `${buckets[0].label} – ${buckets[buckets.length - 1].label}`
            : "—";
    const subtitle = `${SYSTEM_NAME}  |  ${periodText} (${rangeText})  |  ${granularity === "weekly" ? "Weekly" : "Monthly"}  |  Generated: ${generated}`;
    const titleRowHeights = [{ hpt: 18 }, { hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    /** Style the data body: borders + integer format, then banded fills. */
    const styleBody = (
        ws: XLSX.WorkSheet,
        firstBodyRow: number,
        bodyRowCount: number,
        colCount: number,
        numericFromCol: number,
    ) => {
        const lastBodyRow = firstBodyRow + bodyRowCount - 1;
        for (let r = firstBodyRow; r <= lastBodyRow; r++) {
            for (let c = 0; c < colCount; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) continue;
                ws[ref].s =
                    c >= numericFromCol
                        ? { ...xlNumericCell, numFmt: NUMBER_FORMATS.integer }
                        : { ...xlDataCell };
            }
        }
        if (bodyRowCount > 0) {
            applyAlternatingRowColors(ws, firstBodyRow, lastBodyRow, 0, colCount - 1);
        }
    };

    const buildBreakdownSheet = (
        rows: LocationBreakdown[],
        locationHeader: string,
        title: string,
    ): XLSX.WorkSheet => {
        const headerRow = [locationHeader, ...buckets.map((b) => b.label), "Total"];
        const colCount = headerRow.length;
        // Row 0: company (top-right) · Row 1: title · Row 2: subtitle · Row 3: spacer · Row 4: header
        const ws = XLSX.utils.aoa_to_sheet([[], [title], [subtitle], [], headerRow]);
        const body = rows.map((r) => [r.location, ...r.counts, r.total]);
        const totalsRow = [
            "TOTAL",
            ...buckets.map((_, i) => rows.reduce((sum, r) => sum + r.counts[i], 0)),
            rows.reduce((sum, r) => sum + r.total, 0),
        ];
        XLSX.utils.sheet_add_aoa(ws, [...body, totalsRow], { origin: "A6" });

        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        styleBody(ws, 5, body.length, colCount, 1);

        const totalRowIdx = 5 + body.length;
        applyTotalRow(ws, totalRowIdx, 0, colCount - 1);
        for (let c = 1; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });
            if (ws[ref]) ws[ref].s = { ...ws[ref].s, numFmt: NUMBER_FORMATS.integer };
        }

        applyAutoFilter(ws, 4, colCount);
        freezeHeaderRow(ws, 5, 1);
        ws["!cols"] = [{ wch: 30 }, ...buckets.map(() => ({ wch: 9 })), { wch: 11 }];
        ws["!rows"] = titleRowHeights;
        return ws;
    };

    XLSX.utils.book_append_sheet(
        wb,
        buildBreakdownSheet(origins, "Origin", "Loads Shipped by Origin"),
        "By Origin",
    );
    XLSX.utils.book_append_sheet(
        wb,
        buildBreakdownSheet(destinations, "Destination", "Loads Delivered by Destination"),
        "By Destination",
    );

    // Routes sheet
    const routeHeader = ["Origin", "Destination", "Loads"];
    const routeColCount = routeHeader.length;
    const wsRoutes = XLSX.utils.aoa_to_sheet([
        [],
        ["Origin → Destination Routes"],
        [subtitle],
        [],
        routeHeader,
    ]);
    const routeBody = routes.map((r) => [r.origin, r.destination, r.loads]);
    const routeTotal = ["TOTAL", "", routes.reduce((s, r) => s + r.loads, 0)];
    XLSX.utils.sheet_add_aoa(wsRoutes, [...routeBody, routeTotal], { origin: "A6" });

    const routeMerges: XLSX.Range[] = [];
    applyTitleRows(wsRoutes, routeColCount, routeMerges);
    wsRoutes["!merges"] = routeMerges;
    applyHeaderStyle(wsRoutes, 4, routeColCount);
    styleBody(wsRoutes, 5, routeBody.length, routeColCount, 2);

    const routeTotalIdx = 5 + routeBody.length;
    applyTotalRow(wsRoutes, routeTotalIdx, 0, routeColCount - 1);
    const rtTotalRef = XLSX.utils.encode_cell({ r: routeTotalIdx, c: 2 });
    if (wsRoutes[rtTotalRef]) {
        wsRoutes[rtTotalRef].s = { ...wsRoutes[rtTotalRef].s, numFmt: NUMBER_FORMATS.integer };
    }

    applyAutoFilter(wsRoutes, 4, routeColCount);
    freezeHeaderRow(wsRoutes, 5);
    wsRoutes["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 12 }];
    wsRoutes["!rows"] = titleRowHeights;
    XLSX.utils.book_append_sheet(wb, wsRoutes, "Routes");

    XLSX.writeFile(wb, `${fileSlug(timeRange, granularity)}.xlsx`);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export function exportOriginDestinationToPdf(
    loads: Load[],
    timeRange: TimeRange = "all",
    granularity: Granularity = "weekly",
): void {
    const data = filterLoads(loads, timeRange);
    const buckets = buildBuckets(timeRange, granularity, data);
    const origins = aggregate(data, buckets, "origin");
    const destinations = aggregate(data, buckets, "destination");
    const routes = buildRoutes(data).slice(0, 25);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const generated = format(new Date(), "MMMM d, yyyy");
    const periodText = timeRange === "all" ? "All Time" : `Last ${TIME_RANGE_LABELS[timeRange]}`;
    const rangeText =
        buckets.length > 0 ? `${buckets[0].label} – ${buckets[buckets.length - 1].label}` : "—";
    const allRoutes = buildRoutes(data);

    // ── Header band ──────────────────────────────────────────────────────
    doc.setFillColor(...pdfColors.navy);
    doc.rect(0, 0, pageWidth, 26, "F");
    doc.setFillColor(...pdfColors.accent);
    doc.rect(0, 26, pageWidth, 1.2, "F");

    doc.setTextColor(...pdfColors.white);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, 12, 12);
    doc.setTextColor(...pdfColors.lightBlue);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(SYSTEM_NAME, 12, 18);

    doc.setTextColor(...pdfColors.white);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("ORIGIN & DESTINATION REPORT", pageWidth - 12, 12, { align: "right" });
    doc.setTextColor(...pdfColors.lightBlue);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(
        `${periodText} (${rangeText})  •  ${granularity === "weekly" ? "Weekly" : "Monthly"}  •  Generated ${generated}`,
        pageWidth - 12,
        18,
        { align: "right" },
    );

    // ── KPI strip ────────────────────────────────────────────────────────
    const kpis = [
        { label: "Total Loads", value: data.length.toLocaleString() },
        { label: "Origins", value: origins.length.toLocaleString() },
        { label: "Destinations", value: destinations.length.toLocaleString() },
        { label: "Routes", value: allRoutes.length.toLocaleString() },
    ];
    const kpiTop = 33;
    const kpiH = 16;
    const kpiGap = 4;
    const kpiW = (pageWidth - 24 - kpiGap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((kpi, i) => {
        const x = 12 + i * (kpiW + kpiGap);
        doc.setFillColor(...pdfColors.lightBlue);
        doc.setDrawColor(...pdfColors.blue);
        doc.setLineWidth(0.1);
        doc.roundedRect(x, kpiTop, kpiW, kpiH, 1.5, 1.5, "FD");
        doc.setFillColor(...pdfColors.accent);
        doc.rect(x, kpiTop, 1.4, kpiH, "F");
        doc.setTextColor(...pdfColors.navy);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + 5, kpiTop + 8);
        doc.setTextColor(...pdfColors.textMuted);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text(kpi.label.toUpperCase(), x + 5, kpiTop + 13);
    });

    let yPos = kpiTop + kpiH + 9;

    const sectionTitle = (title: string) => {
        if (yPos > pageHeight - 32) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFillColor(...pdfColors.navy);
        doc.rect(12, yPos - 4.5, 2.4, 6, "F");
        doc.setTextColor(...pdfColors.navy);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, 17, yPos);
        yPos += 5;
    };

    const breakdownTable = (rows: LocationBreakdown[], locationHeader: string) => {
        const head = [[locationHeader, ...buckets.map((b) => b.label), "Total"]];
        const body = rows.map((r) => [
            r.location,
            ...r.counts.map((n) => n.toLocaleString()),
            r.total.toLocaleString(),
        ]);
        body.push([
            "TOTAL",
            ...buckets.map((_, i) => rows.reduce((s, r) => s + r.counts[i], 0).toLocaleString()),
            rows.reduce((s, r) => s + r.total, 0).toLocaleString(),
        ]);
        const numericCols: Record<number, { halign: "right" }> = {};
        for (let c = 1; c <= buckets.length + 1; c++) numericCols[c] = { halign: "right" };
        autoTable(doc, {
            startY: yPos,
            head,
            body,
            theme: "grid",
            margin: { left: 12, right: 12 },
            tableLineColor: pdfColors.lightGray,
            tableLineWidth: 0.1,
            headStyles: {
                fillColor: pdfColors.navy,
                textColor: pdfColors.white,
                fontSize: 7,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                lineColor: pdfColors.navy,
                lineWidth: 0.1,
            },
            bodyStyles: {
                fontSize: 7,
                textColor: pdfColors.textPrimary,
                lineColor: pdfColors.lightGray,
                lineWidth: 0.1,
            },
            alternateRowStyles: { fillColor: pdfColors.offWhite },
            columnStyles: {
                0: { fontStyle: "bold", textColor: pdfColors.navy, cellWidth: 40 },
                ...numericCols,
            },
            didParseCell: (hook) => {
                if (hook.section === "body" && hook.row.index === body.length - 1) {
                    hook.cell.styles.fillColor = pdfColors.lightBlue;
                    hook.cell.styles.fontStyle = "bold";
                    hook.cell.styles.textColor = pdfColors.navy;
                }
            },
        });
        yPos = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 11;
    };

    sectionTitle("Loads Shipped by Origin");
    breakdownTable(origins, "Origin");

    sectionTitle("Loads Delivered by Destination");
    breakdownTable(destinations, "Destination");

    sectionTitle("Top Origin → Destination Routes");
    autoTable(doc, {
        startY: yPos,
        head: [["#", "Origin", "Destination", "Loads"]],
        body: routes.map((r, i) => [
            String(i + 1),
            r.origin,
            r.destination,
            r.loads.toLocaleString(),
        ]),
        theme: "grid",
        margin: { left: 12, right: 12 },
        tableLineColor: pdfColors.lightGray,
        tableLineWidth: 0.1,
        headStyles: {
            fillColor: pdfColors.navy,
            textColor: pdfColors.white,
            fontSize: 9,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
        },
        bodyStyles: {
            fontSize: 8,
            textColor: pdfColors.textPrimary,
            lineColor: pdfColors.lightGray,
            lineWidth: 0.1,
        },
        alternateRowStyles: { fillColor: pdfColors.offWhite },
        columnStyles: {
            0: { halign: "center", cellWidth: 14, textColor: pdfColors.textMuted },
            1: { fontStyle: "bold", textColor: pdfColors.navy },
            3: { halign: "right", cellWidth: 30 },
        },
    });

    // ── Footer (page numbers) ────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...pdfColors.gray);
        doc.setLineWidth(0.1);
        doc.line(12, pageHeight - 9, pageWidth - 12, pageHeight - 9);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(`${COMPANY_NAME}  •  ${SYSTEM_NAME}`, 12, pageHeight - 5);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 12, pageHeight - 5, { align: "right" });
    }

    doc.save(`${fileSlug(timeRange, granularity)}.pdf`);
}
