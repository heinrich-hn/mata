/**
 * Subcontractor Loads & Cost Report exporter.
 *
 * Renders two professionally styled report types to Excel (xlsx-js-style) and
 * PDF (jsPDF + autoTable), matching the other LoadPlan™ reports:
 *   1. Subcontractor Loads — a detailed list of every subcontractor load with
 *      its agreed USD cost.
 *   2. Monthly Cost Report — loads and total cost grouped by month and
 *      subcontractor, with per-month subtotals and a grand total.
 */

import type { Load } from "@/hooks/useTrips";
import { parseTimeWindow } from "@/lib/timeWindow";
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
import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

/** Subcontractor info extracted from a load's time_window. */
export interface SubcontractorLoadInfo {
    supplierName: string;
    cargoDescription: string;
    cost: number;
}

/** Pull subcontractor name / cargo / cost from a load's time_window. */
export function getSubcontractorInfo(load: Load): SubcontractorLoadInfo {
    const sc = parseTimeWindow(load.time_window).subcontractor;
    return {
        supplierName: sc?.supplierName?.trim() || "Unassigned",
        cargoDescription: sc?.cargoDescription?.trim() || "",
        cost: typeof sc?.cost === "number" && !isNaN(sc.cost) ? sc.cost : 0,
    };
}

/** Safe date formatting that tolerates null / invalid dates. */
function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = parseISO(iso);
    return isNaN(d.getTime()) ? "—" : format(d, "dd MMM yyyy");
}

function monthKey(iso: string | null | undefined): { key: string; label: string } {
    if (!iso) return { key: "0000-00", label: "No Date" };
    const d = parseISO(iso);
    if (isNaN(d.getTime())) return { key: "0000-00", label: "No Date" };
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM yyyy") };
}

const currencyFmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const timestamp = () => format(new Date(), "yyyy-MM-dd");

// ────────────────────────────────────────────────────────────────────────────
// Shared row data
// ────────────────────────────────────────────────────────────────────────────

interface DetailRow {
    supplierName: string;
    loadId: string;
    origin: string;
    destination: string;
    loadingDate: string;
    offloadingDate: string;
    cargo: string;
    status: string;
    cost: number;
}

function buildDetailRows(loads: Load[]): DetailRow[] {
    return loads
        .map((load) => {
            const sc = getSubcontractorInfo(load);
            return {
                supplierName: sc.supplierName,
                loadId: load.load_id || "—",
                origin: load.origin || "Unknown",
                destination: load.destination || "Unknown",
                loadingDate: fmtDate(load.loading_date),
                offloadingDate: fmtDate(load.offloading_date || load.loading_date),
                cargo: sc.cargoDescription,
                status: load.status || "—",
                cost: sc.cost,
                _sortName: sc.supplierName.toLowerCase(),
                _sortDate: load.loading_date || "",
            };
        })
        .sort((a, b) =>
            a._sortName !== b._sortName
                ? a._sortName.localeCompare(b._sortName)
                : a._sortDate.localeCompare(b._sortDate),
        )
        .map(({ _sortName, _sortDate, ...row }) => {
            void _sortName;
            void _sortDate;
            return row;
        });
}

interface MonthlyGroup {
    monthKey: string;
    monthLabel: string;
    suppliers: { supplierName: string; loadCount: number; totalCost: number }[];
    loadCount: number;
    totalCost: number;
}

