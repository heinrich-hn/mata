/**
 * Enhanced professional styling constants for Excel and PDF exports.
 * Improved with better Excel-specific formatting, conditional formatting rules,
 * and more sophisticated visual hierarchy.
 */

import type XLSX from "xlsx-js-style";

// ─── Corporate Color Palette (Enhanced) ─────────────────────────────────────
export const BRAND = {
    // Primary palette
    navy: "1F3864",      // Dark navy — primary headers, titles
    navyDark: "0F2345",  // Darker navy for depth
    blue: "2E5FA1",      // Corporate blue — section headers
    blueLight: "4A7AB8", // Lighter blue for hover/emphasis
    lightBlue: "D6E4F0", // Light blue — section/group fills
    accent: "0070C0",    // Accent blue — highlights

    // Secondary accent colors
    teal: "008080",      // Teal for positive trends
    purple: "6B5B95",    // Purple for special metrics

    // Status colors (enhanced with gradient variants)
    successDk: "006100",
    successBg: "C6EFCE",
    successLight: "E8F5E9",
    warningDk: "7F6000",
    warningBg: "FFE699",
    warningLight: "FFF8E1",
    dangerDk: "9C0006",
    dangerBg: "FFC7CE",
    dangerLight: "FFEBEE",
    neutralDk: "595959",
    neutralBg: "D9D9D9",
    infoDk: "004070",
    infoBg: "D9E5F5",

    // Greyscale
    white: "FFFFFF",
    offWhite: "F9FAFB",
    lightGray: "F2F2F2",
    midGray: "E5E7EB",
    gray: "9CA3AF",
    darkGray: "4B5563",
    charcoal: "1F2937",
    black: "000000",
} as const;

export const COMPANY_NAME = "MATANUSKA PTY LTD";
export const SYSTEM_NAME = "LoadPlan™ Fleet Management";

// ─── Excel Number Formats ───────────────────────────────────────────────────
export const NUMBER_FORMATS = {
    currency: '"$"#,##0.00_);[Red]("$"#,##0.00)',
    currencyNegRed: '"$"#,##0.00_);[Red]("$"#,##0.00)',
    percentage: '0.00%',
    percentage1Dec: '0.0%',
    decimal: '#,##0.00_);[Red](#,##0.00)',
    integer: '#,##0_);[Red](#,##0)',
    thousands: '#,##0,,"M"',
    date: 'yyyy-mm-dd',
    datetime: 'yyyy-mm-dd hh:mm:ss',
    time: 'hh:mm:ss AM/PM',
} as const;

// ─── Excel Cell Styles (Enhanced) ──────────────────────────────────────────

/** Title row — large bold white on navy with bottom border accent */
export const xlTitle = {
    font: { bold: true, sz: 16, name: "Calibri", color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.navy } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
    border: {
        bottom: { style: "medium" as const, color: { rgb: BRAND.accent } },
    },
};

/** Subtitle row — smaller with metadata */
export const xlSubtitle = {
    font: { sz: 10, italic: true, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.navy } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
};

