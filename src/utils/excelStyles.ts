import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ─── Shared colour & font tokens ─────────────────────────────────────────────
const BRAND_ARGB = "1F3864";   // Dark‑blue header background
const ALT_ROW = "F2F6FC";   // Zebra stripe fill
const BORDER_CLR = "D9D9D9";   // Light‑grey borders
const GREY_TEXT = "666666";
const WHITE = "FFFFFF";

// ─── Re‑usable partial styles ────────────────────────────────────────────────
export const headerFill: ExcelJS.FillPattern = {
    type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ARGB },
};

export const headerFont: Partial<ExcelJS.Font> = {
    bold: true, color: { argb: WHITE }, size: 10, name: "Calibri",
};

export const headerAlign: Partial<ExcelJS.Alignment> = {
    vertical: "middle", horizontal: "center", wrapText: true,
};

export const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: BORDER_CLR } },
    bottom: { style: "thin", color: { argb: BORDER_CLR } },
    left: { style: "thin", color: { argb: BORDER_CLR } },
    right: { style: "thin", color: { argb: BORDER_CLR } },
};

export const altRowFill: ExcelJS.FillPattern = {
    type: "pattern", pattern: "solid", fgColor: { argb: ALT_ROW },
};

export const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: "Calibri" };
export const bodyAlign: Partial<ExcelJS.Alignment> = { vertical: "middle" };

// ─── Colour presets for status / priority / health ───────────────────────────
export const statusColours: Record<string, Partial<ExcelJS.Font>> = {
    completed: { ...bodyFont, color: { argb: "16A34A" }, bold: true },
    in_progress: { ...bodyFont, color: { argb: "2563EB" }, bold: true },
    "in progress": { ...bodyFont, color: { argb: "2563EB" }, bold: true },
    pending: { ...bodyFont, color: { argb: "D97706" }, bold: true },
    overdue: { ...bodyFont, color: { argb: "DC2626" }, bold: true },
};

export const priorityColours: Record<string, Partial<ExcelJS.Font>> = {
    critical: { ...bodyFont, color: { argb: "DC2626" }, bold: true },
    high: { ...bodyFont, color: { argb: "EA580C" }, bold: true },
    medium: { ...bodyFont, color: { argb: "D97706" }, bold: true },
    low: { ...bodyFont, color: { argb: "16A34A" }, bold: true },
};

export const healthColours: Record<string, Partial<ExcelJS.Font>> = {
    excellent: { ...bodyFont, color: { argb: "16A34A" }, bold: true },
    good: { ...bodyFont, color: { argb: "2563EB" }, bold: true },
    warning: { ...bodyFont, color: { argb: "D97706" }, bold: true },
    critical: { ...bodyFont, color: { argb: "DC2626" }, bold: true },
    needs_replacement: { ...bodyFont, color: { argb: "DC2626" }, bold: true },
};

// ─── Helper functions ────────────────────────────────────────────────────────

/** Apply header styling to a row */
export function styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number): void {
    const row = ws.getRow(rowNum);
    row.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = headerAlign;
        cell.border = thinBorder;
    });
    row.height = 28;
}

/** Create a merged title cell spanning columns A–lastCol */
export function addTitle(
    ws: ExcelJS.Worksheet,
    title: string,
    lastCol: string,
): void {
    ws.mergeCells(`A1:${lastCol}1`);
    const cell = ws.getCell("A1");
    cell.value = title;
    cell.font = { bold: true, size: 16, color: { argb: BRAND_ARGB }, name: "Calibri" };
    cell.alignment = { vertical: "middle" };
    ws.getRow(1).height = 32;
}

/** Create a subtitle row (generated date, etc.) */
export function addSubtitle(
    ws: ExcelJS.Worksheet,
    text: string,
    lastCol: string,
): void {
    ws.mergeCells(`A2:${lastCol}2`);
    const cell = ws.getCell("A2");
    cell.value = text;
    cell.font = { italic: true, size: 9, color: { argb: GREY_TEXT }, name: "Calibri" };
    ws.getRow(2).height = 20;
}

/** Style body rows with zebra stripes, borders, and base font */
export function styleBodyRow(
    ws: ExcelJS.Worksheet,
    rowNum: number,
    isOdd: boolean,
): void {
    const row = ws.getRow(rowNum);
    row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.font = bodyFont;
        cell.alignment = bodyAlign;
        if (isOdd) cell.fill = altRowFill;
    });
}

/** Auto‑fit column widths based on content (capped at maxWidth) */
export function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 12, maxWidth = 45): void {
    ws.columns.forEach((col) => {
        let best = minWidth;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
            const len = cell.value ? String(cell.value).length + 2 : 0;
            if (len > best) best = len;
        });
        col.width = Math.min(best, maxWidth);
    });
}

