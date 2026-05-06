/**
 * Backload packaging analytics export to PDF and Excel.
 *
 * Supports three views:
 * - "total"  : Single summary view (no time-bucketing).
 * - "week"   : Aggregates movements grouped by ISO week.
 * - "month"  : Aggregates movements grouped by month.
 */
import {
    endOfWeek,
    format,
    parseISO,
    startOfWeek,
} from "date-fns";
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
    xlSectionHeader,
    xlTotalRow,
    applyHeaderStyle,
    applyTitleRows,
} from "@/lib/exportStyles";

import type {
    BackloadCargoTypeData,
    BackloadDestinationData,
    BackloadDistribution,
    BackloadMovement,
    BackloadRouteAnalysisItem,
    BackloadSummaryStats,
} from "@/components/reports/types";

export type BackloadExportView = "total" | "week" | "month";

export interface BackloadExportData {
    summary: BackloadSummaryStats;
    movements: BackloadMovement[];
    packagingDistribution: BackloadDistribution[];
    statusDistribution: BackloadDistribution[];
    destinationDistribution: BackloadDestinationData[];
    routeAnalysis: BackloadRouteAnalysisItem[];
    cargoTypeDistribution: BackloadCargoTypeData[];
}

interface PeriodBucket {
    key: string;
    label: string;
    movements: number;
    bins: number;
    crates: number;
    pallets: number;
    total: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function viewLabel(view: BackloadExportView): string {
    if (view === "week") return "Weekly Breakdown";
    if (view === "month") return "Monthly Breakdown";
    return "Total Summary";
}

function viewSlug(view: BackloadExportView): string {
    return view === "week" ? "Weekly" : view === "month" ? "Monthly" : "Total";
}

function safeParse(date: string): Date | null {
    try {
        const d = parseISO(date);
        return Number.isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

function bucketMovements(
    movements: BackloadMovement[],
    view: BackloadExportView,
): PeriodBucket[] {
    if (view === "total") return [];
    const map = new Map<string, PeriodBucket>();

    for (const m of movements) {
        const date = safeParse(m.offloadingDate);
        if (!date) continue;

        let key: string;
        let label: string;
        if (view === "week") {
            const start = startOfWeek(date, { weekStartsOn: 1 });
            const end = endOfWeek(date, { weekStartsOn: 1 });
            key = format(start, "yyyy-'W'II");
            label = `${format(start, "dd MMM")} – ${format(end, "dd MMM yyyy")}`;
        } else {
            key = format(date, "yyyy-MM");
            label = format(date, "MMMM yyyy");
        }

        const existing = map.get(key) ?? {
            key,
            label,
            movements: 0,
            bins: 0,
            crates: 0,
            pallets: 0,
            total: 0,
        };
        existing.movements += 1;
        existing.bins += m.quantities.bins || 0;
        existing.crates += m.quantities.crates || 0;
        existing.pallets += m.quantities.pallets || 0;
        existing.total = existing.bins + existing.crates + existing.pallets;
        map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

export function exportBackloadToPdf(
    data: BackloadExportData,
    view: BackloadExportView = "total",
): void {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const primary: [number, number, number] = pdfColors.navy;
    const sectionColor: [number, number, number] = [55, 90, 140];
    const text: [number, number, number] = pdfColors.textPrimary;
    const reportDate = format(new Date(), "MMMM d, yyyy");
    const subtitle = viewLabel(view);

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
    doc.text("BACKLOAD PACKAGING REPORT", pageWidth - 12, 14, { align: "right" });

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
        ["Total Movements", String(s.totalMovements)],
        ["Total Packaging", String(s.totalPackaging)],
        ["Bins", String(s.totalBins)],
        ["Crates", String(s.totalCrates)],
        ["Pallets", String(s.totalPallets)],
        ["Delivered", String(s.deliveredCount)],
        ["Delivery Rate", `${s.deliveryRate.toFixed(1)}%`],
        ["Unique Destinations", String(s.uniqueDestinations)],
    ];

    autoTable(doc, {
        startY: 28,
        head: [[
            { content: "Backload Summary", colSpan: 8, styles: { fillColor: primary, textColor: [255, 255, 255], halign: "center", fontStyle: "bold" } },
        ]],
        body: [
            kpiRows.map(([label]) => label),
            kpiRows.map(([, value]) => value),
        ],
        theme: "grid",
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "center" },
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

    let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    // ── Period Breakdown (week/month) ────────────────────────────────────────
    if (view !== "total") {
        const buckets = bucketMovements(data.movements, view);
        if (buckets.length > 0) {
            const totals = buckets.reduce(
                (acc, b) => {
                    acc.movements += b.movements;
                    acc.bins += b.bins;
                    acc.crates += b.crates;
                    acc.pallets += b.pallets;
                    acc.total += b.total;
                    return acc;
                },
                { movements: 0, bins: 0, crates: 0, pallets: 0, total: 0 },
            );

            autoTable(doc, {
                startY: cursorY,
                head: [
                    [
                        { content: view === "week" ? "Week" : "Month", styles: { halign: "left" } },
                        "Movements", "Bins", "Crates", "Pallets", "Total Packaging",
                    ],
                ],
                body: [
                    ...buckets.map((b) => [
                        b.label,
                        b.movements,
                        b.bins,
                        b.crates,
                        b.pallets,
                        b.total,
                    ]),
                    [
                        { content: "TOTAL", styles: { fontStyle: "bold", fillColor: [243, 244, 246], halign: "left" } },
                        { content: totals.movements, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
                        { content: totals.bins, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
                        { content: totals.crates, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
                        { content: totals.pallets, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
                        { content: totals.total, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
                    ],
                ],
                theme: "grid",
                headStyles: { fillColor: sectionColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "center" },
                bodyStyles: { textColor: text, fontSize: 9, halign: "right", cellPadding: 1.8 },
                columnStyles: {
                    0: { halign: "left", cellWidth: 50 },
                },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                margin: { left: 6, right: 6 },
                tableWidth: pageWidth - 12,
            });
            cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
        }
    }

    // ── Packaging Distribution + Status side-by-side ─────────────────────────
    if (data.packagingDistribution.length > 0 || data.statusDistribution.length > 0) {
        const halfWidth = (pageWidth - 12 - 4) / 2;

        if (data.packagingDistribution.length > 0) {
            autoTable(doc, {
                startY: cursorY,
                head: [["Packaging Type", "Quantity"]],
                body: data.packagingDistribution.map((d) => [d.name, d.value]),
                theme: "grid",
                headStyles: { fillColor: sectionColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
                bodyStyles: { textColor: text, fontSize: 9, cellPadding: 1.8 },
                columnStyles: { 1: { halign: "right" } },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                margin: { left: 6 },
                tableWidth: halfWidth,
            });
        }
        if (data.statusDistribution.length > 0) {
            autoTable(doc, {
                startY: cursorY,
                head: [["Status", "Count"]],
                body: data.statusDistribution.map((d) => [d.name, d.value]),
                theme: "grid",
                headStyles: { fillColor: sectionColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
                bodyStyles: { textColor: text, fontSize: 9, cellPadding: 1.8 },
                columnStyles: { 1: { halign: "right" } },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                margin: { left: 6 + halfWidth + 4 },
                tableWidth: halfWidth,
            });
        }
        const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
        cursorY = lastY + 6;
    }

    // ── Destination Distribution ─────────────────────────────────────────────
    if (data.destinationDistribution.length > 0) {
        if (cursorY > pageHeight - 50) {
            doc.addPage();
            cursorY = 14;
        }
        autoTable(doc, {
            startY: cursorY,
            head: [["Destination", "Movements", "Bins", "Crates", "Pallets"]],
            body: data.destinationDistribution.map((d) => [
                d.destination,
                d.totalMovements,
                d.bins,
                d.crates,
                d.pallets,
            ]),
            theme: "grid",
            headStyles: { fillColor: sectionColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
            bodyStyles: { textColor: text, fontSize: 9, cellPadding: 1.8 },
            columnStyles: {
                0: { halign: "left", cellWidth: 60 },
                1: { halign: "right" },
                2: { halign: "right" },
                3: { halign: "right" },
                4: { halign: "right" },
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 6, right: 6 },
            tableWidth: pageWidth - 12,
        });
        cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // ── Route Analysis ───────────────────────────────────────────────────────
    if (data.routeAnalysis.length > 0) {
        if (cursorY > pageHeight - 50) {
            doc.addPage();
            cursorY = 14;
        }
        autoTable(doc, {
            startY: cursorY,
            head: [["Route", "Loads", "Bins", "Crates", "Pallets", "Total Packaging"]],
            body: data.routeAnalysis.map((r) => [
                r.route,
                r.count,
                r.bins,
                r.crates,
                r.pallets,
                r.totalPackaging,
            ]),
            theme: "grid",
            headStyles: { fillColor: sectionColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
            bodyStyles: { textColor: text, fontSize: 9, cellPadding: 1.8 },
            columnStyles: {
                0: { halign: "left", cellWidth: 80 },
                1: { halign: "right" },
                2: { halign: "right" },
                3: { halign: "right" },
                4: { halign: "right" },
                5: { halign: "right", fontStyle: "bold" },
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 6, right: 6 },
            tableWidth: pageWidth - 12,
        });
        cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // ── Cargo Type Distribution ──────────────────────────────────────────────
    if (data.cargoTypeDistribution.length > 0) {
        if (cursorY > pageHeight - 40) {
            doc.addPage();
            cursorY = 14;
        }
        autoTable(doc, {
            startY: cursorY,
            head: [["Cargo Type", "Count"]],
            body: data.cargoTypeDistribution.map((c) => [c.cargoType, c.count]),
            theme: "grid",
            headStyles: { fillColor: sectionColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
            bodyStyles: { textColor: text, fontSize: 9, cellPadding: 1.8 },
            columnStyles: {
                0: { halign: "left", cellWidth: 80 },
                1: { halign: "right" },
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 6, right: 6 },
            tableWidth: pageWidth - 12,
        });
        cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // ── Movements detail (always last; large table) ──────────────────────────
    if (data.movements.length > 0) {
        doc.addPage();
        let detailY = 14;
        doc.setTextColor(...pdfColors.navy);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Backload Movements Detail", 6, detailY);
        detailY += 4;

        autoTable(doc, {
            startY: detailY,
            head: [[
                "Load ID", "Origin", "Destination", "Backload Dest", "Cargo", "Offload Date",
                "Bins", "Crates", "Pallets", "Total", "Status",
            ]],
            body: data.movements.map((m) => {
                const total = (m.quantities.bins || 0) + (m.quantities.crates || 0) + (m.quantities.pallets || 0);
                const dt = safeParse(m.offloadingDate);
                return [
                    m.loadId,
                    m.origin,
                    m.destination,
                    m.backloadDestination,
                    m.cargoType,
                    dt ? format(dt, "yyyy-MM-dd") : m.offloadingDate,
                    m.quantities.bins || 0,
                    m.quantities.crates || 0,
                    m.quantities.pallets || 0,
                    total,
                    m.status,
                ];
            }),
            theme: "grid",
            headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
            bodyStyles: { textColor: text, fontSize: 7.5, cellPadding: 1.4, valign: "middle" },
            styles: { overflow: "linebreak", lineColor: [200, 200, 200], lineWidth: 0.1 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            columnStyles: {
                0: { cellWidth: 24, fontStyle: "bold" },
                1: { cellWidth: 32 },
                2: { cellWidth: 32 },
                3: { cellWidth: 32 },
                4: { cellWidth: 26 },
                5: { cellWidth: 22, halign: "center" },
                6: { cellWidth: 14, halign: "right" },
                7: { cellWidth: 14, halign: "right" },
                8: { cellWidth: 14, halign: "right" },
                9: { cellWidth: 16, halign: "right", fontStyle: "bold" },
                10: { cellWidth: 22, halign: "center" },
            },
            didParseCell: (cell) => {
                if (cell.section === "body" && cell.column.index === 10) {
                    const status = String(cell.cell.raw ?? "").toLowerCase();
                    if (status === "delivered") {
                        cell.cell.styles.textColor = [21, 128, 61];
                        cell.cell.styles.fontStyle = "bold";
                    } else if (status === "pending") {
                        cell.cell.styles.textColor = [180, 83, 9];
                        cell.cell.styles.fontStyle = "bold";
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
        `Matanuska_Backload_${viewSlug(view)}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
    );
}

// ─── Excel Export ───────────────────────────────────────────────────────────

function encodeCell(r: number, c: number): string {
    let col = "";
    let n = c;
    do {
        col = String.fromCharCode(65 + (n % 26)) + col;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return `${col}${r + 1}`;
}

function styleRange(
    ws: XLSX.WorkSheet,
    rStart: number,
    cStart: number,
    rEnd: number,
    cEnd: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    style: any,
): void {
    for (let r = rStart; r <= rEnd; r++) {
        for (let c = cStart; c <= cEnd; c++) {
            const ref = encodeCell(r, c);
            if (ws[ref]) ws[ref].s = style;
            else ws[ref] = { v: "", t: "s", s: style };
        }
    }
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

export function exportBackloadToExcel(
    data: BackloadExportData,
    view: BackloadExportView = "total",
): void {
    const wb = XLSX.utils.book_new();
    const subtitle = viewLabel(view);
    const generated = format(new Date(), "dd MMM yyyy HH:mm");

    // ── Sheet 1: Summary ─────────────────────────────────────────────────────
    {
        const colCount = 4;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, "", "", ""],
            [`Backload Packaging Report — ${subtitle}`, "", "", ""],
            [`Generated: ${generated}`, "", "", ""],
            [],
            ["Key Performance Indicators", "", "", ""],
            ["Metric", "Value", "Metric", "Value"],
            ["Total Movements", data.summary.totalMovements, "Total Packaging", data.summary.totalPackaging],
            ["Bins", data.summary.totalBins, "Crates", data.summary.totalCrates],
            ["Pallets", data.summary.totalPallets, "Unique Destinations", data.summary.uniqueDestinations],
            ["Delivered", data.summary.deliveredCount, "Delivery Rate", ""],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;

        // Section header (row index 4)
        styleRange(ws, 4, 0, 4, colCount - 1, xlSectionHeader);
        merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } });

        // Header row (row index 5)
        applyHeaderStyle(ws, 5, colCount);

        // Metric pairs (rows 6-9) — labels in cols 0,2 and values in cols 1,3
        // Override numFmt on values so KPI counts render as integers / percentages,
        // not as USD currency (xlMetricValue defaults to currency formatting).
        const xlMetricInt = { ...xlMetricValue, numFmt: NUMBER_FORMATS.integer };
        const xlMetricPct = { ...xlMetricValue, numFmt: NUMBER_FORMATS.percentage1Dec };
        const valueFormats: Record<number, typeof xlMetricInt> = {
            // row -> style for the value cell at that row's value columns
            6: xlMetricInt, // Total Movements / Total Packaging
            7: xlMetricInt, // Bins / Crates
            8: xlMetricInt, // Pallets / Unique Destinations
            9: xlMetricInt, // Delivered (left) — Delivery Rate handled separately
        };
        for (let r = 6; r <= 9; r++) {
            const lA = encodeCell(r, 0);
            const vA = encodeCell(r, 1);
            const lB = encodeCell(r, 2);
            const vB = encodeCell(r, 3);
            if (ws[lA]) ws[lA].s = xlMetricLabel;
            if (ws[vA]) ws[vA].s = valueFormats[r];
            if (ws[lB]) ws[lB].s = xlMetricLabel;
            if (ws[vB]) ws[vB].s = valueFormats[r];
        }
        // Delivery Rate cell (row 9, col 3) is a percentage — store as fraction so
        // Excel formats it correctly with the percentage number format.
        const rateRef = encodeCell(9, 3);
        if (ws[rateRef]) {
            ws[rateRef].v = data.summary.deliveryRate / 100;
            ws[rateRef].t = "n";
            ws[rateRef].s = xlMetricPct;
        }

        ws["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, "Summary");
    }

    // ── Sheet 2: Period Breakdown ────────────────────────────────────────────
    if (view !== "total") {
        const buckets = bucketMovements(data.movements, view);
        const headerLabel = view === "week" ? "Week" : "Month";
        const colCount = 6;
        const headerRow = [headerLabel, "Movements", "Bins", "Crates", "Pallets", "Total Packaging"];
        const dataRows = buckets.map((b) => [
            b.label, b.movements, b.bins, b.crates, b.pallets, b.total,
        ]);
        const totals = buckets.reduce(
            (acc, b) => ({
                movements: acc.movements + b.movements,
                bins: acc.bins + b.bins,
                crates: acc.crates + b.crates,
                pallets: acc.pallets + b.pallets,
                total: acc.total + b.total,
            }),
            { movements: 0, bins: 0, crates: 0, pallets: 0, total: 0 },
        );
        const totalRow: (string | number)[] = ["TOTAL", totals.movements, totals.bins, totals.crates, totals.pallets, totals.total];

        const rows: (string | number)[][] = [
            [COMPANY_NAME, ...Array(colCount - 1).fill("")],
            [`Backload Packaging — ${subtitle}`, ...Array(colCount - 1).fill("")],
            [`Generated: ${generated}`, ...Array(colCount - 1).fill("")],
            [],
            headerRow,
            ...dataRows,
            totalRow,
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + dataRows.length - 1, colCount);
        // Total row styling
        const totalRowIdx = 5 + dataRows.length;
        for (let c = 0; c < colCount; c++) {
            const ref = encodeCell(totalRowIdx, c);
            if (ws[ref]) ws[ref].s = xlTotalRow;
        }

        ws["!cols"] = [
            { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, headerLabel === "Week" ? "Weekly" : "Monthly");
    }

    // ── Sheet 3: Packaging Distribution ──────────────────────────────────────
    if (data.packagingDistribution.length > 0) {
        const colCount = 2;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, ""],
            ["Packaging Distribution", ""],
            [`Generated: ${generated}`, ""],
            [],
            ["Packaging Type", "Quantity"],
            ...data.packagingDistribution.map((d) => [d.name, d.value]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + data.packagingDistribution.length - 1, colCount);
        ws["!cols"] = [{ wch: 22 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, "Packaging");
    }

    // ── Sheet 4: Status Distribution ─────────────────────────────────────────
    if (data.statusDistribution.length > 0) {
        const colCount = 2;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, ""],
            ["Status Distribution", ""],
            [`Generated: ${generated}`, ""],
            [],
            ["Status", "Count"],
            ...data.statusDistribution.map((d) => [d.name, d.value]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + data.statusDistribution.length - 1, colCount);
        ws["!cols"] = [{ wch: 22 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, "Status");
    }

    // ── Sheet 5: By Destination ──────────────────────────────────────────────
    if (data.destinationDistribution.length > 0) {
        const colCount = 5;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, "", "", "", ""],
            ["Backload by Destination", "", "", "", ""],
            [`Generated: ${generated}`, "", "", "", ""],
            [],
            ["Destination", "Movements", "Bins", "Crates", "Pallets"],
            ...data.destinationDistribution.map((d) => [d.destination, d.totalMovements, d.bins, d.crates, d.pallets]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + data.destinationDistribution.length - 1, colCount);
        ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws, "Destinations");
    }

    // ── Sheet 6: Route Analysis ──────────────────────────────────────────────
    if (data.routeAnalysis.length > 0) {
        const colCount = 6;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, "", "", "", "", ""],
            ["Backload Route Analysis", "", "", "", "", ""],
            [`Generated: ${generated}`, "", "", "", "", ""],
            [],
            ["Route", "Loads", "Bins", "Crates", "Pallets", "Total Packaging"],
            ...data.routeAnalysis.map((r) => [r.route, r.count, r.bins, r.crates, r.pallets, r.totalPackaging]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + data.routeAnalysis.length - 1, colCount);
        ws["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws, "Routes");
    }

    // ── Sheet 7: Cargo Types ─────────────────────────────────────────────────
    if (data.cargoTypeDistribution.length > 0) {
        const colCount = 2;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, ""],
            ["Cargo Type Distribution", ""],
            [`Generated: ${generated}`, ""],
            [],
            ["Cargo Type", "Count"],
            ...data.cargoTypeDistribution.map((c) => [c.cargoType, c.count]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + data.cargoTypeDistribution.length - 1, colCount);
        ws["!cols"] = [{ wch: 28 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, "Cargo Types");
    }

    // ── Sheet 8: Movements Detail ────────────────────────────────────────────
    if (data.movements.length > 0) {
        const colCount = 11;
        const rows: (string | number)[][] = [
            [COMPANY_NAME, ...Array(colCount - 1).fill("")],
            [`Backload Movements Detail — ${subtitle}`, ...Array(colCount - 1).fill("")],
            [`Generated: ${generated}`, ...Array(colCount - 1).fill("")],
            [],
            ["Load ID", "Origin", "Destination", "Backload Destination", "Cargo Type", "Offload Date",
                "Bins", "Crates", "Pallets", "Total", "Status"],
            ...data.movements.map((m) => {
                const total = (m.quantities.bins || 0) + (m.quantities.crates || 0) + (m.quantities.pallets || 0);
                const dt = safeParse(m.offloadingDate);
                return [
                    m.loadId, m.origin, m.destination, m.backloadDestination, m.cargoType,
                    dt ? format(dt, "yyyy-MM-dd") : m.offloadingDate,
                    m.quantities.bins || 0, m.quantities.crates || 0, m.quantities.pallets || 0,
                    total, m.status,
                ];
            }),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const merges: XLSX.Range[] = [];
        applyTitleRows(ws, colCount, merges);
        ws["!merges"] = merges;
        applyHeaderStyle(ws, 4, colCount);
        applyAltRows(ws, 5, 5 + data.movements.length - 1, colCount);
        ws["!cols"] = [
            { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 12 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
        ];
        ws["!freeze"] = { xSplit: 0, ySplit: 5 };
        XLSX.utils.book_append_sheet(wb, ws, "Movements");
    }

    XLSX.writeFile(
        wb,
        `Matanuska_Backload_${viewSlug(view)}_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    );
}
