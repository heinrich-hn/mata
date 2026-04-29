// Professional PDF + Excel exports for individual trip sub-reports.
// Used by per-tab export toolbars in TripReportsSection.

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

export type ReportColumnFormat = "currency" | "integer" | "decimal" | "percent" | "text";
export type ReportColumnAlign = "left" | "center" | "right";

export interface ReportColumn {
    header: string;
    width?: number; // Excel column width (chars)
    align?: ReportColumnAlign;
    format?: ReportColumnFormat;
}

export type ReportCellValue = string | number | null | undefined;

export interface ReportSection {
    /** Optional sub-section heading rendered above its own table */
    heading?: string;
    columns: ReportColumn[];
    rows: ReportCellValue[][];
    totalsRow?: ReportCellValue[];
}

export interface ReportSpec {
    title: string;
    subtitle?: string;
    dateFrom: string;
    dateTo: string;
    filenameBase: string;
    /** Either provide one section or many */
    sections: ReportSection[];
    /** Optional summary key/value cards on PDF + summary block on Excel */
    summary?: Array<{ label: string; value: string | number }>;
    /** Sheet name for the Excel file (max 31 chars) */
    sheetName?: string;
}

// ── Shared palette ──────────────────────────────────────────────────────────
const XC = {
    navy: "FF1E3A5F",
    navyLight: "FFE8EEF6",
    altRow: "FFF3F4F6",
    white: "FFFFFFFF",
    darkText: "FF111827",
    grayText: "FF6B7280",
    totalBg: "FFD1FAE5",
    totalText: "FF065F46",
    border: "FFD9D9D9",
    sectionBg: "FFEDE9FE",
    sectionText: "FF5B21B6",
} as const;

const NAVY_RGB: [number, number, number] = [30, 58, 95];
const ALT_RGB: [number, number, number] = [243, 244, 246];
const TOTAL_RGB: [number, number, number] = [209, 250, 229];
const TOTAL_TEXT_RGB: [number, number, number] = [6, 95, 70];

const safeSheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Report";
const safeFilename = (base: string) =>
    base.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "report";

const fmtCurrency = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatCellForPDF(value: ReportCellValue, fmt: ReportColumnFormat | undefined): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") {
        switch (fmt) {
            case "currency":
                return fmtCurrency(value);
            case "integer":
                return value.toLocaleString();
            case "decimal":
                return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            case "percent":
                return `${value.toFixed(1)}%`;
            default:
                return value.toLocaleString();
        }
    }
    return String(value);
}

function excelNumberFormat(fmt: ReportColumnFormat | undefined): string | undefined {
    switch (fmt) {
        case "currency":
            return '"$"#,##0.00';
        case "integer":
            return "#,##0";
        case "decimal":
            return "#,##0.00";
        case "percent":
            return "0.0%";
        default:
            return undefined;
    }
}

