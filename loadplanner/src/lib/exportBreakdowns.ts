/**
 * Breakdown report exports — Excel (xlsx-js-style) and PDF (jsPDF + autoTable).
 *
 * Styled to match the other LoadPlan™ reports (see exportReportsToPdf.ts /
 * exportPunctualityToExcel.ts) so the look & feel stays consistent.
 *
 * Each report opens with a weekly summary showing the total number of
 * breakdowns per week and the percentage of breakdowns relative to the number
 * of loads completed (delivered) in that week, followed by a full detail table
 * of every breakdown record.
 */

import type { Load } from "@/hooks/useTrips";
import {
    COMPANY_NAME,
    SYSTEM_NAME,
    applyHeaderStyle,
    applyTitleRows,
    pdfColors,
    xlTotalRow,
} from "@/lib/exportStyles";
import {
    BREAKDOWN_STATUSES,
    type Breakdown,
} from "@/types/breakdown";
import {
    endOfWeek,
    format,
    getISOWeek,
    parseISO,
    startOfWeek,
} from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

// Type extension for jspdf-autotable
interface jsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

interface WeeklyBreakdownRow {
    label: string;
    sort: number;
    breakdowns: number;
    completedLoads: number;
    /** Breakdowns as a percentage of completed loads, or null when no loads. */
    rate: number | null;
}

function safeParse(d?: string | null): Date | null {
    if (!d) return null;
    try {
        const dt = parseISO(d);
        return Number.isNaN(dt.getTime()) ? null : dt;
    } catch {
        return null;
    }
}

function weekKeyLabel(d: Date): { key: string; label: string; sort: number } {
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    const isoWeek = getISOWeek(d);
    const key = `${format(start, "yyyy-'W'")}${String(isoWeek).padStart(2, "0")}`;
    const label = `Week ${isoWeek} (${format(start, "dd MMM")}–${format(end, "dd MMM yyyy")})`;
    return { key, label, sort: start.getTime() };
}

