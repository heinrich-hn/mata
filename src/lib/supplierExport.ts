import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";

import type { BulkDieselOrder, BulkDieselPriceEntry, BulkDieselSupplier } from "@/hooks/useSupplierPrices";

// ── Shared Cell Styles ─────────────────────────────────

const HEADER_FILL = { fgColor: { rgb: "1F2937" } }; // dark gray
const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" };
const HEADER_BORDER = {
    top: { style: "thin", color: { rgb: "1F2937" } },
    bottom: { style: "thin", color: { rgb: "1F2937" } },
    left: { style: "thin", color: { rgb: "1F2937" } },
    right: { style: "thin", color: { rgb: "1F2937" } },
} as const;
const HEADER_ALIGNMENT = { horizontal: "center", vertical: "center", wrapText: true } as const;

const DATA_BORDER = {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
} as const;

const TOTAL_FONT = { bold: true, sz: 10, name: "Calibri" };
const TOTAL_BORDER_TOP = {
    top: { style: "double", color: { rgb: "1F2937" } },
    bottom: { style: "thin", color: { rgb: "1F2937" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
} as const;

const TITLE_FONT = { bold: true, sz: 14, name: "Calibri" };
const SUBTITLE_FONT = { bold: false, sz: 9, color: { rgb: "6B7280" }, name: "Calibri" };

const USD_FORMAT = '"$"#,##0.00';
const USD_FORMAT_4 = '"$"#,##0.0000';
const PCT_FORMAT = '0.00"%"';
const NUM_FORMAT = '#,##0';

function applyHeaderStyle(ws: XLSX.WorkSheet, row: number, colCount: number) {
    for (let c = 0; c < colCount; c++) {
        const ref = XLSX.utils.encode_cell({ r: row, c });
        if (!ws[ref]) ws[ref] = { v: "", t: "s" };
        ws[ref].s = { fill: HEADER_FILL, font: HEADER_FONT, border: HEADER_BORDER, alignment: HEADER_ALIGNMENT };
    }
}

function applyDataStyle(ws: XLSX.WorkSheet, startRow: number, endRow: number, colCount: number) {
    for (let r = startRow; r <= endRow; r++) {
        const isEven = (r - startRow) % 2 === 0;
        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { v: "", t: "s" };
            ws[ref].s = {
                ...(ws[ref].s || {}),
                border: DATA_BORDER,
                font: { sz: 10, name: "Calibri" },
                fill: isEven ? { fgColor: { rgb: "F9FAFB" } } : undefined,
            };
        }
    }
}

function applyTotalStyle(ws: XLSX.WorkSheet, row: number, colCount: number) {
    for (let c = 0; c < colCount; c++) {
        const ref = XLSX.utils.encode_cell({ r: row, c });
        if (!ws[ref]) ws[ref] = { v: "", t: "s" };
        ws[ref].s = {
            ...(ws[ref].s || {}),
            font: TOTAL_FONT,
            border: TOTAL_BORDER_TOP,
            fill: { fgColor: { rgb: "F3F4F6" } },
        };
    }
}

function applyCurrencyFormat(ws: XLSX.WorkSheet, row: number, col: number, fmt?: string) {
    const ref = XLSX.utils.encode_cell({ r: row, c: col });
    if (ws[ref]) {
        ws[ref].s = { ...(ws[ref].s || {}), numFmt: fmt || USD_FORMAT, alignment: { horizontal: "right" } };
    }
}

function addTitleRow(ws: XLSX.WorkSheet, title: string, subtitle: string, colCount: number): number {
    // Title at row 0
    const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
    ws[titleRef] = { v: title, t: "s", s: { font: TITLE_FONT } };
    // Merge title across columns
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(colCount - 1, 5) } });

    // Subtitle at row 1
    const subRef = XLSX.utils.encode_cell({ r: 1, c: 0 });
    ws[subRef] = { v: subtitle, t: "s", s: { font: SUBTITLE_FONT } };
    ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: Math.min(colCount - 1, 5) } });

    return 3; // data starts at row 3
}

// ── PDF Export: Orders ─────────────────────────────────

