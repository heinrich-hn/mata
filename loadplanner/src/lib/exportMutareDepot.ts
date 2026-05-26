/**
 * Mutare Depot Activity export — PDF & Excel.
 *
 * Matches the professional report styling used across LoadPlan
 * (see exportBackload.ts / exportStyles.ts).
 */
import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

import {
    COMPANY_NAME,
    SYSTEM_NAME,
    NUMBER_FORMATS,
    pdfColors,
    xlAltRowA,
    xlAltRowB,
    xlMetricLabel,
    xlMetricValue,
    xlTotalRow,
    applyHeaderStyle,
    applyTitleRows,
} from "@/lib/exportStyles";

import type { MutareDepotStay } from "@/hooks/useMutareDepotActivity";

export type MutareDepotTimeRange = "3months" | "6months" | "12months";

export interface MutareDepotSummary {
    totalStays: number;
    uniqueVehicles: number;
    currentlyInside: number;
    avgMinutes: number | null;
}

export interface MutareDepotExportData {
    stays: MutareDepotStay[];
    summary: MutareDepotSummary;
    startDate: Date;
    endDate: Date;
    timeRange: MutareDepotTimeRange;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function rangeLabel(range: MutareDepotTimeRange): string {
    if (range === "3months") return "Last 3 Months";
    if (range === "6months") return "Last 6 Months";
    return "Last 12 Months";
}

function formatDuration(minutes: number | null): string {
    if (minutes == null) return "—";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatTime(iso: string | null): string {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "yyyy-MM-dd HH:mm");
    } catch {
        return iso;
    }
}

