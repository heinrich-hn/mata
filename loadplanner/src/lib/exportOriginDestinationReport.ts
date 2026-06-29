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
    applyHeaderStyle,
    applyTitleRows,
    applyTotalRow,
} from "@/lib/exportStyles";
import {
    eachWeekOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    parseISO,
    startOfMonth,
    subMonths,
} from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

// Type extension for jspdf-autotable
interface jsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

export type TimeRange = "3months" | "6months" | "12months";
export type Granularity = "weekly" | "monthly";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    "3months": "3 Months",
    "6months": "6 Months",
    "12months": "12 Months",
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

/** Build the ordered list of time buckets for the selected range/granularity. */
export function buildBuckets(timeRange: TimeRange, granularity: Granularity): Bucket[] {
    const now = new Date();
    const months = monthsFor(timeRange);
    const startDate = subMonths(now, months);

    if (granularity === "weekly") {
        return eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 1 }).map(
            (weekStart) => ({
                key: format(weekStart, "yyyy-'W'II"),
                label: format(weekStart, "MMM d"),
                start: weekStart,
                end: endOfWeek(weekStart, { weekStartsOn: 1 }),
            }),
        );
    }

    const buckets: Bucket[] = [];
    for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        buckets.push({
            key: format(monthDate, "yyyy-MM"),
            label: format(monthDate, "MMM yy"),
            start: startOfMonth(monthDate),
            end: endOfMonth(monthDate),
        });
    }
    return buckets;
}

export function filterLoads(loads: Load[], timeRange: TimeRange): Load[] {
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
    timeRange: TimeRange = "3months",
    granularity: Granularity = "weekly",
): void {
    const data = filterLoads(loads, timeRange);
    const buckets = buildBuckets(timeRange, granularity);
    const origins = aggregate(data, buckets, "origin");
    const destinations = aggregate(data, buckets, "destination");
    const routes = buildRoutes(data);

    const wb = XLSX.utils.book_new();
    const periodLabel = `Last ${TIME_RANGE_LABELS[timeRange]}`;
    const generated = format(new Date(), "dd/MM/yyyy HH:mm");

    const buildBreakdownSheet = (
        rows: LocationBreakdown[],
        locationHeader: string,
        title: string,
    ): XLSX.WorkSheet => {
        const headerRow = [locationHeader, ...buckets.map((b) => b.label), "Total"];
        const colCount = headerRow.length;
        const ws = XLSX.utils.aoa_to_sheet([
            [`${COMPANY_NAME} — ${title}`],
            [`${SYSTEM_NAME} | ${periodLabel} | Generated: ${generated}`],
            [],
            headerRow,
        ]);
        const body = rows.map((r) => [r.location, ...r.counts, r.total]);
        const totalsRow = [
            "TOTAL",
            ...buckets.map((_, i) => rows.reduce((sum, r) => sum + r.counts[i], 0)),
            rows.reduce((sum, r) => sum + r.total, 0),
        ];
        XLSX.utils.sheet_add_aoa(ws, [...body, totalsRow], { origin: "A5" });

        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 3, colCount);
        applyTotalRow(ws, 4 + body.length, 0, colCount - 1);
        ws["!cols"] = [{ wch: 28 }, ...buckets.map(() => ({ wch: 9 })), { wch: 10 }];
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
    const wsRoutes = XLSX.utils.aoa_to_sheet([
        [`${COMPANY_NAME} — Origin → Destination Routes`],
        [`${SYSTEM_NAME} | ${periodLabel} | Generated: ${generated}`],
        [],
        routeHeader,
    ]);
    const routeBody = routes.map((r) => [r.origin, r.destination, r.loads]);
    routeBody.push(["TOTAL", "", routes.reduce((s, r) => s + r.loads, 0)]);
    XLSX.utils.sheet_add_aoa(wsRoutes, routeBody, { origin: "A5" });
    const routeMerges: XLSX.Range[] = [];
    applyTitleRows(wsRoutes, routeHeader.length, routeMerges);
    wsRoutes["!merges"] = routeMerges;
    applyHeaderStyle(wsRoutes, 3, routeHeader.length);
    applyTotalRow(wsRoutes, 4 + routes.length, 0, routeHeader.length - 1);
    wsRoutes["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsRoutes, "Routes");

    XLSX.writeFile(wb, `${fileSlug(timeRange, granularity)}.xlsx`);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export function exportOriginDestinationToPdf(
    loads: Load[],
    timeRange: TimeRange = "3months",
    granularity: Granularity = "weekly",
): void {
    const data = filterLoads(loads, timeRange);
    const buckets = buildBuckets(timeRange, granularity);
    const origins = aggregate(data, buckets, "origin");
    const destinations = aggregate(data, buckets, "destination");
    const routes = buildRoutes(data).slice(0, 25);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const generated = format(new Date(), "MMMM d, yyyy");

    // Header banner
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
    doc.text("ORIGIN & DESTINATION REPORT", pageWidth - 12, 14, { align: "right" });
    doc.setTextColor(...pdfColors.textMuted);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
        `Generated: ${generated} | Period: Last ${TIME_RANGE_LABELS[timeRange]} | ${granularity === "weekly" ? "Weekly" : "Monthly"}`,
        pageWidth - 12,
        19,
        { align: "right" },
    );
    doc.setDrawColor(...pdfColors.navy);
    doc.setLineWidth(0.5);
    doc.line(12, 23, pageWidth - 12, 23);

    let yPos = 30;

    const sectionTitle = (title: string) => {
        if (yPos > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            yPos = 20;
        }
        doc.setTextColor(...pdfColors.navy);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(title, 15, yPos);
        yPos += 6;
    };

    const breakdownTable = (rows: LocationBreakdown[], locationHeader: string) => {
        const head = [[locationHeader, ...buckets.map((b) => b.label), "Total"]];
        const body = rows.map((r) => [r.location, ...r.counts.map(String), String(r.total)]);
        body.push([
            "TOTAL",
            ...buckets.map((_, i) => String(rows.reduce((s, r) => s + r.counts[i], 0))),
            String(rows.reduce((s, r) => s + r.total, 0)),
        ]);
        autoTable(doc, {
            startY: yPos,
            head,
            body,
            theme: "grid",
            headStyles: { fillColor: pdfColors.navy, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
            bodyStyles: { fontSize: 7, textColor: pdfColors.textPrimary },
            alternateRowStyles: { fillColor: pdfColors.offWhite },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
            didParseCell: (hook) => {
                if (hook.row.index === body.length - 1) hook.cell.styles.fillColor = pdfColors.lightBlue;
            },
        });
        yPos = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 12;
    };

    sectionTitle("Loads Shipped by Origin");
    breakdownTable(origins, "Origin");

    sectionTitle("Loads Delivered by Destination");
    breakdownTable(destinations, "Destination");

    sectionTitle("Top Origin → Destination Routes");
    autoTable(doc, {
        startY: yPos,
        head: [["Origin", "Destination", "Loads"]],
        body: routes.map((r) => [r.origin, r.destination, String(r.loads)]),
        theme: "grid",
        headStyles: { fillColor: pdfColors.navy, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: pdfColors.textPrimary },
        alternateRowStyles: { fillColor: pdfColors.offWhite },
        columnStyles: { 2: { halign: "right", cellWidth: 30 } },
    });

    doc.save(`${fileSlug(timeRange, granularity)}.pdf`);
}