export function generateOrdersPDF(orders: BulkDieselOrder[], suppliers: BulkDieselSupplier[]) {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("BULK DIESEL ORDERS REPORT", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Summary
    const totalLiters = orders.reduce((s, o) => s + o.quantity_liters, 0);
    const totalCost = orders.reduce((s, o) => s + (o.total_cost || o.quantity_liters * o.price_per_liter), 0);

    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 3, 3, "F");
    doc.setFontSize(9);
    const summaryY = yPos + 10;
    const colW = (pageWidth - 2 * margin) / 3;

    doc.setFont("helvetica", "bold");
    doc.text("Total Orders:", margin + 5, summaryY);
    doc.setFont("helvetica", "normal");
    doc.text(String(orders.length), margin + 35, summaryY);

    doc.setFont("helvetica", "bold");
    doc.text("Total Litres:", margin + colW + 5, summaryY);
    doc.setFont("helvetica", "normal");
    doc.text(totalLiters.toLocaleString(), margin + colW + 35, summaryY);

    doc.setFont("helvetica", "bold");
    doc.text("Total Cost:", margin + 2 * colW + 5, summaryY);
    doc.setFont("helvetica", "normal");
    doc.text(`$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + 2 * colW + 30, summaryY);

    yPos += 20;

    // Table
    const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown";

    const tableData = orders.map((o) => [
        format(new Date(o.order_date), "dd/MM/yyyy"),
        o.supplier?.name || supplierName(o.supplier_id),
        o.quantity_liters.toLocaleString(),
        `$${o.price_per_liter.toFixed(2)}`,
        `$${(o.total_cost || o.quantity_liters * o.price_per_liter).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        o.reference_number || "—",
        o.delivery_date ? format(new Date(o.delivery_date), "dd/MM/yyyy") : "—",
        o.notes || "—",
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [["Date", "Supplier", "Quantity (L)", "Price/L", "Total Cost", "Reference", "Delivery", "Notes"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 22 },
            2: { halign: "right", cellWidth: 25 },
            3: { halign: "right", cellWidth: 22 },
            4: { halign: "right", cellWidth: 28 },
            6: { cellWidth: 22 },
        },
        margin: { left: margin, right: margin },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: "right" });
    }

    doc.save(`bulk-diesel-orders-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ── PDF Export: Price History ───────────────────────────

export function generatePriceHistoryPDF(
    priceEntries: BulkDieselPriceEntry[],
    suppliers: BulkDieselSupplier[]
) {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown";
    const sorted = [...priceEntries].sort((a, b) => a.effective_date.localeCompare(b.effective_date));

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("SUPPLIER PRICE HISTORY — WEEKLY BREAKDOWN", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // ── Weekly breakdown table ─────────────────────────
    const { rows: weeklyRows, supplierNames } = buildWeeklyBreakdown(sorted, supplierName);

    if (weeklyRows.length > 0) {
        // Build header
        const head = ["Week", "Period"];
        for (const name of supplierNames) {
            head.push(`${name} ($/L)`, "$ Chg", "% Chg");
        }
        head.push("Market Avg", "$ Chg", "% Chg");

        const body = weeklyRows.map((row) => {
            const line: string[] = [row.weekLabel, `${row.weekStart} – ${row.weekEnd}`];
            for (const name of supplierNames) {
                const price = row.supplierPrices.get(name);
                const change = row.supplierChanges.get(name);
                line.push(price != null ? `$${price.toFixed(2)}` : "—");
                line.push(change ? `${change.dollarChange >= 0 ? "+" : ""}$${change.dollarChange.toFixed(4)}` : "—");
                line.push(change ? `${change.pctChange >= 0 ? "+" : ""}${change.pctChange.toFixed(2)}%` : "—");
            }
            // Combined market average
            line.push(row.combinedAvg != null ? `$${row.combinedAvg.toFixed(2)}` : "—");
            line.push(row.combinedChange ? `${row.combinedChange.dollarChange >= 0 ? "+" : ""}$${row.combinedChange.dollarChange.toFixed(4)}` : "—");
            line.push(row.combinedChange ? `${row.combinedChange.pctChange >= 0 ? "+" : ""}${row.combinedChange.pctChange.toFixed(2)}%` : "—");
            return line;
        });

        autoTable(doc, {
            startY: yPos,
            head: [head],
            body: body,
            theme: "grid",
            headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
            bodyStyles: { fontSize: 7 },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                // Color positive changes red, negative green
                if (data.section === "body") {
                    const colIdx = data.column.index;
                    if (colIdx >= 2 && (colIdx - 2) % 3 !== 0) {
                        const text = String(data.cell.raw);
                        if (text.startsWith("+")) {
                            data.cell.styles.textColor = [220, 38, 38];
                        } else if (text.startsWith("-")) {
                            data.cell.styles.textColor = [22, 163, 74];
                        }
                    }
                }
                // Bold the market avg price column
                if (data.section === "body") {
                    const mktPriceCol = 2 + supplierNames.length * 3;
                    if (data.column.index === mktPriceCol) {
                        data.cell.styles.fontStyle = "bold";
                    }
                }
                // Highlight market avg header columns
                if (data.section === "head") {
                    const mktStartCol = 2 + supplierNames.length * 3;
                    if (data.column.index >= mktStartCol) {
                        data.cell.styles.fillColor = [37, 99, 235]; // blue
                    }
                }
            },
        });
    }

    // ── Market Summary by Month ────────────────────────
    if (weeklyRows.length > 0) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("MARKET SUMMARY — COMBINED WEEKLY AVERAGES", pageWidth / 2, yPos, { align: "center" });
        yPos += 7;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Average price across all suppliers per week, grouped by month", pageWidth / 2, yPos, { align: "center" });
        yPos += 10;

        const MONTH_LABELS = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        // Group by month
        const monthGroups = new Map<string, WeeklyRow[]>();
        for (const row of weeklyRows) {
            if (!monthGroups.has(row.monthKey)) monthGroups.set(row.monthKey, []);
            monthGroups.get(row.monthKey)!.push(row);
        }

        const bodyRows: string[][] = [];
        const monthSummaryRows = new Set<number>();

        for (const mk of [...monthGroups.keys()].sort()) {
            const monthRows = monthGroups.get(mk)!;
            const [yr, mo] = mk.split("-").map(Number);
            const monthLabel = `${MONTH_LABELS[mo - 1]} ${yr}`;

            for (const row of monthRows) {
                bodyRows.push([
                    row.weekLabel,
                    `${row.weekStart} – ${row.weekEnd}`,
                    row.combinedAvg != null ? `$${row.combinedAvg.toFixed(4)}` : "—",
                    row.combinedChange ? `${row.combinedChange.dollarChange >= 0 ? "+" : ""}$${row.combinedChange.dollarChange.toFixed(4)}` : "—",
                    row.combinedChange ? `${row.combinedChange.pctChange >= 0 ? "+" : ""}${row.combinedChange.pctChange.toFixed(2)}%` : "—",
                ]);
            }

            // Month total row
            const monthAvgs = monthRows.map((r) => r.combinedAvg).filter((v): v is number => v != null);
            if (monthAvgs.length > 0) {
                const monthAvg = monthAvgs.reduce((a, b) => a + b, 0) / monthAvgs.length;
                const monthChange = monthAvgs.length >= 2 ? monthAvgs[monthAvgs.length - 1] - monthAvgs[0] : 0;
                const monthPct = monthAvgs.length >= 2 && monthAvgs[0] !== 0
                    ? ((monthAvgs[monthAvgs.length - 1] - monthAvgs[0]) / monthAvgs[0]) * 100 : 0;
                monthSummaryRows.add(bodyRows.length);
                bodyRows.push([
                    `${monthLabel}`,
                    "MONTH AVG",
                    `$${monthAvg.toFixed(4)}`,
                    `${monthChange >= 0 ? "+" : ""}$${monthChange.toFixed(4)}`,
                    `${monthPct >= 0 ? "+" : ""}${monthPct.toFixed(2)}%`,
                ]);
            }
        }

        autoTable(doc, {
            startY: yPos,
            head: [["Week", "Period", "Market Avg ($/L)", "$ Change", "% Change"]],
            body: bodyRows,
            theme: "grid",
            headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                2: { halign: "right" },
                3: { halign: "right" },
                4: { halign: "right" },
            },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                if (data.section === "body") {
                    // Month summary rows: bold, gray background
                    if (monthSummaryRows.has(data.row.index)) {
                        data.cell.styles.fontStyle = "bold";
                        data.cell.styles.fillColor = [243, 244, 246];
                    }
                    // Color changes
                    if (data.column.index >= 3) {
                        const text = String(data.cell.raw);
                        if (text.startsWith("+")) {
                            data.cell.styles.textColor = [220, 38, 38];
                        } else if (text.startsWith("-")) {
                            data.cell.styles.textColor = [22, 163, 74];
                        }
                    }
                }
            },
        });
    }

    // ── Detailed log on next page ──────────────────────
    doc.addPage();
    yPos = 20;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ALL PRICE ENTRIES", pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    const detailData = [...sorted].reverse().map((e) => [
        format(new Date(e.effective_date), "dd/MM/yyyy"),
        supplierName(e.supplier_id),
        `$${e.price_per_liter.toFixed(2)}`,
        e.notes || "—",
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [["Date", "Supplier", "Price/L", "Notes"]],
        body: detailData,
        theme: "grid",
        headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 28 },
            2: { halign: "right", cellWidth: 25 },
        },
        margin: { left: margin, right: margin },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: "right" });
    }

    doc.save(`supplier-price-history-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ── Excel Export: Orders ───────────────────────────────

export function generateOrdersExcel(orders: BulkDieselOrder[], suppliers: BulkDieselSupplier[]) {
    const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown";
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Orders ────────────────────────────────
    const headers = ["Order Date", "Supplier", "Quantity (L)", "Price/L ($)", "Total Cost ($)", "Reference", "Delivery Date", "Notes"];
    const colCount = headers.length;

    const rows: (string | number)[][] = orders.map((o) => [
        format(new Date(o.order_date), "yyyy-MM-dd"),
        o.supplier?.name || supplierName(o.supplier_id),
        o.quantity_liters,
        o.price_per_liter,
        o.total_cost || o.quantity_liters * o.price_per_liter,
        o.reference_number || "",
        o.delivery_date ? format(new Date(o.delivery_date), "yyyy-MM-dd") : "",
        o.notes || "",
    ]);

    // Totals
    const totalLiters = orders.reduce((s, o) => s + o.quantity_liters, 0);
    const totalCost = orders.reduce((s, o) => s + (o.total_cost || o.quantity_liters * o.price_per_liter), 0);
    const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

    const aoa: (string | number)[][] = [[], [], [], headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const dataStartRow = addTitleRow(ws, "BULK DIESEL ORDERS", `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}  |  ${orders.length} orders`, colCount);
    const headerRow = dataStartRow;
    applyHeaderStyle(ws, headerRow, colCount);
    applyDataStyle(ws, headerRow + 1, headerRow + rows.length, colCount);

    // Currency formatting on data rows
    for (let r = headerRow + 1; r <= headerRow + rows.length; r++) {
        applyCurrencyFormat(ws, r, 3, USD_FORMAT_4); // Price/L
        applyCurrencyFormat(ws, r, 4, USD_FORMAT);   // Total Cost
        // Quantity as number
        const qRef = XLSX.utils.encode_cell({ r, c: 2 });
        if (ws[qRef]) ws[qRef].s = { ...(ws[qRef].s || {}), numFmt: NUM_FORMAT, alignment: { horizontal: "right" } };
    }

    // Totals row
    const totalsRowIdx = headerRow + rows.length + 1;
    const totalsData: (string | number)[] = ["TOTALS", "", totalLiters, avgPrice, totalCost, "", "", ""];
    for (let c = 0; c < colCount; c++) {
        const ref = XLSX.utils.encode_cell({ r: totalsRowIdx, c });
        ws[ref] = { v: totalsData[c], t: typeof totalsData[c] === "number" ? "n" : "s" };
    }
    applyTotalStyle(ws, totalsRowIdx, colCount);
    applyCurrencyFormat(ws, totalsRowIdx, 3, USD_FORMAT_4);
    applyCurrencyFormat(ws, totalsRowIdx, 4, USD_FORMAT);
    const qTotalRef = XLSX.utils.encode_cell({ r: totalsRowIdx, c: 2 });
    if (ws[qTotalRef]) ws[qTotalRef].s = { ...(ws[qTotalRef].s || {}), numFmt: NUM_FORMAT, alignment: { horizontal: "right" } };
    // Label "Avg" on price column
    const avgLabelRef = XLSX.utils.encode_cell({ r: totalsRowIdx, c: 1 });
    if (ws[avgLabelRef]) ws[avgLabelRef].v = "";

    // Update range
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalsRowIdx, c: colCount - 1 } });

    ws["!cols"] = [
        { wch: 12 }, // Date
        { wch: 24 }, // Supplier
        { wch: 14 }, // Quantity
        { wch: 14 }, // Price/L
        { wch: 16 }, // Total
        { wch: 16 }, // Reference
        { wch: 14 }, // Delivery
        { wch: 28 }, // Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    // ── Sheet 2: Summary ───────────────────────────────
    const summaryHeaders = ["Metric", "Value"];
    const summaryRows: (string | number)[][] = [
        ["Total Orders", orders.length],
        ["Total Litres", totalLiters],
        ["Total Cost ($)", totalCost],
        ["Avg Price/L ($)", avgPrice],
    ];

    const summaryAoa: (string | number)[][] = [[], [], [], summaryHeaders, ...summaryRows];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
    addTitleRow(summaryWs, "ORDER SUMMARY", format(new Date(), "MMM dd, yyyy"), 2);
    applyHeaderStyle(summaryWs, 3, 2);
    applyDataStyle(summaryWs, 4, 4 + summaryRows.length - 1, 2);
    applyCurrencyFormat(summaryWs, 6, 1, USD_FORMAT);
    applyCurrencyFormat(summaryWs, 7, 1, USD_FORMAT_4);
    summaryWs["!cols"] = [{ wch: 20 }, { wch: 20 }];
    summaryWs["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 4 + summaryRows.length - 1, c: 1 } });

    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    XLSX.writeFile(wb, `bulk-diesel-orders-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

// ── Helpers ─────────────────────────────────────────────

function getISOWeek(d: Date): { year: number; week: number } {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { year: date.getUTCFullYear(), week: weekNo };
}

function getWeekStartDate(year: number, week: number): Date {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const dayOfWeek = jan1.getUTCDay() || 7;
    const firstMonday = new Date(jan1);
    firstMonday.setUTCDate(jan1.getUTCDate() + (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek));
    const target = new Date(firstMonday);
    target.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
    return target;
}

interface WeeklyRow {
    weekLabel: string;
    weekStart: string;
    weekEnd: string;
    supplierPrices: Map<string, number>;
    supplierChanges: Map<string, { dollarChange: number; pctChange: number }>;
    /** Average price across all suppliers this week */
    combinedAvg: number | null;
    /** Week-over-week change of combinedAvg */
    combinedChange: { dollarChange: number; pctChange: number } | null;
    /** ISO month key e.g. "2026-03" */
    monthKey: string;
}

function buildWeeklyBreakdown(
    priceEntries: BulkDieselPriceEntry[],
    supplierNameFn: (id: string) => string
): { rows: WeeklyRow[]; supplierNames: string[] } {
    // Group entries by week + supplier, taking last price per week
    const weekMap = new Map<string, Map<string, number>>();
    const weekMeta = new Map<string, { year: number; week: number }>();

    for (const e of priceEntries) {
        const d = new Date(e.effective_date);
        const { year, week } = getISOWeek(d);
        const key = `${year}-W${String(week).padStart(2, "0")}`;

        if (!weekMap.has(key)) {
            weekMap.set(key, new Map());
            weekMeta.set(key, { year, week });
        }
        const name = supplierNameFn(e.supplier_id);
        // Overwrite with latest entry in the week (sorted ascending so last wins)
        weekMap.get(key)!.set(name, e.price_per_liter);
    }

    const allSupplierNames = [...new Set(priceEntries.map((e) => supplierNameFn(e.supplier_id)))].sort();

    // Sort weeks chronologically
    const sortedWeeks = [...weekMap.keys()].sort();

    // Build rows with carry-forward and change calculation
    const lastKnown = new Map<string, number>();
    const rows: WeeklyRow[] = [];
    let prevCombinedAvg: number | null = null;

    for (const weekKey of sortedWeeks) {
        const meta = weekMeta.get(weekKey)!;
        const wStart = getWeekStartDate(meta.year, meta.week);
        const wEnd = new Date(wStart);
        wEnd.setUTCDate(wStart.getUTCDate() + 6);

        const prices = weekMap.get(weekKey)!;
        const supplierPrices = new Map<string, number>();
        const supplierChanges = new Map<string, { dollarChange: number; pctChange: number }>();

        for (const name of allSupplierNames) {
            const currentPrice = prices.get(name) ?? lastKnown.get(name);
            if (currentPrice != null) {
                supplierPrices.set(name, currentPrice);

                const prevPrice = lastKnown.get(name);
                if (prevPrice != null && prices.has(name)) {
                    const dollarChange = currentPrice - prevPrice;
                    const pctChange = prevPrice !== 0 ? (dollarChange / prevPrice) * 100 : 0;
                    supplierChanges.set(name, { dollarChange, pctChange });
                }

                if (prices.has(name)) {
                    lastKnown.set(name, currentPrice);
                }
            }
        }

        // Combined average across all suppliers with prices this week
        const allPricesThisWeek = [...supplierPrices.values()];
        const combinedAvg = allPricesThisWeek.length > 0
            ? allPricesThisWeek.reduce((a, b) => a + b, 0) / allPricesThisWeek.length
            : null;

        let combinedChange: { dollarChange: number; pctChange: number } | null = null;
        if (combinedAvg != null && prevCombinedAvg != null) {
            const dollarChange = combinedAvg - prevCombinedAvg;
            const pctChange = prevCombinedAvg !== 0 ? (dollarChange / prevCombinedAvg) * 100 : 0;
            combinedChange = { dollarChange, pctChange };
        }
        if (combinedAvg != null) prevCombinedAvg = combinedAvg;

        // Month key from week start date
        const monthKey = `${wStart.getUTCFullYear()}-${String(wStart.getUTCMonth() + 1).padStart(2, "0")}`;

        rows.push({
            weekLabel: weekKey,
            weekStart: format(wStart, "dd/MM/yyyy"),
            weekEnd: format(wEnd, "dd/MM/yyyy"),
            supplierPrices,
            supplierChanges,
            combinedAvg,
            combinedChange,
            monthKey,
        });
    }

    return { rows, supplierNames: allSupplierNames };
}

// ── Excel Export: Price History ─────────────────────────

export function generatePriceHistoryExcel(
    priceEntries: BulkDieselPriceEntry[],
    suppliers: BulkDieselSupplier[]
) {
    const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || "Unknown";
    const sorted = [...priceEntries].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
    const { rows: weeklyRows, supplierNames } = buildWeeklyBreakdown(sorted, supplierName);

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Raw Price Log ─────────────────────────
    {
        const headers = ["Date", "Supplier", "Price/L ($)", "Notes"];
        const colCount = headers.length;
        const dataRows: (string | number)[][] = [...sorted].reverse().map((e) => [
            format(new Date(e.effective_date), "yyyy-MM-dd"),
            supplierName(e.supplier_id),
            e.price_per_liter,
            e.notes || "",
        ]);

        const aoa: (string | number)[][] = [[], [], [], headers, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const dataStart = addTitleRow(ws, "PRICE LOG", `Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}  |  ${priceEntries.length} entries`, colCount);
        applyHeaderStyle(ws, dataStart, colCount);
        if (dataRows.length > 0) {
            applyDataStyle(ws, dataStart + 1, dataStart + dataRows.length, colCount);
            for (let r = dataStart + 1; r <= dataStart + dataRows.length; r++) {
                applyCurrencyFormat(ws, r, 2, USD_FORMAT_4);
            }
        }
        ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 32 }];
        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataStart + dataRows.length, c: colCount - 1 } });
        XLSX.utils.book_append_sheet(wb, ws, "Price Log");
    }

    // ── Sheet 2: Weekly Breakdown with Statistics ──────
    if (weeklyRows.length > 0 && supplierNames.length > 0) {
        const headers = ["Week", "Week Start", "Week End"];
        for (const name of supplierNames) {
            headers.push(`${name} ($/L)`, `${name} $ Chg`, `${name} % Chg`);
        }
        // Combined market average columns
        headers.push("Market Avg ($/L)", "Avg $ Chg", "Avg % Chg");
        const colCount = headers.length;

        const dataRows: (string | number)[][] = weeklyRows.map((row) => {
            const line: (string | number)[] = [row.weekLabel, row.weekStart, row.weekEnd];
            for (const name of supplierNames) {
                const price = row.supplierPrices.get(name);
                const change = row.supplierChanges.get(name);
                line.push(price != null ? price : "");
                line.push(change ? change.dollarChange : "");
                line.push(change ? change.pctChange : "");
            }
            // Combined average columns
            line.push(row.combinedAvg != null ? row.combinedAvg : "");
            line.push(row.combinedChange ? row.combinedChange.dollarChange : "");
            line.push(row.combinedChange ? row.combinedChange.pctChange : "");
            return line;
        });

        const aoa: (string | number)[][] = [[], [], [], headers, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const dataStart = addTitleRow(ws, "WEEKLY PRICE BREAKDOWN", `${weeklyRows.length} weeks  |  ${supplierNames.length} suppliers`, colCount);
        applyHeaderStyle(ws, dataStart, colCount);

        if (dataRows.length > 0) {
            applyDataStyle(ws, dataStart + 1, dataStart + dataRows.length, colCount);

            // Apply number formatting + colour to data rows
            for (let r = dataStart + 1; r <= dataStart + dataRows.length; r++) {
                for (let si = 0; si < supplierNames.length; si++) {
                    const priceCol = 3 + si * 3;
                    const chgCol = priceCol + 1;
                    const pctCol = priceCol + 2;
                    applyCurrencyFormat(ws, r, priceCol, USD_FORMAT_4);
                    applyCurrencyFormat(ws, r, chgCol, USD_FORMAT_4);

                    // Percentage format
                    const pctRef = XLSX.utils.encode_cell({ r, c: pctCol });
                    if (ws[pctRef] && ws[pctRef].v !== "") {
                        ws[pctRef].s = { ...(ws[pctRef].s || {}), numFmt: PCT_FORMAT, alignment: { horizontal: "right" } };
                    }

                    // Colour: red for price increase, green for decrease
                    for (const col of [chgCol, pctCol]) {
                        const ref = XLSX.utils.encode_cell({ r, c: col });
                        if (ws[ref] && typeof ws[ref].v === "number") {
                            const val = ws[ref].v as number;
                            if (val > 0) {
                                ws[ref].s = { ...(ws[ref].s || {}), font: { ...((ws[ref].s as Record<string, unknown>)?.font as Record<string, unknown> || {}), color: { rgb: "DC2626" } } };
                            } else if (val < 0) {
                                ws[ref].s = { ...(ws[ref].s || {}), font: { ...((ws[ref].s as Record<string, unknown>)?.font as Record<string, unknown> || {}), color: { rgb: "16A34A" } } };
                            }
                        }
                    }
                }

                // Format combined average columns (last 3 cols)
                const mktPriceCol = colCount - 3;
                const mktChgCol = colCount - 2;
                const mktPctCol = colCount - 1;
                applyCurrencyFormat(ws, r, mktPriceCol, USD_FORMAT_4);
                applyCurrencyFormat(ws, r, mktChgCol, USD_FORMAT_4);
                const mktPctRef = XLSX.utils.encode_cell({ r, c: mktPctCol });
                if (ws[mktPctRef] && ws[mktPctRef].v !== "") {
                    ws[mktPctRef].s = { ...(ws[mktPctRef].s || {}), numFmt: PCT_FORMAT, alignment: { horizontal: "right" } };
                }
                // Colour the combined change columns
                for (const col of [mktChgCol, mktPctCol]) {
                    const ref = XLSX.utils.encode_cell({ r, c: col });
                    if (ws[ref] && typeof ws[ref].v === "number") {
                        const val = ws[ref].v as number;
                        if (val > 0) {
                            ws[ref].s = { ...(ws[ref].s || {}), font: { ...((ws[ref].s as Record<string, unknown>)?.font as Record<string, unknown> || {}), color: { rgb: "DC2626" } } };
                        } else if (val < 0) {
                            ws[ref].s = { ...(ws[ref].s || {}), font: { ...((ws[ref].s as Record<string, unknown>)?.font as Record<string, unknown> || {}), color: { rgb: "16A34A" } } };
                        }
                    }
                }
                // Bold the combined average price for emphasis
                const mktPriceRef = XLSX.utils.encode_cell({ r, c: mktPriceCol });
                if (ws[mktPriceRef]) {
                    ws[mktPriceRef].s = { ...(ws[mktPriceRef].s || {}), font: { ...(((ws[mktPriceRef].s as Record<string, unknown>)?.font as Record<string, unknown>) || {}), bold: true } };
                }
            }
        }

        // ── Summary / Totals Row ──────────────────────
        const totalsRowIdx = dataStart + dataRows.length + 1;
        const labelRowIdx = totalsRowIdx;
        const totalsLine: (string | number)[] = ["TOTALS", "", ""];

        for (const name of supplierNames) {
            const prices = weeklyRows.map((r) => r.supplierPrices.get(name)).filter((p): p is number => p != null);
            const changes = weeklyRows.map((r) => r.supplierChanges.get(name)).filter((c): c is { dollarChange: number; pctChange: number } => c != null);

            if (prices.length > 0) {
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                const totalDollarChange = changes.reduce((s, c) => s + c.dollarChange, 0);
                const overallPct = prices.length >= 2 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;
                totalsLine.push(avg, totalDollarChange, overallPct);
            } else {
                totalsLine.push("", "", "");
            }
        }

        // Combined average totals
        const combinedAvgs = weeklyRows.map((r) => r.combinedAvg).filter((v): v is number => v != null);
        if (combinedAvgs.length > 0) {
            const overallAvg = combinedAvgs.reduce((a, b) => a + b, 0) / combinedAvgs.length;
            const totalMktChange = combinedAvgs.length >= 2 ? combinedAvgs[combinedAvgs.length - 1] - combinedAvgs[0] : 0;
            const overallMktPct = combinedAvgs.length >= 2 && combinedAvgs[0] !== 0
                ? ((combinedAvgs[combinedAvgs.length - 1] - combinedAvgs[0]) / combinedAvgs[0]) * 100 : 0;
            totalsLine.push(overallAvg, totalMktChange, overallMktPct);
        } else {
            totalsLine.push("", "", "");
        }

        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r: labelRowIdx, c });
            ws[ref] = { v: totalsLine[c], t: typeof totalsLine[c] === "number" ? "n" : "s" };
        }
        applyTotalStyle(ws, labelRowIdx, colCount);

        // Apply formatting to totals
        for (let si = 0; si < supplierNames.length; si++) {
            const priceCol = 3 + si * 3;
            applyCurrencyFormat(ws, labelRowIdx, priceCol, USD_FORMAT_4);
            applyCurrencyFormat(ws, labelRowIdx, priceCol + 1, USD_FORMAT_4);
            const pctRef = XLSX.utils.encode_cell({ r: labelRowIdx, c: priceCol + 2 });
            if (ws[pctRef] && ws[pctRef].v !== "") {
                ws[pctRef].s = { ...(ws[pctRef].s || {}), numFmt: PCT_FORMAT, alignment: { horizontal: "right" } };
            }
        }
        // Format combined average totals
        applyCurrencyFormat(ws, labelRowIdx, colCount - 3, USD_FORMAT_4);
        applyCurrencyFormat(ws, labelRowIdx, colCount - 2, USD_FORMAT_4);
        const mktTotPctRef = XLSX.utils.encode_cell({ r: labelRowIdx, c: colCount - 1 });
        if (ws[mktTotPctRef] && ws[mktTotPctRef].v !== "") {
            ws[mktTotPctRef].s = { ...(ws[mktTotPctRef].s || {}), numFmt: PCT_FORMAT, alignment: { horizontal: "right" } };
        }

        // Sub-label row
        const subLabelRow = labelRowIdx + 1;
        const subLabels: (string | number)[] = ["", "", ""];
        for (const _name of supplierNames) {
            subLabels.push("Avg Price", "Total $ Chg", "Overall % Chg");
        }
        subLabels.push("Avg Price", "Total $ Chg", "Overall % Chg");
        for (let c = 0; c < colCount; c++) {
            const ref = XLSX.utils.encode_cell({ r: subLabelRow, c });
            ws[ref] = { v: subLabels[c], t: "s", s: { font: { sz: 8, italic: true, color: { rgb: "6B7280" }, name: "Calibri" } } };
        }

        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: subLabelRow, c: colCount - 1 } });

        // Column widths
        const colWidths: XLSX.ColInfo[] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }];
        for (const name of supplierNames) {
            colWidths.push({ wch: Math.max(name.length + 6, 15) }, { wch: 13 }, { wch: 14 });
        }
        colWidths.push({ wch: 16 }, { wch: 13 }, { wch: 14 }); // Combined avg columns
        ws["!cols"] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Weekly Breakdown");
    }

    // ── Sheet 3: Market Summary (combined avg + monthly) ──
    if (weeklyRows.length > 0) {
        const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        const headers = ["Week", "Period", "Market Avg ($/L)", "$ Change", "% Change"];
        const colCount = 5;

        // Group weeks by month
        const monthGroups = new Map<string, WeeklyRow[]>();
        for (const row of weeklyRows) {
            if (!monthGroups.has(row.monthKey)) monthGroups.set(row.monthKey, []);
            monthGroups.get(row.monthKey)!.push(row);
        }
        const sortedMonths = [...monthGroups.keys()].sort();

        // Build data rows interleaved with month headers/totals
        const sheetRows: { type: "header" | "data" | "monthTotal"; values: (string | number)[] }[] = [];

        for (const mk of sortedMonths) {
            const monthRows = monthGroups.get(mk)!;
            const [yr, mo] = mk.split("-").map(Number);
            const monthLabel = `${MONTH_NAMES[mo - 1]} ${yr}`;

            // Month header
            sheetRows.push({ type: "header", values: [monthLabel, "", "", "", ""] });

            // Weekly data
            for (const row of monthRows) {
                sheetRows.push({
                    type: "data",
                    values: [
                        row.weekLabel,
                        `${row.weekStart} – ${row.weekEnd}`,
                        row.combinedAvg != null ? row.combinedAvg : "",
                        row.combinedChange ? row.combinedChange.dollarChange : "",
                        row.combinedChange ? row.combinedChange.pctChange : "",
                    ],
                });
            }

            // Month total row
            const monthAvgs = monthRows.map((r) => r.combinedAvg).filter((v): v is number => v != null);
            if (monthAvgs.length > 0) {
                const monthAvg = monthAvgs.reduce((a, b) => a + b, 0) / monthAvgs.length;
                const monthChange = monthAvgs.length >= 2 ? monthAvgs[monthAvgs.length - 1] - monthAvgs[0] : 0;
                const monthPct = monthAvgs.length >= 2 && monthAvgs[0] !== 0
                    ? ((monthAvgs[monthAvgs.length - 1] - monthAvgs[0]) / monthAvgs[0]) * 100 : 0;
                sheetRows.push({ type: "monthTotal", values: [`${monthLabel} Total`, "", monthAvg, monthChange, monthPct] });
            }
        }

        // Overall total
        const allAvgs = weeklyRows.map((r) => r.combinedAvg).filter((v): v is number => v != null);
        if (allAvgs.length > 0) {
            sheetRows.push({ type: "data", values: ["", "", "", "", ""] }); // blank spacer
            const overallAvg = allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length;
            const overallChange = allAvgs.length >= 2 ? allAvgs[allAvgs.length - 1] - allAvgs[0] : 0;
            const overallPct = allAvgs.length >= 2 && allAvgs[0] !== 0
                ? ((allAvgs[allAvgs.length - 1] - allAvgs[0]) / allAvgs[0]) * 100 : 0;
            sheetRows.push({ type: "monthTotal", values: ["OVERALL", "", overallAvg, overallChange, overallPct] });
        }

        const aoa: (string | number)[][] = [[], [], [], headers, ...sheetRows.map((r) => r.values)];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const dataStart = addTitleRow(ws, "MARKET SUMMARY", `Combined weekly average across all suppliers  |  ${sortedMonths.length} month(s)`, colCount);
        applyHeaderStyle(ws, dataStart, colCount);

        // Style each row based on type
        for (let i = 0; i < sheetRows.length; i++) {
            const r = dataStart + 1 + i;
            const row = sheetRows[i];

            if (row.type === "header") {
                // Month header row: bold, dark background
                for (let c = 0; c < colCount; c++) {
                    const ref = XLSX.utils.encode_cell({ r, c });
                    if (!ws[ref]) ws[ref] = { v: "", t: "s" };
                    ws[ref].s = {
                        font: { bold: true, sz: 10, name: "Calibri", color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: "374151" } },
                        border: DATA_BORDER,
                    };
                }
                // Merge month label
                if (!ws["!merges"]) ws["!merges"] = [];
                ws["!merges"].push({ s: { r, c: 0 }, e: { r, c: colCount - 1 } });
            } else if (row.type === "monthTotal") {
                applyTotalStyle(ws, r, colCount);
                applyCurrencyFormat(ws, r, 2, USD_FORMAT_4);
                applyCurrencyFormat(ws, r, 3, USD_FORMAT_4);
                const pRef = XLSX.utils.encode_cell({ r, c: 4 });
                if (ws[pRef] && ws[pRef].v !== "") {
                    ws[pRef].s = { ...(ws[pRef].s || {}), numFmt: PCT_FORMAT, alignment: { horizontal: "right" } };
                }
            } else {
                // Data row
                const isEven = i % 2 === 0;
                for (let c = 0; c < colCount; c++) {
                    const ref = XLSX.utils.encode_cell({ r, c });
                    if (!ws[ref]) ws[ref] = { v: "", t: "s" };
                    ws[ref].s = {
                        ...(ws[ref].s || {}),
                        border: DATA_BORDER,
                        font: { sz: 10, name: "Calibri" },
                        fill: isEven ? { fgColor: { rgb: "F9FAFB" } } : undefined,
                    };
                }
                applyCurrencyFormat(ws, r, 2, USD_FORMAT_4);
                applyCurrencyFormat(ws, r, 3, USD_FORMAT_4);
                const pRef = XLSX.utils.encode_cell({ r, c: 4 });
                if (ws[pRef] && ws[pRef].v !== "") {
                    ws[pRef].s = { ...(ws[pRef].s || {}), numFmt: PCT_FORMAT, alignment: { horizontal: "right" } };
                }
                // Colour $ and % change columns
                for (const col of [3, 4]) {
                    const ref = XLSX.utils.encode_cell({ r, c: col });
                    if (ws[ref] && typeof ws[ref].v === "number") {
                        const val = ws[ref].v as number;
                        if (val > 0) {
                            ws[ref].s = { ...(ws[ref].s || {}), font: { ...((ws[ref].s as Record<string, unknown>)?.font as Record<string, unknown> || {}), color: { rgb: "DC2626" } } };
                        } else if (val < 0) {
                            ws[ref].s = { ...(ws[ref].s || {}), font: { ...((ws[ref].s as Record<string, unknown>)?.font as Record<string, unknown> || {}), color: { rgb: "16A34A" } } };
                        }
                    }
                }
            }
        }

        const lastRow = dataStart + sheetRows.length;
        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: colCount - 1 } });
        ws["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, "Market Summary");
    }

    // ── Sheet 4: Supplier Comparison (pivot) ───────────
    if (sorted.length > 0 && supplierNames.length > 0) {
        const headers = ["Date", ...supplierNames.map((s) => `${s} ($/L)`)];
        const colCount = headers.length;

        const dateMap = new Map<string, Map<string, number>>();
        for (const e of sorted) {
            const dateKey = format(new Date(e.effective_date), "yyyy-MM-dd");
            if (!dateMap.has(dateKey)) dateMap.set(dateKey, new Map());
            dateMap.get(dateKey)!.set(supplierName(e.supplier_id), e.price_per_liter);
        }

        const dataRows: (string | number)[][] = [...dateMap.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, prices]) => {
                const row: (string | number)[] = [date];
                for (const s of supplierNames) {
                    row.push(prices.has(s) ? prices.get(s)! : "");
                }
                return row;
            });

        const aoa: (string | number)[][] = [[], [], [], headers, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const dataStart = addTitleRow(ws, "SUPPLIER PRICE COMPARISON", `${supplierNames.length} suppliers  |  ${dateMap.size} dates`, colCount);
        applyHeaderStyle(ws, dataStart, colCount);

        if (dataRows.length > 0) {
            applyDataStyle(ws, dataStart + 1, dataStart + dataRows.length, colCount);
            for (let r = dataStart + 1; r <= dataStart + dataRows.length; r++) {
                for (let c = 1; c < colCount; c++) {
                    applyCurrencyFormat(ws, r, c, USD_FORMAT_4);
                }
            }
        }

        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataStart + dataRows.length, c: colCount - 1 } });
        ws["!cols"] = [{ wch: 12 }, ...supplierNames.map((s) => ({ wch: Math.max(s.length + 6, 15) }))];
        XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    }

    XLSX.writeFile(wb, `supplier-price-history-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}