function statusLabel(status: string): string {
    return BREAKDOWN_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function titleCase(value: string): string {
    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtRate(rate: number | null): string {
    return rate === null ? "—" : `${rate.toFixed(1)}%`;
}

/**
 * Build the weekly summary: breakdowns per ISO week and the percentage of
 * breakdowns relative to loads completed (delivered) that week.
 */
function computeWeeklySummary(
    breakdowns: Breakdown[],
    loads: Load[],
): {
    rows: WeeklyBreakdownRow[];
    totals: { breakdowns: number; completedLoads: number; rate: number | null };
} {
    const map = new Map<
        string,
        { label: string; sort: number; breakdowns: number; completedLoads: number }
    >();

    const ensure = (key: string, label: string, sort: number) => {
        if (!map.has(key)) {
            map.set(key, { label, sort, breakdowns: 0, completedLoads: 0 });
        }
        return map.get(key)!;
    };

    for (const b of breakdowns) {
        const d = safeParse(b.breakdown_date);
        if (!d) continue;
        const { key, label, sort } = weekKeyLabel(d);
        ensure(key, label, sort).breakdowns += 1;
    }

    for (const l of loads) {
        if (l.status !== "delivered") continue;
        const d = safeParse(l.loading_date);
        if (!d) continue;
        const { key, label, sort } = weekKeyLabel(d);
        ensure(key, label, sort).completedLoads += 1;
    }

    const rows = Array.from(map.values())
        .sort((a, b) => a.sort - b.sort)
        .map<WeeklyBreakdownRow>((v) => ({
            label: v.label,
            sort: v.sort,
            breakdowns: v.breakdowns,
            completedLoads: v.completedLoads,
            rate: v.completedLoads > 0 ? (v.breakdowns / v.completedLoads) * 100 : null,
        }));

    const totalBreakdowns = breakdowns.length;
    const totalCompleted = loads.filter((l) => l.status === "delivered").length;
    const totals = {
        breakdowns: totalBreakdowns,
        completedLoads: totalCompleted,
        rate: totalCompleted > 0 ? (totalBreakdowns / totalCompleted) * 100 : null,
    };

    return { rows, totals };
}

function encodeCell(r: number, c: number): string {
    let col = "";
    let n = c;
    do {
        col = String.fromCharCode(65 + (n % 26)) + col;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return `${col}${r + 1}`;
}

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ─── Excel ──────────────────────────────────────────────────────────────────

export function exportBreakdownsToExcel(
    breakdowns: Breakdown[],
    loads: Load[],
): void {
    const wb = XLSX.utils.book_new();
    const { rows: weekly, totals } = computeWeeklySummary(breakdowns, loads);

    // -- Weekly Summary sheet --
    const summaryHeader = [
        "Week",
        "Breakdowns",
        "Loads Completed",
        "Breakdown Rate (%)",
    ];
    const summaryAoa: (string | number)[][] = [
        [`${COMPANY_NAME} — Breakdown Weekly Summary`],
        [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        [],
        summaryHeader,
    ];
    for (const w of weekly) {
        summaryAoa.push([
            w.label,
            w.breakdowns,
            w.completedLoads,
            fmtRate(w.rate),
        ]);
    }
    summaryAoa.push([
        "TOTAL",
        totals.breakdowns,
        totals.completedLoads,
        fmtRate(totals.rate),
    ]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
    const summaryMerges: XLSX.Range[] = [];
    applyTitleRows(summaryWs, summaryHeader.length, summaryMerges);
    summaryWs["!merges"] = summaryMerges;
    applyHeaderStyle(summaryWs, 3, summaryHeader.length);
    const summaryTotalRow = summaryAoa.length - 1;
    for (let c = 0; c < summaryHeader.length; c++) {
        const ref = encodeCell(summaryTotalRow, c);
        if (summaryWs[ref]) summaryWs[ref].s = xlTotalRow;
    }
    summaryWs["!cols"] = [
        { wch: 42 },
        { wch: 14 },
        { wch: 18 },
        { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, "Weekly Summary");

    // -- Breakdown detail sheet --
    const detailHeader = [
        "Breakdown #",
        "Date",
        "Vehicle",
        "Load",
        "Driver",
        "Category",
        "Severity",
        "Status",
        "Location",
        "Description",
        "Sent to Workshop",
        "Resolved At",
    ];
    const detailAoa: (string | number)[][] = [
        [`${COMPANY_NAME} — Breakdown Records`],
        [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        [],
        detailHeader,
    ];
    for (const b of breakdowns) {
        const d = safeParse(b.breakdown_date);
        const resolved = safeParse(b.resolved_at);
        detailAoa.push([
            b.breakdown_number,
            d ? format(d, "dd MMM yyyy HH:mm") : "—",
            b.fleet_vehicle?.vehicle_id ?? "—",
            b.load?.load_id ?? "—",
            b.driver?.name ?? "—",
            titleCase(b.category),
            titleCase(b.severity),
            statusLabel(b.status),
            b.location ?? "—",
            b.description ?? "",
            b.sent_to_main_app ? "Yes" : "No",
            resolved ? format(resolved, "dd MMM yyyy HH:mm") : "—",
        ]);
    }

    const detailWs = XLSX.utils.aoa_to_sheet(detailAoa);
    const detailMerges: XLSX.Range[] = [];
    applyTitleRows(detailWs, detailHeader.length, detailMerges);
    detailWs["!merges"] = detailMerges;
    applyHeaderStyle(detailWs, 3, detailHeader.length);
    detailWs["!cols"] = [
        { wch: 20 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 14 },
        { wch: 12 },
        { wch: 20 },
        { wch: 24 },
        { wch: 40 },
        { wch: 16 },
        { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, detailWs, "Breakdowns");

    const stamp = format(new Date(), "yyyyMMdd-HHmm");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerDownload(blob, `Breakdowns-${stamp}.xlsx`);
}

// ─── PDF ────────────────────────────────────────────────────────────────────

export function exportBreakdownsToPdf(
    breakdowns: Breakdown[],
    loads: Load[],
): void {
    const { rows: weekly, totals } = computeWeeklySummary(breakdowns, loads);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const primary: [number, number, number] = pdfColors.navy;
    const text: [number, number, number] = pdfColors.textPrimary;
    const reportDate = format(new Date(), "MMMM d, yyyy");

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
    doc.text("BREAKDOWN REPORT", pageWidth - 12, 14, { align: "right" });

    doc.setTextColor(...pdfColors.textMuted);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${reportDate}`, pageWidth - 12, 19, { align: "right" });

    doc.setDrawColor(...pdfColors.navy);
    doc.setLineWidth(0.5);
    doc.line(6, 23, pageWidth - 6, 23);

    // KPI summary block
    autoTable(doc, {
        startY: 28,
        head: [[
            { content: "Total Breakdowns", styles: { halign: "center" as const } },
            { content: "Loads Completed", styles: { halign: "center" as const } },
            { content: "Overall Breakdown Rate", styles: { halign: "center" as const } },
            { content: "Resolved", styles: { halign: "center" as const } },
        ]],
        body: [[
            String(totals.breakdowns),
            String(totals.completedLoads),
            fmtRate(totals.rate),
            String(breakdowns.filter((b) => b.status === "resolved").length),
        ]],
        theme: "grid",
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center", cellPadding: 2 },
        bodyStyles: { textColor: text, fontSize: 9, halign: "center", fontStyle: "bold", cellPadding: 2.5 },
        margin: { left: 6, right: 6 },
        tableWidth: pageWidth - 12,
    });

    let startY = ((doc as jsPDFWithAutoTable).lastAutoTable?.finalY ?? 28) + 6;

    // Weekly summary table
    doc.setTextColor(...pdfColors.navy);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Weekly Summary", 6, startY);
    startY += 2;

    const weeklyHead = [[
        { content: "Week", styles: { halign: "left" as const } },
        { content: "Breakdowns", styles: { halign: "center" as const } },
        { content: "Loads Completed", styles: { halign: "center" as const } },
        { content: "Breakdown Rate", styles: { halign: "center" as const } },
    ]];
    const weeklyBody: (string | number)[][] = weekly.map((w) => [
        w.label,
        w.breakdowns,
        w.completedLoads,
        fmtRate(w.rate),
    ]);
    weeklyBody.push([
        "TOTAL",
        totals.breakdowns,
        totals.completedLoads,
        fmtRate(totals.rate),
    ]);

    autoTable(doc, {
        startY,
        head: weeklyHead,
        body: weeklyBody,
        theme: "grid",
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center", cellPadding: 2 },
        bodyStyles: { textColor: text, fontSize: 8, cellPadding: 1.8 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
            0: { cellWidth: 90, fontStyle: "bold" },
            1: { halign: "center" },
            2: { halign: "center" },
            3: { halign: "center", fontStyle: "bold" },
        },
        didParseCell: (data) => {
            if (data.section === "body" && data.row.index === weeklyBody.length - 1) {
                data.cell.styles.fillColor = [229, 231, 235];
                data.cell.styles.fontStyle = "bold";
            }
        },
        margin: { left: 6, right: 6 },
        tableWidth: pageWidth - 12,
    });

    startY = ((doc as jsPDFWithAutoTable).lastAutoTable?.finalY ?? startY) + 6;

    // Detail table
    doc.setTextColor(...pdfColors.navy);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Breakdown Records", 6, startY);
    startY += 2;

    const detailHead = [[
        "Breakdown #", "Date", "Vehicle", "Load", "Driver",
        "Category", "Severity", "Status", "Location",
    ]];
    const detailBody: (string | number)[][] = breakdowns.map((b) => {
        const d = safeParse(b.breakdown_date);
        return [
            b.breakdown_number,
            d ? format(d, "dd MMM yy HH:mm") : "—",
            b.fleet_vehicle?.vehicle_id ?? "—",
            b.load?.load_id ?? "—",
            b.driver?.name ?? "—",
            titleCase(b.category),
            titleCase(b.severity),
            statusLabel(b.status),
            b.location ?? "—",
        ];
    });

    autoTable(doc, {
        startY,
        head: detailHead,
        body: detailBody.length > 0 ? detailBody : [["No breakdowns reported.", "", "", "", "", "", "", "", ""]],
        theme: "grid",
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, halign: "center", valign: "middle", cellPadding: 1.5 },
        bodyStyles: { textColor: text, fontSize: 7.5, cellPadding: 1.5, valign: "middle" },
        styles: { overflow: "linebreak", lineWidth: 0.1, lineColor: [200, 200, 200] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 6, right: 6 },
        tableWidth: pageWidth - 12,
        columnStyles: {
            0: { cellWidth: 30, fontStyle: "bold" },
            1: { cellWidth: 26, halign: "center" },
            2: { cellWidth: 22, halign: "center" },
            3: { cellWidth: 22, halign: "center" },
            5: { halign: "center" },
            6: { halign: "center" },
            7: { halign: "center" },
        },
        didParseCell: (data) => {
            if (data.section !== "body") return;
            // Severity colour coding
            if (data.column.index === 6) {
                const sev = String(data.cell.raw ?? "").toLowerCase();
                if (sev === "critical" || sev === "high") {
                    data.cell.styles.textColor = [185, 28, 28];
                    data.cell.styles.fontStyle = "bold";
                } else if (sev === "medium") {
                    data.cell.styles.textColor = [180, 83, 9];
                    data.cell.styles.fontStyle = "bold";
                }
            }
            // Status colour coding
            if (data.column.index === 7) {
                const status = String(data.cell.raw ?? "").toLowerCase();
                if (status === "resolved") {
                    data.cell.styles.textColor = [21, 128, 61];
                    data.cell.styles.fontStyle = "bold";
                }
            }
        },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(`Page ${i} of ${pageCount} | ${SYSTEM_NAME}`, pageWidth / 2, pageHeight - 6, { align: "center" });
    }

    doc.save(`Matanuska_Breakdowns_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