/** Company branding row */
export const xlCompany = {
    font: { bold: true, sz: 12, color: { rgb: BRAND.navy } },
    alignment: { horizontal: "right" as const, vertical: "center" as const },
    border: {
        bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
};

/** Data table header — multi-line, wrapped, filtered style */
export const xlHeader = {
    font: { bold: true, sz: 11, name: "Calibri", color: { rgb: BRAND.white } },
    fill: {
        fgColor: { rgb: BRAND.blue },
        patternType: "solid" as const,
    },
    alignment: {
        horizontal: "center" as const,
        vertical: "center" as const,
        wrapText: true,
        shrinkToFit: true,
    },
    border: {
        top: { style: "medium" as const, color: { rgb: BRAND.navy } },
        bottom: { style: "medium" as const, color: { rgb: BRAND.navy } },
        left: { style: "thin" as const, color: { rgb: BRAND.navy } },
        right: { style: "thin" as const, color: { rgb: BRAND.navy } },
    },
};

/** Sub-header (second row of headers) */
export const xlSubHeader = {
    font: { bold: true, sz: 10, color: { rgb: BRAND.charcoal } },
    fill: { fgColor: { rgb: BRAND.lightGray } },
    alignment: {
        horizontal: "center" as const,
        vertical: "center" as const,
        wrapText: true,
    },
    border: {
        bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
        left: { style: "thin" as const, color: { rgb: BRAND.midGray } },
        right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
};

/** Section header in summary sheets — with left accent bar */
export const xlSectionHeader = {
    font: { bold: true, sz: 12, color: { rgb: BRAND.navy } },
    fill: { fgColor: { rgb: BRAND.lightBlue } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
    border: {
        bottom: { style: "thin" as const, color: { rgb: BRAND.blue } },
        left: { style: "medium" as const, color: { rgb: BRAND.accent } },
    },
};

/** Metric label — bold with right border for grouping */
export const xlMetricLabel = {
    font: { bold: true, sz: 10, color: { rgb: BRAND.charcoal } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
    border: {
        bottom: { style: "hair" as const, color: { rgb: BRAND.midGray } },
        right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
    fill: { fgColor: { rgb: BRAND.offWhite } },
};

/** Metric value — aligned with currency formatting */
export const xlMetricValue = {
    font: { sz: 11, color: { rgb: BRAND.darkGray } },
    alignment: { horizontal: "right" as const, vertical: "center" as const },
    border: {
        bottom: { style: "hair" as const, color: { rgb: BRAND.midGray } },
    },
    numFmt: NUMBER_FORMATS.currency,
};

/** Data cell — standard with borders */
export const xlDataCell = {
    alignment: { horizontal: "left" as const, vertical: "center" as const },
    border: {
        bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
        right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
};

/** Data cell — numeric (right-aligned) */
export const xlNumericCell = {
    alignment: { horizontal: "right" as const, vertical: "center" as const },
    border: {
        bottom: { style: "thin" as const, color: { rgb: BRAND.midGray } },
        right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
};

/** Alternating row fills for data tables */
export const xlAltRowA = {
    fill: { fgColor: { rgb: BRAND.white } },
};
export const xlAltRowB = {
    fill: { fgColor: { rgb: BRAND.offWhite } },
};

/** Total row styling */
export const xlTotalRow = {
    font: { bold: true, sz: 10, color: { rgb: BRAND.charcoal } },
    fill: { fgColor: { rgb: BRAND.lightGray } },
    border: {
        top: { style: "medium" as const, color: { rgb: BRAND.darkGray } },
        bottom: { style: "medium" as const, color: { rgb: BRAND.darkGray } },
        left: { style: "thin" as const, color: { rgb: BRAND.midGray } },
        right: { style: "thin" as const, color: { rgb: BRAND.midGray } },
    },
};

// ─── Variance Indicators (Enhanced) ────────────────────────────────────────

/** Good variance (positive) — green with plus sign */
export const xlGoodVariance = {
    fill: { fgColor: { rgb: BRAND.successBg } },
    font: { color: { rgb: BRAND.successDk }, bold: true },
    numFmt: '+#,##0.00_);[Red]-#,##0.00)',
};

/** Bad variance (negative) — red with minus sign */
export const xlBadVariance = {
    fill: { fgColor: { rgb: BRAND.dangerBg } },
    font: { color: { rgb: BRAND.dangerDk }, bold: true },
    numFmt: '+#,##0.00_);[Red]-#,##0.00)',
};

/** Neutral variance — grey */
export const xlNeutralVariance = {
    fill: { fgColor: { rgb: BRAND.neutralBg } },
    font: { color: { rgb: BRAND.neutralDk } },
    numFmt: '0.00%',
};

/** Warning variance — amber */
export const xlAmberVariance = {
    fill: { fgColor: { rgb: BRAND.warningBg } },
    font: { color: { rgb: BRAND.warningDk }, bold: true },
    numFmt: '+#,##0.00_);[Red]-#,##0.00)',
};

/** Good percentage (high is good) */
export const xlGoodPercentage = {
    fill: { fgColor: { rgb: BRAND.successBg } },
    font: { color: { rgb: BRAND.successDk }, bold: true },
    numFmt: NUMBER_FORMATS.percentage,
};

/** Bad percentage (low is bad) */
export const xlBadPercentage = {
    fill: { fgColor: { rgb: BRAND.dangerBg } },
    font: { color: { rgb: BRAND.dangerDk }, bold: true },
    numFmt: NUMBER_FORMATS.percentage,
};

// ─── Conditional Formatting Helpers ────────────────────────────────────────

export interface ConditionalFormat {
    type: 'cellIs' | 'colorScale' | 'dataBar' | 'iconSet';
    priority: number;
    operator?: string;
    formula?: string;
    criteria?: string;
    value?: string | number;
    format?: Record<string, unknown>;
}

/**
 * Generate conditional formatting rules for variance analysis
 */
export function getVarianceConditionalFormats(_columnRef: string): ConditionalFormat[] {
    return [
        {
            type: 'cellIs',
            priority: 1,
            operator: 'greaterThan',
            value: 0.05,
            format: xlGoodVariance,
        },
        {
            type: 'cellIs',
            priority: 2,
            operator: 'lessThan',
            value: -0.05,
            format: xlBadVariance,
        },
        {
            type: 'cellIs',
            priority: 3,
            operator: 'between',
            value: -0.05,
            criteria: '0.05',
            format: xlNeutralVariance,
        },
    ];
}

/**
 * Generate color scale for performance metrics
 */
export function getPerformanceColorScale(_columnRef: string): ConditionalFormat {
    return {
        type: 'colorScale',
        priority: 1,
        format: {
            colorScale: {
                min: { type: 'min', color: BRAND.dangerBg },
                mid: { type: 'percentile', value: 50, color: BRAND.warningBg },
                max: { type: 'max', color: BRAND.successBg },
            },
        },
    };
}

// ─── PDF Color Constants ────────────────────────────────────────────────────

export const pdfColors = {
    navy: [31, 56, 100] as [number, number, number],
    navyDark: [15, 35, 69] as [number, number, number],
    blue: [46, 95, 161] as [number, number, number],
    blueLight: [74, 122, 184] as [number, number, number],
    lightBlue: [214, 228, 240] as [number, number, number],
    accent: [0, 112, 192] as [number, number, number],
    teal: [0, 128, 128] as [number, number, number],
    purple: [107, 91, 149] as [number, number, number],
    success: [0, 128, 72] as [number, number, number],
    successLight: [232, 245, 233] as [number, number, number],
    warning: [204, 153, 0] as [number, number, number],
    warningLight: [255, 248, 225] as [number, number, number],
    danger: [192, 0, 0] as [number, number, number],
    dangerLight: [255, 235, 238] as [number, number, number],
    info: [0, 64, 112] as [number, number, number],
    infoLight: [217, 229, 245] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    offWhite: [249, 250, 251] as [number, number, number],
    lightGray: [242, 242, 242] as [number, number, number],
    gray: [156, 163, 175] as [number, number, number],
    darkGray: [75, 85, 99] as [number, number, number],
    charcoal: [31, 41, 55] as [number, number, number],
    textPrimary: [51, 51, 51] as [number, number, number],
    textMuted: [107, 114, 128] as [number, number, number],
    black: [0, 0, 0] as [number, number, number],
};

// ─── Helper Functions (Enhanced) ───────────────────────────────────────────

/**
 * Apply professional header styling with multi-row support
 */
export function applyHeaderStyle(
    ws: XLSX.WorkSheet,
    row: number,
    colCount: number,
    isSubHeader: boolean = false
): void {
    const style = isSubHeader ? xlSubHeader : xlHeader;
    for (let c = 0; c < colCount; c++) {
        const ref = encodeCell(row, c);
        if (ws[ref]) {
            ws[ref].s = style;
        }
    }
}

/**
 * Apply title + subtitle styling with company branding
 */
export function applyTitleRows(
    ws: XLSX.WorkSheet,
    colCount: number,
    merges?: XLSX.Range[],
    companyName: string = COMPANY_NAME
): void {
    // Company name in top-right
    const companyRef = encodeCell(0, colCount - 1);
    if (ws[companyRef]) {
        ws[companyRef].s = xlCompany;
        ws[companyRef].v = companyName;
    } else {
        ws[companyRef] = { v: companyName, t: "s", s: xlCompany };
    }

    // Title row (centered, merged)
    for (let c = 0; c < colCount - 1; c++) {
        const r0 = encodeCell(1, c);
        if (ws[r0]) ws[r0].s = xlTitle;
        else ws[r0] = { v: "", t: "s", s: xlTitle };
    }

    // Subtitle row
    for (let c = 0; c < colCount - 1; c++) {
        const r1 = encodeCell(2, c);
        if (ws[r1]) ws[r1].s = xlSubtitle;
        else ws[r1] = { v: "", t: "s", s: xlSubtitle };
    }

    // Merge title and subtitle rows
    if (merges) {
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 2 } });
        merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 2 } });
    }
}

/**
 * Apply enhanced summary styles with conditional formatting
 */
export function applySummaryStyles(
    ws: XLSX.WorkSheet,
    rowCount: number,
    hasVariance: boolean = false
): void {
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
            if (val === "" || val === undefined || val === null) continue;

            // Check if this is a section header (all caps or contains certain keywords)
            const isSectionHeader = typeof val === 'string' &&
                (val === val.toUpperCase() || val.includes('SUMMARY') || val.includes('TOTAL'));

            ws[c0].s = isSectionHeader ? xlSectionHeader : xlMetricLabel;
        }

        if (ws[c1]) {
            const c0val = ws[c0]?.v;
            if (c0val === "" || c0val === undefined || c0val === null) continue;

            // Apply variance styling if needed
            if (hasVariance && typeof ws[c1].v === 'number') {
                const value = ws[c1].v as number;
                if (value > 0.05) ws[c1].s = xlGoodVariance;
                else if (value < -0.05) ws[c1].s = xlBadVariance;
                else ws[c1].s = xlMetricValue;
            } else {
                ws[c1].s = xlMetricValue;
            }
        }
    }
}