// ─── PDF generator ──────────────────────────────────────────────────────────
export function generateReportPDF(spec: ReportSpec): void {
    const doc = new jsPDF("landscape", "mm", "a4") as JsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const generatedAt = format(new Date(), "dd MMMM yyyy, HH:mm");

    // Header band
    doc.setFillColor(NAVY_RGB[0], NAVY_RGB[1], NAVY_RGB[2]);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(spec.title, 14, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("MATA Fleet Management", pageWidth - 14, 14, { align: "right" });

    // Sub-header line
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    const dateLabel = `Date Range: ${spec.dateFrom || "—"} to ${spec.dateTo || "—"}`;
    doc.text(spec.subtitle ? `${spec.subtitle}    •    ${dateLabel}` : dateLabel, 14, 30);
    doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 30, { align: "right" });

    let cursorY = 36;

    // Summary cards
    if (spec.summary && spec.summary.length > 0) {
        const cards = spec.summary.slice(0, 6);
        const cardGap = 4;
        const cardW = (pageWidth - 28 - cardGap * (cards.length - 1)) / cards.length;
        const cardH = 18;
        cards.forEach((c, i) => {
            const x = 14 + i * (cardW + cardGap);
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(x, cursorY, cardW, cardH, 2, 2, "F");
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.text(String(c.value), x + cardW / 2, cursorY + 9, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            doc.text(c.label, x + cardW / 2, cursorY + 15, { align: "center" });
        });
        cursorY += cardH + 6;
    }

    // Sections
    spec.sections.forEach((section, sIdx) => {
        if (section.heading) {
            if (cursorY > pageHeight - 40) {
                doc.addPage();
                cursorY = 20;
            }
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(NAVY_RGB[0], NAVY_RGB[1], NAVY_RGB[2]);
            doc.text(section.heading, 14, cursorY);
            doc.setTextColor(0, 0, 0);
            cursorY += 4;
        }

        const head = [section.columns.map(c => c.header)];
        const body = section.rows.map(row =>
            row.map((v, i) => formatCellForPDF(v, section.columns[i]?.format)),
        );
        const foot = section.totalsRow
            ? [section.totalsRow.map((v, i) => formatCellForPDF(v, section.columns[i]?.format))]
            : undefined;

        const columnStyles: Record<number, { halign?: "left" | "center" | "right" }> = {};
        section.columns.forEach((c, i) => {
            const align = c.align ?? (c.format && c.format !== "text" ? "right" : "left");
            columnStyles[i] = { halign: align };
        });

        autoTable(doc, {
            startY: cursorY + (section.heading ? 1 : 0),
            head,
            body,
            foot,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
            headStyles: {
                fillColor: NAVY_RGB,
                textColor: 255,
                fontStyle: "bold",
                halign: "center",
            },
            bodyStyles: { textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: ALT_RGB },
            footStyles: {
                fillColor: TOTAL_RGB,
                textColor: TOTAL_TEXT_RGB,
                fontStyle: "bold",
            },
            columnStyles,
            didDrawPage: () => {
                // Header re-paint on new pages
            },
        });

        cursorY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;
        if (sIdx < spec.sections.length - 1 && cursorY > pageHeight - 30) {
            doc.addPage();
            cursorY = 20;
        }
    });

    // Footer on every page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.setFont("helvetica", "normal");
        doc.text(`MATA Fleet Management • ${spec.title}`, 14, pageHeight - 6);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, { align: "right" });
    }

    doc.save(`${safeFilename(spec.filenameBase)}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ─── Excel generator ────────────────────────────────────────────────────────
export async function generateReportExcel(spec: ReportSpec): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "MATA Fleet Management";
    wb.created = new Date();

    const ws = wb.addWorksheet(safeSheetName(spec.sheetName ?? spec.title), {
        properties: { tabColor: { argb: XC.navy } },
        views: [{ state: "frozen", ySplit: 4 }],
    });

    // Determine widest column count across sections
    const maxCols = spec.sections.reduce((m, s) => Math.max(m, s.columns.length), 1);
    ws.columns = Array.from({ length: maxCols }, () => ({ width: 16 }));

    // Title
    const titleRow = ws.addRow([spec.title]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, maxCols);
    const tCell = titleRow.getCell(1);
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XC.navy } };
    tCell.font = { name: "Calibri", bold: true, size: 16, color: { argb: XC.white } };
    tCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    titleRow.height = 28;

    // Subtitle
    const subParts: string[] = [];
    if (spec.subtitle) subParts.push(spec.subtitle);
    subParts.push(`Date Range: ${spec.dateFrom || "—"} to ${spec.dateTo || "—"}`);
    subParts.push(`Generated: ${format(new Date(), "dd MMMM yyyy, HH:mm")}`);
    const subRow = ws.addRow([subParts.join("    •    ")]);
    ws.mergeCells(subRow.number, 1, subRow.number, maxCols);
    const sCell = subRow.getCell(1);
    sCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XC.navyLight } };
    sCell.font = { name: "Calibri", italic: true, size: 10, color: { argb: XC.grayText } };
    sCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    subRow.height = 18;

    // Summary block (compact key/value list, side-by-side if many)
    if (spec.summary && spec.summary.length > 0) {
        const labels = spec.summary.map(s => s.label);
        const values = spec.summary.map(s => s.value);
        const labelRow = ws.addRow(labels.concat(Array(Math.max(0, maxCols - labels.length)).fill("")));
        labelRow.eachCell((cell, col) => {
            if (col > labels.length) return;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XC.altRow } };
            cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: XC.darkText } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
                top: { style: "thin", color: { argb: XC.border } },
                bottom: { style: "thin", color: { argb: XC.border } },
                left: { style: "thin", color: { argb: XC.border } },
                right: { style: "thin", color: { argb: XC.border } },
            };
        });
        const valueRow = ws.addRow(values.concat(Array(Math.max(0, maxCols - values.length)).fill("")));
        valueRow.eachCell((cell, col) => {
            if (col > values.length) return;
            cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: XC.navy } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
                top: { style: "thin", color: { argb: XC.border } },
                bottom: { style: "thin", color: { argb: XC.border } },
                left: { style: "thin", color: { argb: XC.border } },
                right: { style: "thin", color: { argb: XC.border } },
            };
            if (typeof cell.value === "number") cell.numFmt = "#,##0.00";
        });
        valueRow.height = 22;
        ws.addRow([]);
    }

    // Sections
    spec.sections.forEach((section, sIdx) => {
        if (sIdx > 0) ws.addRow([]);

        if (section.heading) {
            const hRow = ws.addRow([section.heading]);
            ws.mergeCells(hRow.number, 1, hRow.number, Math.max(maxCols, section.columns.length));
            const hCell = hRow.getCell(1);
            hCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XC.sectionBg } };
            hCell.font = { name: "Calibri", bold: true, size: 11, color: { argb: XC.sectionText } };
            hCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
            hRow.height = 20;
        }

        // Apply width hints from section columns if first occurrence is widest
        section.columns.forEach((col, i) => {
            if (col.width && col.width > (ws.getColumn(i + 1).width ?? 0)) {
                ws.getColumn(i + 1).width = col.width;
            }
        });

        // Header
        const headerRow = ws.addRow(section.columns.map(c => c.header));
        headerRow.height = 22;
        headerRow.eachCell((cell, col) => {
            if (col > section.columns.length) return;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XC.navy } };
            cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: XC.white } };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            cell.border = {
                top: { style: "thin", color: { argb: XC.border } },
                bottom: { style: "thin", color: { argb: XC.border } },
                left: { style: "thin", color: { argb: XC.border } },
                right: { style: "thin", color: { argb: XC.border } },
            };
        });

        // Body
        section.rows.forEach((row, rIdx) => {
            const r = ws.addRow(row.map(v => (v === null || v === undefined ? "" : v)));
            const isAlt = rIdx % 2 === 1;
            r.eachCell((cell, col) => {
                if (col > section.columns.length) return;
                const colDef = section.columns[col - 1];
                const align = colDef.align ?? (colDef.format && colDef.format !== "text" ? "right" : "left");
                cell.font = { name: "Calibri", size: 10, color: { argb: XC.darkText } };
                cell.alignment = { horizontal: align, vertical: "middle", wrapText: false };
                cell.border = {
                    top: { style: "thin", color: { argb: XC.border } },
                    bottom: { style: "thin", color: { argb: XC.border } },
                    left: { style: "thin", color: { argb: XC.border } },
                    right: { style: "thin", color: { argb: XC.border } },
                };
                if (isAlt) {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XC.altRow } };
                }
                const numFmt = excelNumberFormat(colDef.format);
                if (numFmt && typeof cell.value === "number") cell.numFmt = numFmt;
            });
        });

        // Totals
        if (section.totalsRow) {
            const t = ws.addRow(section.totalsRow.map(v => (v === null || v === undefined ? "" : v)));
            t.eachCell((cell, col) => {
                if (col > section.columns.length) return;
                const colDef = section.columns[col - 1];
                const align = colDef.align ?? (colDef.format && colDef.format !== "text" ? "right" : "left");
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XC.totalBg } };
                cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: XC.totalText } };
                cell.alignment = { horizontal: align, vertical: "middle" };
                cell.border = {
                    top: { style: "double", color: { argb: XC.navy } },
                    bottom: { style: "double", color: { argb: XC.navy } },
                    left: { style: "thin", color: { argb: XC.border } },
                    right: { style: "thin", color: { argb: XC.border } },
                };
                const numFmt = excelNumberFormat(colDef.format);
                if (numFmt && typeof cell.value === "number") cell.numFmt = numFmt;
            });
        }
    });

    // Auto-fit any column whose computed max content > current width
    ws.columns.forEach(col => {
        let max = col.width ?? 12;
        col.eachCell?.({ includeEmpty: false }, c => {
            const len = c.value == null ? 0 : String(c.value).length + 2;
            if (len > max) max = len;
        });
        col.width = Math.min(max, 42);
    });

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${safeFilename(spec.filenameBase)}-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    );
}