function buildMonthlyGroups(loads: Load[]): MonthlyGroup[] {
    const months = new Map<string, MonthlyGroup>();

    for (const load of loads) {
        const { key, label } = monthKey(load.loading_date);
        const sc = getSubcontractorInfo(load);

        let group = months.get(key);
        if (!group) {
            group = {
                monthKey: key,
                monthLabel: label,
                suppliers: [],
                loadCount: 0,
                totalCost: 0,
            };
            months.set(key, group);
        }

        let supplier = group.suppliers.find((s) => s.supplierName === sc.supplierName);
        if (!supplier) {
            supplier = { supplierName: sc.supplierName, loadCount: 0, totalCost: 0 };
            group.suppliers.push(supplier);
        }
        supplier.loadCount += 1;
        supplier.totalCost += sc.cost;
        group.loadCount += 1;
        group.totalCost += sc.cost;
    }

    const groups = Array.from(months.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    for (const g of groups) {
        g.suppliers.sort((a, b) => b.totalCost - a.totalCost);
    }
    return groups;
}

// ────────────────────────────────────────────────────────────────────────────
// Excel — detailed subcontractor loads
// ────────────────────────────────────────────────────────────────────────────

export function exportSubcontractorLoadsToExcel(loads: Load[]): void {
    const rows = buildDetailRows(loads);
    const generated = format(new Date(), "dd/MM/yyyy HH:mm");
    const subtitle = `${SYSTEM_NAME}  |  Subcontractor Loads  |  ${rows.length} load(s)  |  Generated: ${generated}`;

    const header = [
        "Supplier",
        "Load ID",
        "Origin",
        "Destination",
        "Loading Date",
        "Offloading Date",
        "Cargo",
        "Status",
        "Cost (USD)",
    ];
    const colCount = header.length;
    const costCol = colCount - 1;

    const ws = XLSX.utils.aoa_to_sheet([[], ["Subcontractor Loads"], [subtitle], [], header]);
    const body = rows.map((r) => [
        r.supplierName,
        r.loadId,
        r.origin,
        r.destination,
        r.loadingDate,
        r.offloadingDate,
        r.cargo,
        r.status,
        r.cost,
    ]);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const totalRow = ["TOTAL", "", "", "", "", "", "", "", totalCost];
    XLSX.utils.sheet_add_aoa(ws, [...body, totalRow], { origin: "A6" });

    const merges: XLSX.Range[] = [];
    applyTitleRows(ws, colCount, merges);
    ws["!merges"] = merges;
    applyHeaderStyle(ws, 4, colCount);

    const firstBodyRow = 5;
    const lastBodyRow = firstBodyRow + body.length - 1;
    for (let r = firstBodyRow; r <= lastBodyRow; r++) {
        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) continue;
            ws[ref].s =
                c === costCol
                    ? { ...xlNumericCell, numFmt: NUMBER_FORMATS.currency }
                    : { ...xlDataCell };
        }
    }
    if (body.length > 0) {
        applyAlternatingRowColors(ws, firstBodyRow, lastBodyRow, 0, colCount - 1);
    }

    const totalRowIdx = firstBodyRow + body.length;
    applyTotalRow(ws, totalRowIdx, 0, colCount - 1);
    const totalRef = XLSX.utils.encode_cell({ r: totalRowIdx, c: costCol });
    if (ws[totalRef]) ws[totalRef].s = { ...ws[totalRef].s, numFmt: NUMBER_FORMATS.currency };

    applyAutoFilter(ws, 4, colCount);
    freezeHeaderRow(ws, 5, 1);
    ws["!cols"] = [
        { wch: 24 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 26 },
        { wch: 12 },
        { wch: 14 },
    ];
    ws["!rows"] = [{ hpt: 18 }, { hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subcontractor Loads");
    XLSX.writeFile(wb, `subcontractor-loads-${timestamp()}.xlsx`);
}

// ────────────────────────────────────────────────────────────────────────────
// Excel — monthly cost report
// ────────────────────────────────────────────────────────────────────────────

export function exportSubcontractorMonthlyReportToExcel(loads: Load[]): void {
    const groups = buildMonthlyGroups(loads);
    const generated = format(new Date(), "dd/MM/yyyy HH:mm");
    const subtitle = `${SYSTEM_NAME}  |  Monthly Subcontractor Cost Report  |  Generated: ${generated}`;

    const header = ["Month", "Subcontractor", "# Loads", "Total Cost (USD)"];
    const colCount = header.length;
    const costCol = 3;
    const countCol = 2;

    const ws = XLSX.utils.aoa_to_sheet([
        [],
        ["Monthly Subcontractor Cost Report"],
        [subtitle],
        [],
        header,
    ]);

    type BodyRow = { cells: (string | number)[]; kind: "data" | "subtotal" };
    const bodyRows: BodyRow[] = [];
    for (const g of groups) {
        for (const s of g.suppliers) {
            bodyRows.push({
                cells: [g.monthLabel, s.supplierName, s.loadCount, s.totalCost],
                kind: "data",
            });
        }
        bodyRows.push({
            cells: [`${g.monthLabel} Subtotal`, "", g.loadCount, g.totalCost],
            kind: "subtotal",
        });
    }
    const grandLoads = groups.reduce((s, g) => s + g.loadCount, 0);
    const grandCost = groups.reduce((s, g) => s + g.totalCost, 0);
    const grandRow = ["GRAND TOTAL", "", grandLoads, grandCost];

    XLSX.utils.sheet_add_aoa(ws, [...bodyRows.map((r) => r.cells), grandRow], { origin: "A6" });

    const merges: XLSX.Range[] = [];
    applyTitleRows(ws, colCount, merges);
    ws["!merges"] = merges;
    applyHeaderStyle(ws, 4, colCount);

    const firstBodyRow = 5;
    bodyRows.forEach((row, i) => {
        const r = firstBodyRow + i;
        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) continue;
            const base =
                c === costCol
                    ? { ...xlNumericCell, numFmt: NUMBER_FORMATS.currency }
                    : c === countCol
                        ? { ...xlNumericCell, numFmt: NUMBER_FORMATS.integer }
                        : { ...xlDataCell };
            if (row.kind === "subtotal") {
                ws[ref].s = {
                    ...base,
                    font: { bold: true, color: { rgb: "1F3864" } },
                    fill: { patternType: "solid", fgColor: { rgb: "EAF1FB" } },
                };
            } else {
                ws[ref].s = base;
            }
        }
    });

    const grandIdx = firstBodyRow + bodyRows.length;
    applyTotalRow(ws, grandIdx, 0, colCount - 1);
    const grandCostRef = XLSX.utils.encode_cell({ r: grandIdx, c: costCol });
    if (ws[grandCostRef]) ws[grandCostRef].s = { ...ws[grandCostRef].s, numFmt: NUMBER_FORMATS.currency };
    const grandCountRef = XLSX.utils.encode_cell({ r: grandIdx, c: countCol });
    if (ws[grandCountRef]) ws[grandCountRef].s = { ...ws[grandCountRef].s, numFmt: NUMBER_FORMATS.integer };

    applyAutoFilter(ws, 4, colCount);
    freezeHeaderRow(ws, 5, 1);
    ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 18 }];
    ws["!rows"] = [{ hpt: 18 }, { hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Cost Report");
    XLSX.writeFile(wb, `subcontractor-monthly-cost-${timestamp()}.xlsx`);
}

// ────────────────────────────────────────────────────────────────────────────
// PDF helpers
// ────────────────────────────────────────────────────────────────────────────

function pdfHeader(doc: jsPDF, title: string, subtitle: string): number {
    const pageWidth = doc.internal.pageSize.getWidth();

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
    doc.text(title, pageWidth - 12, 12, { align: "right" });
    doc.setTextColor(...pdfColors.lightBlue);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth - 12, 18, { align: "right" });

    return 33;
}