function statusLabel(s: MutareDepotStay): string {
    if (s.stillInside) return "Inside";
    if (s.entryTime && s.exitTime) return "Completed";
    return "Partial";
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

function applyAltRows(
    ws: XLSX.WorkSheet,
    rStart: number,
    rEnd: number,
    colCount: number,
): void {
    for (let r = rStart; r <= rEnd; r++) {
        const style = (r - rStart) % 2 === 0 ? xlAltRowA : xlAltRowB;
        for (let c = 0; c < colCount; c++) {
            const ref = encodeCell(r, c);
            if (ws[ref] && !ws[ref].s) ws[ref].s = style;
        }
    }
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

export function exportMutareDepotToPdf(data: MutareDepotExportData): void {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const primary: [number, number, number] = pdfColors.navy;
    const sectionColor: [number, number, number] = [55, 90, 140];
    const text: [number, number, number] = pdfColors.textPrimary;
    const reportDate = format(new Date(), "MMMM d, yyyy");
    const subtitle = `${rangeLabel(data.timeRange)} · ${format(data.startDate, "dd MMM yyyy")} – ${format(data.endDate, "dd MMM yyyy")}`;

    // ── Header banner ────────────────────────────────────────────────────────
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
    doc.text("MUTARE DEPOT ACTIVITY REPORT", pageWidth - 12, 14, { align: "right" });

    doc.setTextColor(...pdfColors.textMuted);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${subtitle} · Generated: ${reportDate}`, pageWidth - 12, 19, {
        align: "right",
    });

    doc.setDrawColor(...pdfColors.navy);
    doc.setLineWidth(0.5);
    doc.line(6, 23, pageWidth - 6, 23);

    // ── Summary KPIs ─────────────────────────────────────────────────────────
    const s = data.summary;
    const kpiRows: [string, string][] = [
        ["Total Stays", String(s.totalStays)],
        ["Unique Trucks", String(s.uniqueVehicles)],
        ["Currently Inside", String(s.currentlyInside)],
        ["Average Stay", s.avgMinutes != null ? formatDuration(s.avgMinutes) : "—"],
    ];

    autoTable(doc, {
        startY: 28,
        head: [[
            {
                content: "Depot Activity Summary",
                colSpan: kpiRows.length,
                styles: {
                    fillColor: primary,
                    textColor: [255, 255, 255],
                    halign: "center",
                    fontStyle: "bold",
                },
            },
        ]],
        body: [
            kpiRows.map(([label]) => label),
            kpiRows.map(([, value]) => value),
        ],
        theme: "grid",
        headStyles: {
            fillColor: primary,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
        },
        bodyStyles: { textColor: text, fontSize: 9, halign: "center", cellPadding: 2 },
        didParseCell: (cell) => {
            if (cell.section === "body" && cell.row.index === 0) {
                cell.cell.styles.fillColor = [243, 244, 246];
                cell.cell.styles.fontStyle = "bold";
                cell.cell.styles.textColor = [55, 65, 81];
            }
            if (cell.section === "body" && cell.row.index === 1) {
                cell.cell.styles.fontSize = 12;
                cell.cell.styles.fontStyle = "bold";
                cell.cell.styles.textColor = primary;
            }
        },
        margin: { left: 6, right: 6 },
        tableWidth: pageWidth - 12,
    });

    let cursorY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
            .finalY + 6;

    // ── Per-vehicle aggregation ──────────────────────────────────────────────
    const perVehicle = new Map<
        string,
        { stays: number; totalMinutes: number; completed: number; inside: number }
    >();
    for (const stay of data.stays) {
        const agg = perVehicle.get(stay.vehicleRegistration) ?? {
            stays: 0,
            totalMinutes: 0,
            completed: 0,
            inside: 0,
        };
        agg.stays += 1;
        if (stay.stillInside) agg.inside += 1;
        if (stay.durationMinutes != null && !stay.stillInside) {
            agg.totalMinutes += stay.durationMinutes;
            agg.completed += 1;
        }
        perVehicle.set(stay.vehicleRegistration, agg);
    }

    if (perVehicle.size > 0) {
        const vehicleRows = Array.from(perVehicle.entries())
            .sort((a, b) => b[1].stays - a[1].stays)
            .map(([reg, agg]) => [
                reg,
                agg.stays,
                agg.inside,
                agg.completed
                    ? formatDuration(Math.round(agg.totalMinutes / agg.completed))
                    : "—",
                agg.completed ? formatDuration(agg.totalMinutes) : "—",
            ]);
        const totals = Array.from(perVehicle.values()).reduce(
            (acc, v) => {
                acc.stays += v.stays;
                acc.inside += v.inside;
                acc.totalMinutes += v.totalMinutes;
                acc.completed += v.completed;
                return acc;
            },
            { stays: 0, inside: 0, totalMinutes: 0, completed: 0 },
        );

        autoTable(doc, {
            startY: cursorY,
            head: [[
                "Vehicle",
                "Stays",
                "Currently Inside",
                "Avg Stay",
                "Total Time Inside",
            ]],
            body: [
                ...vehicleRows,
                [
                    { content: "TOTAL", styles: { fontStyle: "bold", fillColor: [243, 244, 246], halign: "left" } },
                    { content: totals.stays, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
                    { content: totals.inside, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
                    {
                        content: totals.completed
                            ? formatDuration(Math.round(totals.totalMinutes / totals.completed))
                            : "—",
                        styles: { fontStyle: "bold", fillColor: [243, 244, 246] },
                    },
                    {
                        content: totals.completed ? formatDuration(totals.totalMinutes) : "—",
                        styles: { fontStyle: "bold", fillColor: [243, 244, 246] },
                    },
                ],
            ],
            theme: "grid",
            headStyles: {
                fillColor: sectionColor,
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 9,
                halign: "center",
            },
            bodyStyles: { textColor: text, fontSize: 9, halign: "right", cellPadding: 1.8 },
            columnStyles: {
                0: { halign: "left", cellWidth: 50, fontStyle: "bold" },
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 6, right: 6 },
            tableWidth: pageWidth - 12,
        });
        cursorY =
            (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
                .finalY + 6;
    }

    // ── Stay detail (always last; large table) ───────────────────────────────
    if (data.stays.length > 0) {
        if (cursorY > pageHeight - 50) {
            doc.addPage();
            cursorY = 14;
        }
        doc.setTextColor(...pdfColors.navy);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Depot Stay Detail", 6, cursorY);
        cursorY += 4;

        autoTable(doc, {
            startY: cursorY,
            head: [[
                "Vehicle",
                "Entry Time",
                "Exit Time",
                "Duration",
                "Status",
            ]],
            body: data.stays.map((stay) => [
                stay.vehicleRegistration,
                formatTime(stay.entryTime),
                formatTime(stay.exitTime),
                formatDuration(stay.durationMinutes),
                statusLabel(stay),
            ]),
            theme: "grid",
            headStyles: {
                fillColor: primary,
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 9,
                halign: "center",
            },
            bodyStyles: { textColor: text, fontSize: 8.5, cellPadding: 1.6, valign: "middle" },
            styles: { overflow: "linebreak", lineColor: [200, 200, 200], lineWidth: 0.1 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            columnStyles: {
                0: { cellWidth: 50, fontStyle: "bold" },
                1: { cellWidth: 50, halign: "center" },
                2: { cellWidth: 50, halign: "center" },
                3: { cellWidth: 40, halign: "right" },
                4: { halign: "center" },
            },
            didParseCell: (cell) => {
                if (cell.section === "body" && cell.column.index === 4) {
                    const v = String(cell.cell.raw ?? "").toLowerCase();
                    if (v === "inside") {
                        cell.cell.styles.textColor = [194, 65, 12];
                        cell.cell.styles.fontStyle = "bold";
                    } else if (v === "completed") {
                        cell.cell.styles.textColor = [21, 128, 61];
                        cell.cell.styles.fontStyle = "bold";
                    } else {
                        cell.cell.styles.textColor = [107, 114, 128];
                    }
                }
            },
            margin: { left: 6, right: 6 },
            tableWidth: pageWidth - 12,
        });
    }

    // ── Footer (page numbers) ────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...pdfColors.textMuted);
        doc.text(
            `Page ${i} of ${pageCount} | ${SYSTEM_NAME}`,
            pageWidth / 2,
            pageHeight - 6,
            { align: "center" },
        );
    }

    doc.save(
        `Matanuska_MutareDepot_${data.timeRange}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
    );
}

// ─── Excel Export ───────────────────────────────────────────────────────────

export function exportMutareDepotToExcel(data: MutareDepotExportData): void {
    const wb = XLSX.utils.book_new();
    const subtitle = rangeLabel(data.timeRange);
    const generated = format(new Date(), "dd MMM yyyy HH:mm");
    const periodLabel = `${format(data.startDate, "dd MMM yyyy")} – ${format(data.endDate, "dd MMM yyyy")}`;

    // ── Sheet 1: Summary ─────────────────────────────────────────────────────
    {
        const colCount = 4;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, "", "", ""],
            [`Mutare Depot Activity — ${subtitle}`, "", "", ""],
            [`Period: ${periodLabel} · Generated: ${generated}`, "", "", ""],
            [],
            ["Metric", "Value", "Metric", "Value"],
            [
                "Total Stays",
                data.summary.totalStays,
                "Unique Trucks",
                data.summary.uniqueVehicles,
            ],
            [
                "Currently Inside",
                data.summary.currentlyInside,
                "Average Stay (minutes)",
                data.summary.avgMinutes ?? "",
            ],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;

        applyHeaderStyle(ws, 4, colCount);

        const xlMetricInt = { ...xlMetricValue, numFmt: NUMBER_FORMATS.integer };
        for (let r = 5; r <= 6; r++) {
            const lA = encodeCell(r, 0);
            const vA = encodeCell(r, 1);
            const lB = encodeCell(r, 2);
            const vB = encodeCell(r, 3);
            if (ws[lA]) ws[lA].s = xlMetricLabel;
            if (ws[vA]) ws[vA].s = xlMetricInt;
            if (ws[lB]) ws[lB].s = xlMetricLabel;
            if (ws[vB]) ws[vB].s = xlMetricInt;
        }

        ws["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 26 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, "Summary");
    }

    // ── Sheet 2: By Vehicle ──────────────────────────────────────────────────
    const perVehicle = new Map<
        string,
        { stays: number; totalMinutes: number; completed: number; inside: number }
    >();
    for (const stay of data.stays) {
        const agg = perVehicle.get(stay.vehicleRegistration) ?? {
            stays: 0,
            totalMinutes: 0,
            completed: 0,
            inside: 0,
        };
        agg.stays += 1;
        if (stay.stillInside) agg.inside += 1;
        if (stay.durationMinutes != null && !stay.stillInside) {
            agg.totalMinutes += stay.durationMinutes;
            agg.completed += 1;
        }
        perVehicle.set(stay.vehicleRegistration, agg);
    }

    if (perVehicle.size > 0) {
        const colCount = 5;
        const vehicleRows = Array.from(perVehicle.entries())
            .sort((a, b) => b[1].stays - a[1].stays)
            .map(([reg, agg]) => [
                reg,
                agg.stays,
                agg.inside,
                agg.completed
                    ? Math.round(agg.totalMinutes / agg.completed)
                    : "",
                agg.totalMinutes,
            ]);
        const totals = Array.from(perVehicle.values()).reduce(
            (acc, v) => {
                acc.stays += v.stays;
                acc.inside += v.inside;
                acc.totalMinutes += v.totalMinutes;
                acc.completed += v.completed;
                return acc;
            },
            { stays: 0, inside: 0, totalMinutes: 0, completed: 0 },
        );
        const totalRow: (string | number)[] = [
            "TOTAL",
            totals.stays,
            totals.inside,
            totals.completed ? Math.round(totals.totalMinutes / totals.completed) : "",
            totals.totalMinutes,
        ];

        const rows: (string | number)[][] = [
            [COMPANY_NAME, "", "", "", ""],
            [`Mutare Depot — By Vehicle (${subtitle})`, "", "", "", ""],
            [`Period: ${periodLabel} · Generated: ${generated}`, "", "", "", ""],
            [],
            [
                "Vehicle",
                "Stays",
                "Currently Inside",
                "Avg Stay (minutes)",
                "Total Time Inside (minutes)",
            ],
            ...vehicleRows,
            totalRow,
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + vehicleRows.length - 1, colCount);
        const totalRowIdx = 5 + vehicleRows.length;
        for (let c = 0; c < colCount; c++) {
            const ref = encodeCell(totalRowIdx, c);
            if (ws[ref]) ws[ref].s = xlTotalRow;
        }
        ws["!cols"] = [
            { wch: 18 },
            { wch: 10 },
            { wch: 16 },
            { wch: 18 },
            { wch: 24 },
        ];
        ws["!freeze"] = { xSplit: 0, ySplit: 5 };
        XLSX.utils.book_append_sheet(wb, ws, "By Vehicle");
    }

    // ── Sheet 3: Stay Detail ─────────────────────────────────────────────────
    if (data.stays.length > 0) {
        const colCount = 6;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, "", "", "", "", ""],
            [`Mutare Depot — Stay Detail (${subtitle})`, "", "", "", "", ""],
            [`Period: ${periodLabel} · Generated: ${generated}`, "", "", "", "", ""],
            [],
            [
                "Vehicle",
                "Entry Time",
                "Exit Time",
                "Duration (minutes)",
                "Duration",
                "Status",
            ],
            ...data.stays.map((stay) => [
                stay.vehicleRegistration,
                formatTime(stay.entryTime),
                formatTime(stay.exitTime),
                stay.durationMinutes ?? "",
                formatDuration(stay.durationMinutes),
                statusLabel(stay),
            ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + data.stays.length - 1, colCount);
        ws["!cols"] = [
            { wch: 18 },
            { wch: 20 },
            { wch: 20 },
            { wch: 16 },
            { wch: 14 },
            { wch: 14 },
        ];
        ws["!freeze"] = { xSplit: 0, ySplit: 5 };
        XLSX.utils.book_append_sheet(wb, ws, "Stay Detail");
    }

    XLSX.writeFile(
        wb,
        `Matanuska_MutareDepot_${data.timeRange}_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    );
}