/**
 * Apply alternating row colors to data table
 */
export function applyAlternatingRowColors(
    ws: XLSX.WorkSheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
): void {
    for (let r = startRow; r <= endRow; r++) {
        const isEven = (r - startRow) % 2 === 0;
        const style = isEven ? xlAltRowA : xlAltRowB;

        for (let c = startCol; c <= endCol; c++) {
            const ref = encodeCell(r, c);
            if (ws[ref]) {
                if (!ws[ref].s) ws[ref].s = {};
                ws[ref].s.fill = style.fill;
            }
        }
    }
}

/**
 * Apply total row styling
 */
export function applyTotalRow(
    ws: XLSX.WorkSheet,
    row: number,
    startCol: number,
    endCol: number
): void {
    for (let c = startCol; c <= endCol; c++) {
        const ref = encodeCell(row, c);
        if (ws[ref]) {
            ws[ref].s = xlTotalRow;
        }
    }
}

/**
 * Auto-filter with header styling
 */
export function applyAutoFilter(
    ws: XLSX.WorkSheet,
    headerRow: number,
    colCount: number
): void {
    if (!ws['!autofilter']) {
        const colLetter = (c: number): string => {
            let s = '';
            let n = c;
            while (n >= 0) {
                s = String.fromCharCode((n % 26) + 65) + s;
                n = Math.floor(n / 26) - 1;
            }
            return s;
        };
        const row = headerRow + 1; // 1-indexed for A1 notation
        ws['!autofilter'] = { ref: `${colLetter(0)}${row}:${colLetter(colCount - 1)}${row}` };
    }
}