function pdfKpiStrip(
    doc: jsPDF,
    top: number,
    kpis: { label: string; value: string }[],
): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const kpiH = 16;
    const gap = 4;
    const kpiW = (pageWidth - 24 - gap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((kpi, i) => {
        const x = 12 + i * (kpiW + gap);
        doc.setFillColor(...pdfColors.lightBlue);
        doc.setDrawColor(...pdfColors.blue);
        doc.setLineWidth(0.1);
        doc.roundedRect(x, top, kpiW, kpiH, 1.5, 1.5, "FD");
        doc.setFillColor(...pdfColors.accent);
        doc.rect(x, top, 1.4, kpiH, "F");
        doc.setTextColor(...pdfColors.navy);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + 5, top + 8);
        doc.setTextColor(...pdfColors.textMuted);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text(kpi.label.toUpperCase(), x + 5, top + 13);
    });
    return top + kpiH + 9;
}

function pdfFooter(doc: jsPDF): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
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
}

// ────────────────────────────────────────────────────────────────────────────
// PDF — detailed subcontractor loads
// ────────────────────────────────────────────────────────────────────────────

export function exportSubcontractorLoadsToPdf(loads: Load[]): void {
    const rows = buildDetailRows(loads);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const generated = format(new Date(), "MMMM d, yyyy");

    const yStart = pdfHeader(
        doc,
        "SUBCONTRACTOR LOADS",
        `Subcontractor Loads  •  Generated ${generated}`,
    );

    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const supplierCount = new Set(rows.map((r) => r.supplierName)).size;
    const yPos = pdfKpiStrip(doc, yStart, [
        { label: "Total Loads", value: rows.length.toLocaleString() },
        { label: "Subcontractors", value: supplierCount.toLocaleString() },
        { label: "Total Cost", value: currencyFmt(totalCost) },
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [
            [
                "Supplier",
                "Load ID",
                "Origin",
                "Destination",
                "Loading",
                "Offloading",
                "Cargo",
                "Status",
                "Cost (USD)",
            ],
        ],
        body: [
            ...rows.map((r) => [
                r.supplierName,
                r.loadId,
                r.origin,
                r.destination,
                r.loadingDate,
                r.offloadingDate,
                r.cargo,
                r.status,
                currencyFmt(r.cost),
            ]),
            ["TOTAL", "", "", "", "", "", "", "", currencyFmt(totalCost)],
        ],
        theme: "grid",
        margin: { left: 12, right: 12 },
        tableLineColor: pdfColors.lightGray,
        tableLineWidth: 0.1,
        headStyles: {
            fillColor: pdfColors.navy,
            textColor: pdfColors.white,
            fontSize: 7.5,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
        },
        bodyStyles: {
            fontSize: 7,
            textColor: pdfColors.textPrimary,
            lineColor: pdfColors.lightGray,
            lineWidth: 0.1,
        },
        alternateRowStyles: { fillColor: pdfColors.offWhite },
        columnStyles: {
            0: { fontStyle: "bold", textColor: pdfColors.navy, cellWidth: 36 },
            8: { halign: "right", cellWidth: 24 },
        },
        didParseCell: (hook) => {
            if (hook.section === "body" && hook.row.index === rows.length) {
                hook.cell.styles.fillColor = pdfColors.lightBlue;
                hook.cell.styles.fontStyle = "bold";
                hook.cell.styles.textColor = pdfColors.navy;
            }
        },
    });

    pdfFooter(doc);
    doc.save(`subcontractor-loads-${timestamp()}.pdf`);
}