/** Generate standard subtitle text */
export function generatedSubtitle(extra?: string): string {
    const date = new Date().toLocaleDateString("en-ZA", {
        day: "2-digit", month: "long", year: "numeric",
    });
    const base = `Generated: ${date}`;
    return extra ? `${base} • ${extra}` : `${base} • Car Craft Co Fleet Management`;
}

/** Create a workbook pre-configured with metadata */
export function createWorkbook(): ExcelJS.Workbook {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Car Craft Co Fleet Management";
    wb.created = new Date();
    return wb;
}

/** Save workbook as .xlsx download */
export async function saveWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        filename,
    );
}

/** Get the Excel column letter for a 1-based index (1=A, 2=B, … 26=Z, 27=AA) */
export function colLetter(index: number): string {
    let s = "";
    let n = index;
    while (n > 0) {
        const mod = (n - 1) % 26;
        s = String.fromCharCode(65 + mod) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

/**
 * High-level helper: add a data sheet with title, subtitle, styled header,
 * body rows with zebra stripes, auto-filter, and frozen panes.
 *
 * Returns the worksheet for further customisation.
 */
export function addStyledSheet(
    wb: ExcelJS.Workbook,
    sheetName: string,
    opts: {
        title: string;
        subtitle?: string;
        headers: string[];
        rows: (string | number | null | undefined)[][];
        /** 1-based column index → custom font for that cell (e.g. status colours) */
        cellStyler?: (rowData: (string | number | null | undefined)[], colIndex: number) => Partial<ExcelJS.Font> | undefined;
        /** Optional data-validation dropdowns:  col 1-based → list of values */
        dropdowns?: Record<number, string[]>;
    },
): ExcelJS.Worksheet {
    const ws = wb.addWorksheet(sheetName);
    const lastCol = colLetter(opts.headers.length);

    // Title & subtitle
    addTitle(ws, opts.title, lastCol);
    addSubtitle(ws, opts.subtitle ?? generatedSubtitle(), lastCol);

    // Header row (row 4, leave row 3 blank for breathing room)
    const headerRowNum = 4;
    ws.getRow(headerRowNum).values = opts.headers;
    styleHeaderRow(ws, headerRowNum);

    // Body data
    opts.rows.forEach((rowData, i) => {
        const rowNum = headerRowNum + 1 + i;
        const row = ws.getRow(rowNum);
        row.values = rowData.map((v) => (v === null || v === undefined ? "" : v));
        styleBodyRow(ws, rowNum, i % 2 === 1);

        // Per-cell colour overrides
        if (opts.cellStyler) {
            opts.headers.forEach((_, ci) => {
                const font = opts.cellStyler!(rowData, ci + 1);
                if (font) row.getCell(ci + 1).font = font;
            });
        }
    });

    // Auto-filter & frozen pane
    const lastRowNum = headerRowNum + opts.rows.length;
    ws.autoFilter = { from: `A${headerRowNum}`, to: `${lastCol}${lastRowNum}` };
    ws.views = [{ state: "frozen", ySplit: headerRowNum }];

    // Data validation dropdowns
    if (opts.dropdowns) {
        for (const [col, values] of Object.entries(opts.dropdowns)) {
            const colNum = Number(col);
            for (let r = headerRowNum + 1; r <= lastRowNum; r++) {
                ws.getCell(r, colNum).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`"${values.join(",")}"`],
                };
            }
        }
    }

    autoFitColumns(ws);
    return ws;
}

/**
 * Add a small summary / KPI sheet (Metric | Value pairs).
 */
export function addSummarySheet(
    wb: ExcelJS.Workbook,
    sheetName: string,
    opts: {
        title: string;
        subtitle?: string;
        rows: [string, string | number][];
    },
): ExcelJS.Worksheet {
    const ws = wb.addWorksheet(sheetName);

    addTitle(ws, opts.title, "B");
    addSubtitle(ws, opts.subtitle ?? generatedSubtitle(), "B");

    ws.getRow(4).values = ["Metric", "Value"];
    styleHeaderRow(ws, 4);

    opts.rows.forEach(([label, value], i) => {
        const row = ws.getRow(5 + i);
        row.values = [label, value];
        row.getCell(1).font = { bold: true, size: 10, name: "Calibri" };
        row.getCell(2).font = { size: 10, name: "Calibri" };
        row.eachCell((c) => { c.border = thinBorder; });
        if (i % 2 === 1) row.eachCell((c) => { c.fill = altRowFill; });
    });

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 20;
    return ws;
}