/**
 * Set column widths for professional appearance
 */
export function setColumnWidths(
    ws: XLSX.WorkSheet,
    widths: { [key: string]: number }
): void {
    if (!ws['!cols']) ws['!cols'] = [];

    for (const [col, width] of Object.entries(widths)) {
        const colIndex = col.charCodeAt(0) - 65;
        ws['!cols'][colIndex] = { wch: width };
    }
}

/**
 * Freeze header row for easier navigation
 */
export function freezeHeaderRow(
    ws: XLSX.WorkSheet,
    row: number,
    col: number = 0
): void {
    ws['!freeze'] = { xSplit: col, ySplit: row };
}

/**
 * Add data validation for dropdown lists
 */
export function addDataValidation(
    ws: XLSX.WorkSheet,
    cell: string,
    options: string[]
): void {
    if (!ws['!validations']) ws['!validations'] = [];

    ws['!validations'].push({
        type: 'list',
        allowBlank: true,
        formula1: `"${options.join(',')}"`,
        ranges: [{
            s: { r: parseInt(cell.match(/\d+/)![0]) - 1, c: cell.charCodeAt(0) - 65 },
            e: { r: parseInt(cell.match(/\d+/)![0]) - 1, c: cell.charCodeAt(0) - 65 }
        }],
    });
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