// ────────────────────────────────────────────────────────────────────────────
// PDF — monthly cost report
// ────────────────────────────────────────────────────────────────────────────

export function exportSubcontractorMonthlyReportToPdf(loads: Load[]): void {
    const groups = buildMonthlyGroups(loads);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const generated = format(new Date(), "MMMM d, yyyy");

    const yStart = pdfHeader(
        doc,
        "MONTHLY COST REPORT",
        `Subcontractor Costs  •  Generated ${generated}`,
    );

    const grandLoads = groups.reduce((s, g) => s + g.loadCount, 0);
    const grandCost = groups.reduce((s, g) => s + g.totalCost, 0);
    const supplierCount = new Set(
        groups.flatMap((g) => g.suppliers.map((s) => s.supplierName)),
    ).size;
    const yPos = pdfKpiStrip(doc, yStart, [
        { label: "Months", value: groups.length.toLocaleString() },
        { label: "Subcontractors", value: supplierCount.toLocaleString() },
        { label: "Total Loads", value: grandLoads.toLocaleString() },
        { label: "Total Cost", value: currencyFmt(grandCost) },
    ]);

    type Row = { cells: string[]; kind: "data" | "subtotal" };
    const tableRows: Row[] = [];
    for (const g of groups) {
        for (const s of g.suppliers) {
            tableRows.push({
                cells: [g.monthLabel, s.supplierName, String(s.loadCount), currencyFmt(s.totalCost)],
                kind: "data",
            });
        }
        tableRows.push({
            cells: [`${g.monthLabel} Subtotal`, "", String(g.loadCount), currencyFmt(g.totalCost)],
            kind: "subtotal",
        });
    }
    tableRows.push({
        cells: ["GRAND TOTAL", "", String(grandLoads), currencyFmt(grandCost)],
        kind: "subtotal",
    });

    autoTable(doc, {
        startY: yPos,
        head: [["Month", "Subcontractor", "# Loads", "Total Cost (USD)"]],
        body: tableRows.map((r) => r.cells),
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
            0: { fontStyle: "bold", textColor: pdfColors.navy },
            2: { halign: "right", cellWidth: 24 },
            3: { halign: "right", cellWidth: 34 },
        },
        didParseCell: (hook) => {
            if (hook.section !== "body") return;
            const row = tableRows[hook.row.index];
            if (!row) return;
            const isGrand = hook.row.index === tableRows.length - 1;
            if (row.kind === "subtotal") {
                hook.cell.styles.fillColor = isGrand ? pdfColors.lightBlue : pdfColors.offWhite;
                hook.cell.styles.fontStyle = "bold";
                hook.cell.styles.textColor = pdfColors.navy;
            }
        },
    });

    pdfFooter(doc);
    doc.save(`subcontractor-monthly-cost-${timestamp()}.pdf`);
}
