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

export type Currency = "USD" | "ZAR";

/** Subcontractor info extracted from a load's time_window. */
export interface SubcontractorLoadInfo {
    supplierName: string;
    cargoDescription: string;
    cost: number;
    currency: Currency;
}

/** Pull subcontractor name / cargo / cost / currency from a load's time_window. */
export function getSubcontractorInfo(load: Load): SubcontractorLoadInfo {
    const sc = parseTimeWindow(load.time_window).subcontractor;
    return {
        supplierName: sc?.supplierName?.trim() || "Unassigned",
        cargoDescription: sc?.cargoDescription?.trim() || "",
        cost: typeof sc?.cost === "number" && !isNaN(sc.cost) ? sc.cost : 0,
        currency: sc?.costCurrency === "ZAR" ? "ZAR" : "USD",
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

const currencySymbol = (currency: Currency) => (currency === "ZAR" ? "R" : "$");

const currencyFmt = (n: number, currency: Currency = "USD") =>
    `${currencySymbol(currency)}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const USD_FMT = NUMBER_FORMATS.currency;
const ZAR_FMT = '"R"#,##0.00_);[Red]("R"#,##0.00)';
const costNumFmt = (currency: Currency) => (currency === "ZAR" ? ZAR_FMT : USD_FMT);

const CURRENCY_ORDER: Currency[] = ["USD", "ZAR"];

/** Group a list of {currency, cost} entries into per-currency totals, sorted USD first. */
function sumByCurrency(
    items: { currency: Currency; cost: number }[],
): { currency: Currency; loadCount: number; total: number }[] {
    const map = new Map<Currency, { currency: Currency; loadCount: number; total: number }>();
    for (const it of items) {
        let e = map.get(it.currency);
        if (!e) {
            e = { currency: it.currency, loadCount: 0, total: 0 };
            map.set(it.currency, e);
        }
        e.loadCount += 1;
        e.total += it.cost;
    }
    return CURRENCY_ORDER.filter((c) => map.has(c)).map((c) => map.get(c)!);
}

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
    currency: Currency;
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
                currency: sc.currency,
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

interface MonthlySupplierRow {
    supplierName: string;
    currency: Currency;
    loadCount: number;
    totalCost: number;
}

interface CurrencyTotal {
    currency: Currency;
    loadCount: number;
    total: number;
}

interface MonthlyGroup {
    monthKey: string;
    monthLabel: string;
    rows: MonthlySupplierRow[];
    subtotals: CurrencyTotal[];
    loadCount: number;
}

function buildMonthlyGroups(loads: Load[]): MonthlyGroup[] {
    const months = new Map<
        string,
        { monthKey: string; monthLabel: string; map: Map<string, MonthlySupplierRow>; loadCount: number }
    >();

    for (const load of loads) {
        const { key, label } = monthKey(load.loading_date);
        const sc = getSubcontractorInfo(load);

        let group = months.get(key);
        if (!group) {
            group = { monthKey: key, monthLabel: label, map: new Map(), loadCount: 0 };
            months.set(key, group);
        }

        const rowKey = `${sc.supplierName}||${sc.currency}`;
        let row = group.map.get(rowKey);
        if (!row) {
            row = { supplierName: sc.supplierName, currency: sc.currency, loadCount: 0, totalCost: 0 };
            group.map.set(rowKey, row);
        }
        row.loadCount += 1;
        row.totalCost += sc.cost;
        group.loadCount += 1;
    }

    return Array.from(months.values())
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .map((g) => {
            const rows = Array.from(g.map.values()).sort((a, b) =>
                a.supplierName !== b.supplierName
                    ? a.supplierName.localeCompare(b.supplierName)
                    : CURRENCY_ORDER.indexOf(a.currency) - CURRENCY_ORDER.indexOf(b.currency),
            );
            const subMap = new Map<Currency, CurrencyTotal>();
            for (const r of rows) {
                let e = subMap.get(r.currency);
                if (!e) {
                    e = { currency: r.currency, loadCount: 0, total: 0 };
                    subMap.set(r.currency, e);
                }
                e.loadCount += r.loadCount;
                e.total += r.totalCost;
            }
            const subtotals = CURRENCY_ORDER.filter((c) => subMap.has(c)).map((c) => subMap.get(c)!);
            return {
                monthKey: g.monthKey,
                monthLabel: g.monthLabel,
                rows,
                subtotals,
                loadCount: g.loadCount,
            };
        });
}

/** Sum the per-month subtotals into per-currency grand totals across all groups. */
function grandByCurrency(groups: MonthlyGroup[]): CurrencyTotal[] {
    const map = new Map<Currency, CurrencyTotal>();
    for (const g of groups) {
        for (const s of g.subtotals) {
            let e = map.get(s.currency);
            if (!e) {
                e = { currency: s.currency, loadCount: 0, total: 0 };
                map.set(s.currency, e);
            }
            e.loadCount += s.loadCount;
            e.total += s.total;
        }
    }
    return CURRENCY_ORDER.filter((c) => map.has(c)).map((c) => map.get(c)!);
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
        "Currency",
        "Cost",
    ];
    const colCount = header.length;
    const currencyCol = colCount - 2;
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
        r.currency,
        r.cost,
    ]);
    const totals = sumByCurrency(rows);
    const totalRows = totals.map((t) => [
        totals.length > 1 ? `TOTAL (${t.currency})` : "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        t.currency,
        t.total,
    ]);
    XLSX.utils.sheet_add_aoa(ws, [...body, ...totalRows], { origin: "A6" });

    const merges: XLSX.Range[] = [];
    applyTitleRows(ws, colCount, merges);
    ws["!merges"] = merges;
    applyHeaderStyle(ws, 4, colCount);

    const firstBodyRow = 5;
    const lastBodyRow = firstBodyRow + body.length - 1;
    for (let r = firstBodyRow; r <= lastBodyRow; r++) {
        const rowCurrency = rows[r - firstBodyRow].currency;
        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) continue;
            ws[ref].s =
                c === costCol
                    ? { ...xlNumericCell, numFmt: costNumFmt(rowCurrency) }
                    : { ...xlDataCell };
        }
    }
    if (body.length > 0) {
        applyAlternatingRowColors(ws, firstBodyRow, lastBodyRow, 0, colCount - 1);
    }

    totalRows.forEach((_, k) => {
        const totalRowIdx = firstBodyRow + body.length + k;
        applyTotalRow(ws, totalRowIdx, 0, colCount - 1);
        const totalRef = XLSX.utils.encode_cell({ r: totalRowIdx, c: costCol });
        if (ws[totalRef]) ws[totalRef].s = { ...ws[totalRef].s, numFmt: costNumFmt(totals[k].currency) };
    });

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
        { wch: 10 },
        { wch: 14 },
    ];
    ws["!rows"] = [{ hpt: 18 }, { hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];
    void currencyCol;

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

    const header = ["Month", "Subcontractor", "Currency", "# Loads", "Total Cost"];
    const colCount = header.length;
    const countCol = 3;
    const costCol = 4;

    const ws = XLSX.utils.aoa_to_sheet([
        [],
        ["Monthly Subcontractor Cost Report"],
        [subtitle],
        [],
        header,
    ]);

    type BodyRow = { cells: (string | number)[]; kind: "data" | "subtotal"; currency: Currency };
    const bodyRows: BodyRow[] = [];
    for (const g of groups) {
        for (const s of g.rows) {
            bodyRows.push({
                cells: [g.monthLabel, s.supplierName, s.currency, s.loadCount, s.totalCost],
                kind: "data",
                currency: s.currency,
            });
        }
        for (const sub of g.subtotals) {
            bodyRows.push({
                cells: [
                    g.subtotals.length > 1
                        ? `${g.monthLabel} Subtotal (${sub.currency})`
                        : `${g.monthLabel} Subtotal`,
                    "",
                    sub.currency,
                    sub.loadCount,
                    sub.total,
                ],
                kind: "subtotal",
                currency: sub.currency,
            });
        }
    }
    const grand = grandByCurrency(groups);
    const grandRows = grand.map((t) => [
        grand.length > 1 ? `GRAND TOTAL (${t.currency})` : "GRAND TOTAL",
        "",
        t.currency,
        t.loadCount,
        t.total,
    ]);

    XLSX.utils.sheet_add_aoa(ws, [...bodyRows.map((r) => r.cells), ...grandRows], { origin: "A6" });

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
                    ? { ...xlNumericCell, numFmt: costNumFmt(row.currency) }
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

    const grandStart = firstBodyRow + bodyRows.length;
    grand.forEach((t, k) => {
        const r = grandStart + k;
        applyTotalRow(ws, r, 0, colCount - 1);
        const grandCostRef = XLSX.utils.encode_cell({ r, c: costCol });
        if (ws[grandCostRef]) ws[grandCostRef].s = { ...ws[grandCostRef].s, numFmt: costNumFmt(t.currency) };
        const grandCountRef = XLSX.utils.encode_cell({ r, c: countCol });
        if (ws[grandCountRef]) ws[grandCountRef].s = { ...ws[grandCountRef].s, numFmt: NUMBER_FORMATS.integer };
    });

    applyAutoFilter(ws, 4, colCount);
    freezeHeaderRow(ws, 5, 1);
    ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];
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

    const totals = sumByCurrency(rows);
    const supplierCount = new Set(rows.map((r) => r.supplierName)).size;
    const totalCostLabel =
        totals.length === 0
            ? currencyFmt(0)
            : totals.map((t) => currencyFmt(t.total, t.currency)).join("  /  ");
    const yPos = pdfKpiStrip(doc, yStart, [
        { label: "Total Loads", value: rows.length.toLocaleString() },
        { label: "Subcontractors", value: supplierCount.toLocaleString() },
        { label: "Total Cost", value: totalCostLabel },
    ]);

    const totalBodyRows = totals.map((t) => [
        totals.length > 1 ? `TOTAL (${t.currency})` : "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        t.currency,
        currencyFmt(t.total, t.currency),
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
                "Currency",
                "Cost",
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
                r.currency,
                currencyFmt(r.cost, r.currency),
            ]),
            ...totalBodyRows,
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
            0: { fontStyle: "bold", textColor: pdfColors.navy, cellWidth: 34 },
            8: { halign: "center", cellWidth: 16 },
            9: { halign: "right", cellWidth: 24 },
        },
        didParseCell: (hook) => {
            if (hook.section === "body" && hook.row.index >= rows.length) {
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

    const grand = grandByCurrency(groups);
    const grandLoads = groups.reduce((s, g) => s + g.loadCount, 0);
    const supplierCount = new Set(
        groups.flatMap((g) => g.rows.map((s) => s.supplierName)),
    ).size;
    const totalCostLabel =
        grand.length === 0
            ? currencyFmt(0)
            : grand.map((t) => currencyFmt(t.total, t.currency)).join("  /  ");
    const yPos = pdfKpiStrip(doc, yStart, [
        { label: "Months", value: groups.length.toLocaleString() },
        { label: "Subcontractors", value: supplierCount.toLocaleString() },
        { label: "Total Loads", value: grandLoads.toLocaleString() },
        { label: "Total Cost", value: totalCostLabel },
    ]);

    type Row = { cells: string[]; kind: "data" | "subtotal" | "grand" };
    const tableRows: Row[] = [];
    for (const g of groups) {
        for (const s of g.rows) {
            tableRows.push({
                cells: [
                    g.monthLabel,
                    s.supplierName,
                    s.currency,
                    String(s.loadCount),
                    currencyFmt(s.totalCost, s.currency),
                ],
                kind: "data",
            });
        }
        for (const sub of g.subtotals) {
            tableRows.push({
                cells: [
                    g.subtotals.length > 1
                        ? `${g.monthLabel} Subtotal (${sub.currency})`
                        : `${g.monthLabel} Subtotal`,
                    "",
                    sub.currency,
                    String(sub.loadCount),
                    currencyFmt(sub.total, sub.currency),
                ],
                kind: "subtotal",
            });
        }
    }
    for (const t of grand) {
        tableRows.push({
            cells: [
                grand.length > 1 ? `GRAND TOTAL (${t.currency})` : "GRAND TOTAL",
                "",
                t.currency,
                String(t.loadCount),
                currencyFmt(t.total, t.currency),
            ],
            kind: "grand",
        });
    }

    autoTable(doc, {
        startY: yPos,
        head: [["Month", "Subcontractor", "Currency", "# Loads", "Total Cost"]],
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
            2: { halign: "center", cellWidth: 20 },
            3: { halign: "right", cellWidth: 20 },
            4: { halign: "right", cellWidth: 32 },
        },
        didParseCell: (hook) => {
            if (hook.section !== "body") return;
            const row = tableRows[hook.row.index];
            if (!row) return;
            if (row.kind === "subtotal" || row.kind === "grand") {
                hook.cell.styles.fillColor =
                    row.kind === "grand" ? pdfColors.lightBlue : pdfColors.offWhite;
                hook.cell.styles.fontStyle = "bold";
                hook.cell.styles.textColor = pdfColors.navy;
            }
        },
    });

    pdfFooter(doc);
    doc.save(`subcontractor-monthly-cost-${timestamp()}.pdf`);
}
