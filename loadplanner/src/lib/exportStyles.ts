/**
 * Shared professional styling constants for Excel and PDF exports.
 * Provides a consistent corporate design system across all reports.
 */

// ─── Corporate Color Palette ────────────────────────────────────────────────
export const BRAND = {
    // Primary palette
    navy: "1F3864",  // Dark navy — primary headers, titles
    blue: "2E5FA1",  // Corporate blue — section headers
    lightBlue: "D6E4F0",  // Light blue — section/group fills
    accent: "0070C0",  // Accent blue — highlights

    // Status colors
    successDk: "006100",
    successBg: "C6EFCE",
    warningDk: "7F6000",
    warningBg: "FFE699",
    dangerDk: "9C0006",
    dangerBg: "FFC7CE",
    neutralDk: "595959",
    neutralBg: "D9D9D9",

    // Greyscale
    white: "FFFFFF",
    offWhite: "F9FAFB",
    lightGray: "F2F2F2",
    midGray: "E5E7EB",
    darkGray: "4B5563",
    charcoal: "1F2937",
} as const;

// Company branding
export const COMPANY_NAME = "MATANUSKA PTY LTD";
export const SYSTEM_NAME = "LoadPlan™ Fleet Management";

// ─── Excel Cell Styles ──────────────────────────────────────────────────────

/** Title row (merged across columns) — large bold white on navy */
export const xlTitle = {
    font: { bold: true, sz: 14, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.navy } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
};

/** Subtitle / generated-date row */
export const xlSubtitle = {
    font: { sz: 10, italic: true, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.navy } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
};

/** Data table header row — bold white on corporate blue, centered, thin borders */
export const xlHeader = {
    font: { bold: true, sz: 10, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.blue } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: {
        top: { style: "thin" as const, color: { rgb: BRAND.navy } },
        bottom: { style: "thin" as const, color: { rgb: BRAND.navy } },
        left: { style: "thin" as const, color: { rgb: BRAND.midGray } },
        right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
};

/** Section header in summary sheets — bold on light blue */
export const xlSectionHeader = {
    font: { bold: true, sz: 11, color: { rgb: BRAND.navy } },
    fill: { fgColor: { rgb: BRAND.lightBlue } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
    border: {
        bottom: { style: "thin" as const, color: { rgb: BRAND.blue } },
    },
};

/** Metric label in summary sheets — bold dark */
export const xlMetricLabel = {
    font: { bold: true, sz: 10, color: { rgb: BRAND.charcoal } },
    alignment: { horizontal: "left" as const },
    border: {
        bottom: { style: "hair" as const, color: { rgb: BRAND.midGray } },
    },
};

/** Metric value in summary sheets */
export const xlMetricValue = {
    font: { sz: 10, color: { rgb: BRAND.darkGray } },
    alignment: { horizontal: "right" as const },
    border: {
        bottom: { style: "hair" as const, color: { rgb: BRAND.midGray } },
    },
};

/** Alternating row fills for data tables */
export const xlAltRowA = { fill: { fgColor: { rgb: BRAND.white } } };
export const xlAltRowB = { fill: { fgColor: { rgb: BRAND.offWhite } } };

/** Variance indicators */
export const xlGoodVariance = { fill: { fgColor: { rgb: BRAND.successBg } }, font: { color: { rgb: BRAND.successDk }, bold: true } };
export const xlBadVariance = { fill: { fgColor: { rgb: BRAND.dangerBg } }, font: { color: { rgb: BRAND.dangerDk }, bold: true } };
export const xlNeutralVariance = { fill: { fgColor: { rgb: BRAND.neutralBg } }, font: { color: { rgb: BRAND.neutralDk } } };
export const xlAmberVariance = { fill: { fgColor: { rgb: BRAND.warningBg } }, font: { color: { rgb: BRAND.warningDk }, bold: true } };

/** Standard data cell border */
export const xlCellBorder = {
    border: {
        bottom: { style: "hair" as const, color: { rgb: BRAND.midGray } },
        right: { style: "hair" as const, color: { rgb: BRAND.midGray } },
    },
};

// ─── PDF Color Constants (as RGB tuples for jsPDF) ──────────────────────────

export const pdfColors = {
    navy: [31, 56, 100] as [number, number, number],
    blue: [46, 95, 161] as [number, number, number],
    lightBlue: [214, 228, 240] as [number, number, number],
    accent: [0, 112, 192] as [number, number, number],
    success: [0, 128, 72] as [number, number, number],
    warning: [204, 153, 0] as [number, number, number],
    danger: [192, 0, 0] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    offWhite: [249, 250, 251] as [number, number, number],
    lightGray: [242, 242, 242] as [number, number, number],
    darkGray: [75, 85, 99] as [number, number, number],
    charcoal: [31, 41, 55] as [number, number, number],
    textPrimary: [51, 51, 51] as [number, number, number],
    textMuted: [107, 114, 128] as [number, number, number],
};

// ─── Helper: apply header style to a worksheet row ──────────────────────────

import type XLSX from "xlsx-js-style";

/**
 * Apply professional header styling to a given row in a worksheet.
 * @param ws  The worksheet object (xlsx-js-style)
 * @param row 0-based row index of the header
 * @param colCount Number of columns
 */
export function applyHeaderStyle(ws: XLSX.WorkSheet, row: number, colCount: number): void {
    for (let c = 0; c < colCount; c++) {
        const ref = encodeCell(row, c);
        if (ws[ref]) ws[ref].s = xlHeader;
    }
}

/**
 * Apply title + subtitle styling to the first two rows and merge them.
 * Expects row 0 = title, row 1 = subtitle text.
 */
export function applyTitleRows(ws: XLSX.WorkSheet, colCount: number, merges?: XLSX.Range[]): void {
    for (let c = 0; c < colCount; c++) {
        const r0 = encodeCell(0, c);
        const r1 = encodeCell(1, c);
        if (ws[r0]) ws[r0].s = xlTitle;
        else ws[r0] = { v: "", t: "s", s: xlTitle };
        if (ws[r1]) ws[r1].s = xlSubtitle;
        else ws[r1] = { v: "", t: "s", s: xlSubtitle };
    }
    if (merges) {
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });
    }
}

/**
 * Apply styles to a summary sheet (Metric/Value layout).
 */
export function applySummaryStyles(ws: XLSX.WorkSheet, rowCount: number): void {
    // Header row
    const h0 = encodeCell(0, 0);
    const h1 = encodeCell(0, 1);
    if (ws[h0]) ws[h0].s = xlHeader;
    if (ws[h1]) ws[h1].s = xlHeader;

    for (let r = 1; r <= rowCount; r++) {
        const c0 = encodeCell(r, 0);
        const c1 = encodeCell(r, 1);
        if (ws[c0]) {
            const val = ws[c0].v;
            // Empty rows get no style, section dividers
            if (val === "" || val === undefined || val === null) continue;
            ws[c0].s = xlMetricLabel;
        }
        if (ws[c1]) {
            const c0val = ws[c0]?.v;
            if (c0val === "" || c0val === undefined || c0val === null) continue;
            ws[c1].s = xlMetricValue;
        }
    }
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
