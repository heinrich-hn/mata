import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import * as XLSX from 'xlsx-js-style';

// ── Types ────────────────────────────────────────────────────────────────────

interface JsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

interface ExportColumn {
    header: string;
    key: string;
    width?: number;
    excelWidth?: number;
    isNumeric?: boolean;
    isCurrency?: boolean;
    isPercentage?: boolean;
    colorRule?: (value: string | number | null | undefined) => 'good' | 'bad' | 'warning' | 'neutral';
}

type EmailCategory = 'driver_behavior' | 'diesel' | 'documents' | 'trips' | 'maintenance' | 'faults' | 'incidents' | 'breakdowns';

interface ExportConfig {
    title: string;
    subtitle?: string;
    columns: ExportColumn[];
    rows: Record<string, string | number | null | undefined>[];
    filename: string;
    orientation?: 'portrait' | 'landscape';
    summaryRows?: [string, string][];
    emailCategory?: EmailCategory;
}

// ── Excel Styling Constants ───────────────────────────────────────────────────

const EXCEL_STYLES = {
    // Header styles
    title: {
        font: { bold: true, sz: 16, color: { rgb: "FFFFFF" }, name: "Calibri" },
        fill: { fgColor: { rgb: "1F3864" } },
        alignment: { horizontal: "center", vertical: "center" },
    },
    header: {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" }, name: "Calibri" },
        fill: { fgColor: { rgb: "2E5FA1" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
            top: { style: "thin", color: { rgb: "1F3864" } },
            bottom: { style: "medium", color: { rgb: "1F3864" } },
            left: { style: "thin", color: { rgb: "D6E4F0" } },
            right: { style: "thin", color: { rgb: "D6E4F0" } },
        },
    },
    subheader: {
        font: { bold: true, sz: 10, color: { rgb: "1F3864" }, name: "Calibri" },
        fill: { fgColor: { rgb: "D6E4F0" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            bottom: { style: "thin", color: { rgb: "2E5FA1" } },
        },
    },
    
    // Data styles
    dataText: {
        font: { sz: 10, color: { rgb: "1F2937" }, name: "Calibri" },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
            right: { style: "hair", color: { rgb: "E5E7EB" } },
        },
    },
    dataNumeric: {
        font: { sz: 10, color: { rgb: "1F2937" }, name: "Calibri" },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
            right: { style: "hair", color: { rgb: "E5E7EB" } },
        },
    },
    dataCurrency: {
        font: { sz: 10, color: { rgb: "1F2937" }, name: "Calibri" },
        alignment: { horizontal: "right", vertical: "center" },
        numFmt: '"$"#,##0.00_);[Red]("$"#,##0.00)',
        border: {
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
            right: { style: "hair", color: { rgb: "E5E7EB" } },
        },
    },
    dataPercentage: {
        font: { sz: 10, color: { rgb: "1F2937" }, name: "Calibri" },
        alignment: { horizontal: "right", vertical: "center" },
        numFmt: '0.00%',
        border: {
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
            right: { style: "hair", color: { rgb: "E5E7EB" } },
        },
    },
    
    // Alternating row colors
    altRow: {
        fill: { fgColor: { rgb: "F9FAFB" } },
    },
    
    // Color indicator styles
    good: {
        font: { bold: true, color: { rgb: "006100" } },
        fill: { fgColor: { rgb: "C6EFCE" } },
    },
    bad: {
        font: { bold: true, color: { rgb: "9C0006" } },
        fill: { fgColor: { rgb: "FFC7CE" } },
    },
    warning: {
        font: { bold: true, color: { rgb: "7F6000" } },
        fill: { fgColor: { rgb: "FFE699" } },
    },
    neutral: {
        font: { color: { rgb: "595959" } },
        fill: { fgColor: { rgb: "D9D9D9" } },
    },
    
    // Summary styles
    summaryLabel: {
        font: { bold: true, sz: 10, color: { rgb: "1F2937" }, name: "Calibri" },
        fill: { fgColor: { rgb: "F2F2F2" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
    },
    summaryValue: {
        font: { bold: true, sz: 11, color: { rgb: "2E5FA1" }, name: "Calibri" },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
        },
    },
    totalRow: {
        font: { bold: true, sz: 10, color: { rgb: "1F2937" }, name: "Calibri" },
        fill: { fgColor: { rgb: "E5E7EB" } },
        border: {
            top: { style: "medium", color: { rgb: "4B5563" } },
            bottom: { style: "medium", color: { rgb: "4B5563" } },
        },
    },
} as const;

// ── Brand Colors for PDF ────────────────────────────────────────────────────

const BRAND = {
    primary: [31, 56, 100] as [number, number, number],
    primaryLight: [46, 95, 161] as [number, number, number],
    accent: [0, 112, 192] as [number, number, number],
    success: [0, 128, 72] as [number, number, number],
    warning: [204, 153, 0] as [number, number, number],
    danger: [192, 0, 0] as [number, number, number],
    text: [33, 33, 33] as [number, number, number],
    subtext: [100, 100, 100] as [number, number, number],
    headerBg: [31, 56, 100] as [number, number, number],
    stripeBg: [245, 247, 250] as [number, number, number],
};

// ── Email Configuration ─────────────────────────────────────────────────────

const ALWAYS_CC = [
    'Vimbai@matanuska.co.zw',
    'ruth@matanuska.co.zw',
    'Heinrich@matanuska.co.za',
];

const CATEGORY_TO: Record<EmailCategory, string[]> = {
    driver_behavior: ['alec@matanuska.co.zw'],
    diesel: ['alec@matanuska.co.zw'],
    documents: ['alec@matanuska.co.zw'],
    trips: ['alec@matanuska.co.zw', 'cain@matanuska.co.zw', 'transportmatanuska@gmail.com'],
    maintenance: ['alec@matanuska.co.zw', 'cain@matanuska.co.zw', 'transportmatanuska@gmail.com'],
    faults: ['alec@matanuska.co.zw'],
    incidents: ['alec@matanuska.co.zw'],
    breakdowns: ['alec@matanuska.co.zw'],
};

// ── Color Rule Helpers ──────────────────────────────────────────────────────

export const colorRules = {
    positiveGood: (value: string | number | null | undefined): 'good' | 'bad' | 'neutral' => {
        if (typeof value !== 'number') return 'neutral';
        if (value > 0.05) return 'good';
        if (value < -0.05) return 'bad';
        return 'neutral';
    },
    
    efficiency: (value: string | number | null | undefined): 'good' | 'bad' | 'neutral' => {
        if (typeof value !== 'number') return 'neutral';
        if (value >= 2.5) return 'good';
        if (value < 1.5) return 'bad';
        return 'neutral';
    },
    
    expiry: (value: string | number | null | undefined): 'good' | 'bad' | 'warning' => {
        if (typeof value !== 'number') return 'neutral';
        if (value > 30) return 'good';
        if (value < 0) return 'bad';
        if (value < 7) return 'warning';
        return 'neutral';
    },
    
    severity: (value: string | number | null | undefined): 'good' | 'bad' | 'warning' => {
        const str = String(value).toLowerCase();
        if (str === 'low' || str === 'minor') return 'good';
        if (str === 'high' || str === 'critical') return 'bad';
        if (str === 'medium' || str === 'moderate') return 'warning';
        return 'neutral';
    },
    
    percentageComplete: (value: string | number | null | undefined): 'good' | 'bad' | 'warning' => {
        if (typeof value !== 'number') return 'neutral';
        if (value >= 90) return 'good';
        if (value < 50) return 'bad';
        if (value < 75) return 'warning';
        return 'neutral';
    },
};

// ── PDF Builder ─────────────────────────────────────────────────────────────

function buildPDF(config: ExportConfig): void {
    const doc = new jsPDF({
        orientation: config.orientation ?? 'landscape',
    }) as JsPDFWithAutoTable;

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const now = new Date();

    // Header bar
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, pw, 28, 'F');
    
    // Accent bar
    doc.setFillColor(...BRAND.accent);
    doc.rect(0, 28, pw, 2, 'F');

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(config.title, 14, 16);

    // Metadata
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(now, 'dd MMM yyyy HH:mm')}`, pw - 14, 12, { align: 'right' });
    doc.text(`MATA Fleet Monitor`, pw - 14, 20, { align: 'right' });

    let y = 38;

    // Subtitle
    if (config.subtitle) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BRAND.primary);
        doc.text(config.subtitle, 14, y);
        y += 6;
    }

    // Summary rows as styled box
    if (config.summaryRows && config.summaryRows.length > 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(14, y - 4, pw - 28, 20, 'F');
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...BRAND.subtext);
        const summaryText = config.summaryRows.map(([k, v]) => `${k}: ${v}`).join('  |  ');
        doc.text(summaryText, 18, y + 2);
        y += 20;
    }

    // Data table
    const heads = config.columns.map(c => c.header);
    const body = config.rows.map(row =>
        config.columns.map(c => {
            const val = row[c.key];
            return val != null ? String(val) : '–';
        })
    );

    const colStyles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {};
    config.columns.forEach((c, i) => {
        const style: { cellWidth?: number; halign?: 'left' | 'right' } = {};
        if (c.width) style.cellWidth = c.width;
        if (c.isNumeric || c.isCurrency || c.isPercentage) style.halign = 'right';
        else style.halign = 'left';
        colStyles[i] = style;
    });

    // Apply color rules for rows
    const rowStyles: Record<number, { textColor?: number[]; fillColor?: number[] }> = {};
    config.rows.forEach((row, rowIndex) => {
        config.columns.forEach((col, _colIndex) => {
            if (col.colorRule) {
                const value = row[col.key];
                const rule = col.colorRule(value);
                if (rule === 'good') {
                    rowStyles[rowIndex] = { ...rowStyles[rowIndex], fillColor: [232, 245, 233], textColor: [0, 97, 0] };
                } else if (rule === 'bad') {
                    rowStyles[rowIndex] = { ...rowStyles[rowIndex], fillColor: [255, 235, 238], textColor: [156, 0, 6] };
                } else if (rule === 'warning') {
                    rowStyles[rowIndex] = { ...rowStyles[rowIndex], fillColor: [255, 248, 225], textColor: [127, 96, 0] };
                }
            }
        });
    });

    autoTable(doc, {
        startY: y,
        head: [heads],
        body,
        theme: 'striped',
        headStyles: {
            fillColor: BRAND.headerBg,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: 4,
            halign: 'center',
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: BRAND.text,
        },
        alternateRowStyles: {
            fillColor: BRAND.stripeBg,
        },
        columnStyles: colStyles,
        rowStyles,
        margin: { left: 14, right: 14 },
        didDrawPage: (_data) => {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...BRAND.subtext);
            doc.text('Matanuska Transport Operations - Fleet Management System', 14, ph - 8);
            doc.text(`Page ${doc.getNumberOfPages()}`, pw - 14, ph - 8, { align: 'right' });
        },
    });

    doc.save(`${config.filename}-${format(now, 'yyyy-MM-dd')}.pdf`);
}

// ── Excel Builder with Full Styling ─────────────────────────────────────────

function buildExcel(config: ExportConfig): void {
    const now = new Date();
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};
    
    let currentRow = 0;
    
    // Title Section
    const titleRef = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
    ws[titleRef] = { v: config.title, t: 's', s: EXCEL_STYLES.title };
    
    // Subtitle
    currentRow++;
    if (config.subtitle) {
        const subtitleRef = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
        ws[subtitleRef] = { v: config.subtitle, t: 's', s: EXCEL_STYLES.subheader };
    }
    
    // Generation info
    currentRow++;
    const genInfoRef = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
    ws[genInfoRef] = { 
        v: `Generated: ${format(now, 'dd MMM yyyy HH:mm:ss')}`, 
        t: 's',
        s: { font: { italic: true, sz: 9, color: { rgb: "4B5563" } } }
    };
    
    currentRow++;
    
    // Summary Section
    if (config.summaryRows && config.summaryRows.length > 0) {
        for (const [label, value] of config.summaryRows) {
            const labelRef = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
            const valueRef = XLSX.utils.encode_cell({ r: currentRow, c: 1 });
            ws[labelRef] = { v: label, t: 's', s: EXCEL_STYLES.summaryLabel };
            ws[valueRef] = { v: value, t: 's', s: EXCEL_STYLES.summaryValue };
            currentRow++;
        }
        currentRow++;
    }
    
    // Header Row
    const headerRow = currentRow;
    config.columns.forEach((col, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: headerRow, c: colIndex });
        ws[cellRef] = { v: col.header, t: 's', s: EXCEL_STYLES.header };
    });
    currentRow++;
    
    // Data Rows with Styling
    config.rows.forEach((row, rowIndex) => {
        const isAltRow = rowIndex % 2 === 1;
        
        config.columns.forEach((col, colIndex) => {
            const value = row[col.key];
            const displayValue = value != null ? String(value) : '–';
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: colIndex });
            
            // Determine base style
            let baseStyle: typeof EXCEL_STYLES.dataText = EXCEL_STYLES.dataText;
            if (col.isNumeric) baseStyle = EXCEL_STYLES.dataNumeric;
            if (col.isCurrency) baseStyle = EXCEL_STYLES.dataCurrency;
            if (col.isPercentage) baseStyle = EXCEL_STYLES.dataPercentage;
            
            // Apply color rule
            let colorStyle = null;
            if (col.colorRule) {
                const rule = col.colorRule(value);
                if (rule === 'good') colorStyle = EXCEL_STYLES.good;
                else if (rule === 'bad') colorStyle = EXCEL_STYLES.bad;
                else if (rule === 'warning') colorStyle = EXCEL_STYLES.warning;
                else if (rule === 'neutral') colorStyle = EXCEL_STYLES.neutral;
            }
            
            // Merge styles
            const finalStyle = colorStyle 
                ? { ...baseStyle, ...colorStyle }
                : { ...baseStyle };
            
            if (isAltRow && !colorStyle) {
                finalStyle.fill = EXCEL_STYLES.altRow.fill;
            }
            
            // Handle numeric values
            let finalValue: string | number = displayValue;
            if (col.isCurrency && typeof value === 'number') {
                finalValue = value;
            } else if (col.isPercentage && typeof value === 'number') {
                finalValue = value / 100;
            } else if (col.isNumeric && typeof value === 'number') {
                finalValue = value;
            }
            
            ws[cellRef] = { 
                v: finalValue, 
                t: typeof finalValue === 'number' ? 'n' : 's',
                s: finalStyle 
            };
        });
        currentRow++;
    });
    
    // Total Row
    const hasTotals = config.columns.some(col => col.isNumeric || col.isCurrency);
    if (hasTotals && config.rows.length > 0) {
        const totalRow = currentRow;
        const totalLabelRef = XLSX.utils.encode_cell({ r: totalRow, c: 0 });
        ws[totalLabelRef] = { v: "TOTAL", t: 's', s: EXCEL_STYLES.totalRow };
        
        config.columns.forEach((col, colIndex) => {
            if (colIndex > 0 && (col.isNumeric || col.isCurrency)) {
                const sum = config.rows.reduce((acc, row) => {
                    const val = row[col.key];
                    return acc + (typeof val === 'number' ? val : 0);
                }, 0);
                
                const cellRef = XLSX.utils.encode_cell({ r: totalRow, c: colIndex });
                ws[cellRef] = { 
                    v: sum, 
                    t: 'n', 
                    s: { ...EXCEL_STYLES.totalRow, ...EXCEL_STYLES.dataCurrency }
                };
            }
        });
    }
    
    // Set Column Widths
    ws['!cols'] = config.columns.map(col => ({ 
        wch: col.excelWidth ?? col.width ?? 18 
    }));
    
    // Set Merges
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: config.columns.length - 1 } }];
    if (config.subtitle) {
        ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: config.columns.length - 1 } });
    }
    ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: config.columns.length - 1 } });
    
    // Freeze Header Row
    ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };
    
    // Auto-filter
    ws['!autofilter'] = {
        s: { r: headerRow, c: 0 },
        e: { r: headerRow, c: config.columns.length - 1 },
    };
    
    XLSX.utils.book_append_sheet(wb, ws, config.title.slice(0, 31));
    XLSX.writeFile(wb, `${config.filename}-${format(now, 'yyyy-MM-dd')}.xlsx`);
}

// ── Outlook Email Builder ───────────────────────────────────────────────────

function buildOutlookEmail(config: ExportConfig): void {
    const now = new Date();
    const dateStr = format(now, 'dd MMMM yyyy');
    const timeStr = format(now, 'HH:mm');

    const { to, cc } = getRecipients(config.emailCategory);
    const subject = encodeURIComponent(`${config.title} – ${dateStr}`);

    // Build HTML email
    const lines: string[] = [
        '<html><body style="font-family: Arial, sans-serif;">',
        '<div style="background-color: #1F3864; padding: 20px; color: white;">',
        '<h2 style="margin: 0;">MATA Fleet Monitor Report</h2>',
        '</div>',
        '<div style="padding: 20px;">',
        `<p>Good day,</p>`,
        `<p>Please find below the <strong>${config.title}</strong> as at ${dateStr}, ${timeStr}.</p>`,
    ];

    // Summary section
    if (config.summaryRows && config.summaryRows.length > 0) {
        lines.push('<h3 style="color: #2E5FA1;">Summary</h3>');
        lines.push('<table style="border-collapse: collapse; width: auto; margin-bottom: 20px; background-color: #F9FAFB;">');
        for (const [label, value] of config.summaryRows) {
            lines.push(`<tr style="border-bottom: 1px solid #E5E7EB;">`);
            lines.push(`<td style="padding: 8px 15px 8px 0; font-weight: bold;">${label}:</td>`);
            lines.push(`<td style="padding: 8px 0;">${value}</td>`);
            lines.push(`</tr>`);
        }
        lines.push('</table>');
    }

    if (config.subtitle) {
        lines.push(`<p><em>${config.subtitle}</em></p>`);
    }

    // Data table
    lines.push('<h3 style="color: #2E5FA1;">Details</h3>');
    lines.push('<table style="border-collapse: collapse; width: 100%; font-size: 12px;">');
    
    // Header
    lines.push('<tr style="background-color: #2E5FA1; color: white;">');
    for (const col of config.columns) {
        lines.push(`<th style="padding: 8px; border: 1px solid #1F3864; text-align: left;">${col.header}</th>`);
    }
    lines.push('</tr>');
    
    // Data rows (limit to 50 for email)
    const displayRows = config.rows.slice(0, 50);
    for (let i = 0; i < displayRows.length; i++) {
        const row = displayRows[i];
        const bgColor = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
        lines.push(`<tr style="background-color: ${bgColor};">`);
        for (const col of config.columns) {
            const val = row[col.key];
            const text = val != null ? String(val) : '–';
            let colorStyle = '';
            
            if (col.colorRule) {
                const rule = col.colorRule(val);
                if (rule === 'good') colorStyle = 'color: #006100; font-weight: bold;';
                else if (rule === 'bad') colorStyle = 'color: #9C0006; font-weight: bold;';
                else if (rule === 'warning') colorStyle = 'color: #7F6000; font-weight: bold;';
            }
            
            lines.push(`<td style="padding: 6px; border: 1px solid #E5E7EB; ${colorStyle}">${text}</td>`);
        }
        lines.push('</tr>');
    }
    
    if (config.rows.length > 50) {
        lines.push('<tr>');
        lines.push(`<td colspan="${config.columns.length}" style="padding: 8px; text-align: center; font-style: italic;">`);
        lines.push(`... and ${config.rows.length - 50} additional record(s) not shown.`);
        lines.push(`<br/>Please refer to the attached PDF/Excel export for the complete dataset.`);
        lines.push(`</td>`);
        lines.push('</tr>');
    }
    
    lines.push('</table>');
    lines.push('<hr style="border: none; border-top: 1px solid #2E5FA1; margin: 20px 0;" />');
    lines.push('<p>Please action the above items at your earliest convenience.</p>');
    lines.push('<p>Should you have any queries, please do not hesitate to reach out.</p>');
    lines.push('<br/>');
    lines.push('<p>Kind regards,</p>');
    lines.push('<p><strong>MATA Fleet Monitor</strong><br/>');
    lines.push('Matanuska Transport Operations</p>');
    lines.push('</div></body></html>');

    const body = encodeURIComponent(lines.join('\n'));
    const toParam = to.join('; ');
    const ccParam = cc.join('; ');

    window.open(
        `mailto:${toParam}?cc=${ccParam}&subject=${subject}&body=${body}`,
        '_self'
    );
}

function getRecipients(category?: EmailCategory) {
    const to = category ? CATEGORY_TO[category] : [];
    return { to, cc: ALWAYS_CC };
}

// ── Page-Specific Exporters ─────────────────────────────────────────────────

// Trip Alerts
interface TripExportRow {
    trip_number: string;
    route?: string;
    fleet_number?: string;
    driver_name?: string;
    client_name?: string;
    departure_date?: string;
    arrival_date?: string;
    status?: string;
    origin?: string;
    destination?: string;
    base_revenue?: number;
}

export function exportTripAlerts(
    trips: TripExportRow[],
    alertType: 'missing_revenue' | 'duplicate_pods',
    target: 'pdf' | 'excel' | 'outlook'
) {
    const title = alertType === 'missing_revenue'
        ? 'Missing Revenue Report'
        : 'Duplicate POD / Load Ref Report';

    const columns: ExportColumn[] = [
        { header: 'POD / Load Ref', key: 'trip_number', width: 22, excelWidth: 16 },
        { header: 'Route', key: 'route', width: 40, excelWidth: 28 },
        { header: 'Fleet', key: 'fleet_number', width: 18, excelWidth: 12 },
        { header: 'Driver', key: 'driver_name', width: 30, excelWidth: 22 },
        { header: 'Client', key: 'client_name', width: 30, excelWidth: 22 },
        { header: 'Date', key: 'date', width: 22, excelWidth: 14 },
        { 
            header: 'Status', 
            key: 'alert_status', 
            width: 20, 
            excelWidth: 14,
            colorRule: () => alertType === 'missing_revenue' ? 'bad' : 'warning'
        },
    ];

    const rows = trips.map(t => ({
        trip_number: t.trip_number,
        route: t.route || (t.origin && t.destination ? `${t.origin} → ${t.destination}` : ''),
        fleet_number: t.fleet_number || '',
        driver_name: t.driver_name || '',
        client_name: t.client_name || '',
        date: t.arrival_date
            ? format(new Date(t.arrival_date), 'dd MMM yyyy')
            : t.departure_date
                ? format(new Date(t.departure_date), 'dd MMM yyyy')
                : '',
        alert_status: alertType === 'missing_revenue' ? 'Missing Revenue' : 'Duplicate',
    }));

    const config: ExportConfig = {
        title,
        subtitle: `${trips.length} trip${trips.length !== 1 ? 's' : ''} flagged`,
        columns,
        rows,
        filename: alertType === 'missing_revenue' ? 'missing-revenue' : 'duplicate-pods',
        summaryRows: [['Total Trips', String(trips.length)]],
        emailCategory: 'trips',
    };

    dispatch(target, config);
}

// Faults
interface FaultExportRow {
    fault_number: string;
    fault_description: string;
    reported_by: string;
    reported_date: string;
    vehicles?: {
        fleet_number: string | null;
        registration_number: string;
        make: string;
        model: string;
    } | null;
}

export function exportFaults(faults: FaultExportRow[], target: 'pdf' | 'excel' | 'outlook') {
    const columns: ExportColumn[] = [
        { header: 'Fleet', key: 'fleet', width: 18, excelWidth: 12 },
        { header: 'Registration', key: 'registration', width: 24, excelWidth: 16 },
        { header: 'Fault #', key: 'fault_number', width: 20, excelWidth: 14 },
        { header: 'Description', key: 'description', width: 55, excelWidth: 40 },
        { header: 'Reported By', key: 'reported_by', width: 28, excelWidth: 20 },
        { 
            header: 'Date', 
            key: 'date', 
            width: 22, 
            excelWidth: 14,
            colorRule: colorRules.expiry
        },
    ];

    const rows = faults.map(f => {
        const daysOld = Math.floor((new Date().getTime() - new Date(f.reported_date).getTime()) / (1000 * 60 * 60 * 24));
        return {
            fleet: f.vehicles?.fleet_number || 'N/A',
            registration: f.vehicles?.registration_number || '',
            fault_number: f.fault_number,
            description: f.fault_description,
            reported_by: f.reported_by,
            date: format(new Date(f.reported_date), 'dd MMM yyyy'),
            _daysOld: daysOld,
        };
    });

    dispatch(target, {
        title: 'Vehicle Faults Report',
        subtitle: `${faults.length} active fault${faults.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'vehicle-faults',
        summaryRows: [['Total Faults', String(faults.length)]],
        emailCategory: 'faults',
    });
}

// Maintenance
interface MaintenanceExportRow {
    id: string;
    title: string;
    description?: string | null;
    due_date: string;
    assigned_to?: string | null;
    overdue_type?: 'date' | 'km' | 'hours';
    overdue_amount?: number;
    is_reefer?: boolean;
    interval_km?: number | null;
    last_odometer?: number | null;
    current_odometer?: number | null;
    vehicles?: {
        fleet_number: string | null;
        registration_number: string;
        make: string;
        model: string;
    } | null;
}

export function exportMaintenance(items: MaintenanceExportRow[], target: 'pdf' | 'excel' | 'outlook') {
    const columns: ExportColumn[] = [
        { header: 'Fleet', key: 'fleet', width: 18, excelWidth: 12 },
        { header: 'Registration', key: 'registration', width: 22, excelWidth: 16 },
        { header: 'Title', key: 'title', width: 40, excelWidth: 28 },
        { 
            header: 'Overdue', 
            key: 'overdue', 
            width: 28, 
            excelWidth: 18,
            colorRule: (value) => {
                if (!value) return 'neutral';
                const numValue = parseFloat(String(value));
                if (numValue > 30) return 'bad';
                if (numValue > 7) return 'warning';
                return 'good';
            }
        },
        { header: 'Assigned To', key: 'assigned_to', width: 28, excelWidth: 20 },
        { 
            header: 'Due Date', 
            key: 'due_date', 
            width: 22, 
            excelWidth: 14,
            colorRule: colorRules.expiry
        },
    ];

    const rows = items.map(m => {
        const unit = m.overdue_type === 'hours' ? 'hrs' : m.overdue_type === 'km' ? 'km' : 'days';
        const overdueAmount = m.overdue_amount != null ? Math.round(m.overdue_amount) : 0;
        const overdueLabel = overdueAmount > 0 ? `${overdueAmount.toLocaleString()} ${unit} overdue` : '';
        
        const daysUntilDue = Math.ceil((new Date(m.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        return {
            fleet: m.vehicles?.fleet_number || 'N/A',
            registration: m.vehicles?.registration_number || '',
            title: m.title,
            overdue: overdueLabel,
            assigned_to: m.assigned_to || 'Unassigned',
            due_date: format(new Date(m.due_date), 'dd MMM yyyy'),
            _daysUntilDue: daysUntilDue,
            _overdueAmount: overdueAmount,
        };
    });

    dispatch(target, {
        title: 'Overdue Maintenance Report',
        subtitle: `${items.length} overdue item${items.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'overdue-maintenance',
        summaryRows: [['Total Items', String(items.length)]],
        emailCategory: 'maintenance',
    });
}

// Breakdowns
interface BreakdownExportRow {
    id: string;
    source_breakdown_number: string | null;
    vehicle_fleet_number: string | null;
    vehicle_registration: string | null;
    driver_name: string | null;
    description: string;
    severity: string;
    category: string;
    status: string;
    location: string | null;
    load_number: string | null;
    breakdown_date: string;
}

export function exportBreakdowns(items: BreakdownExportRow[], target: 'pdf' | 'excel' | 'outlook') {
    const columns: ExportColumn[] = [
        { header: 'Fleet', key: 'fleet', width: 18, excelWidth: 12 },
        { header: 'Breakdown #', key: 'number', width: 22, excelWidth: 16 },
        { header: 'Description', key: 'description', width: 45, excelWidth: 35 },
        { header: 'Driver', key: 'driver', width: 28, excelWidth: 20 },
        { header: 'Location', key: 'location', width: 28, excelWidth: 20 },
        { 
            header: 'Severity', 
            key: 'severity', 
            width: 16, 
            excelWidth: 12,
            colorRule: colorRules.severity
        },
        { 
            header: 'Status', 
            key: 'status', 
            width: 20, 
            excelWidth: 14,
            colorRule: (value) => {
                const str = String(value).toLowerCase();
                if (str === 'resolved' || str === 'completed') return 'good';
                if (str === 'open' || str === 'new') return 'bad';
                if (str === 'in_progress' || str === 'processing') return 'warning';
                return 'neutral';
            }
        },
        { header: 'Date', key: 'date', width: 22, excelWidth: 14 },
    ];

    const rows = items.map(b => ({
        fleet: b.vehicle_fleet_number || b.vehicle_registration || '',
        number: b.source_breakdown_number || '',
        description: b.description,
        driver: b.driver_name || '',
        location: b.location || '',
        severity: b.severity.toUpperCase(),
        status: b.status.replace(/_/g, ' '),
        date: format(new Date(b.breakdown_date), 'dd MMM yyyy HH:mm'),
    }));

    dispatch(target, {
        title: 'Fleet Breakdowns Report',
        subtitle: `${items.length} breakdown${items.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'fleet-breakdowns',
        summaryRows: [['Total Breakdowns', String(items.length)]],
        emailCategory: 'breakdowns',
    });
}

// Diesel Debriefs
interface DieselExportRow {
    fleet_number: string;
    driver_name: string;
    date: string;
    fuel_station: string | null;
    litres_filled: number | null;
    total_cost: number | null;
    currency: string | null;
    km_per_litre: number | null;
    distance_travelled: number | null;
    expected_km_per_litre: number | null;
}

export function exportDieselDebriefs(records: DieselExportRow[], target: 'pdf' | 'excel' | 'outlook') {
    const columns: ExportColumn[] = [
        { header: 'Driver', key: 'driver', width: 30, excelWidth: 22 },
        { header: 'Fleet', key: 'fleet', width: 16, excelWidth: 12 },
        { header: 'Date', key: 'date', width: 22, excelWidth: 14 },
        { header: 'Station', key: 'station', width: 30, excelWidth: 22 },
        { header: 'Litres', key: 'litres', width: 16, excelWidth: 10, isNumeric: true },
        { header: 'Cost', key: 'cost', width: 22, excelWidth: 14, isCurrency: true },
        { header: 'Distance', key: 'distance', width: 18, excelWidth: 12, isNumeric: true },
        { 
            header: 'Actual km/L', 
            key: 'actual', 
            width: 18, 
            excelWidth: 12, 
            isNumeric: true,
            colorRule: colorRules.efficiency
        },
        { 
            header: 'Standard km/L', 
            key: 'standard', 
            width: 20, 
            excelWidth: 14, 
            isNumeric: true 
        },
    ];

    const rows = records.map(r => ({
        driver: r.driver_name,
        fleet: r.fleet_number,
        date: format(new Date(r.date), 'dd MMM yyyy'),
        station: r.fuel_station || '',
        litres: r.litres_filled ?? 0,
        cost: r.total_cost ?? 0,
        distance: r.distance_travelled ?? 0,
        actual: r.km_per_litre ?? 0,
        standard: r.expected_km_per_litre ?? 0,
    }));

    const driverCount = new Set(records.map(r => r.driver_name)).size;
    const avgEfficiency = records.reduce((acc, r) => acc + (r.km_per_litre || 0), 0) / records.length || 0;

    dispatch(target, {
        title: 'Pending Diesel Debriefs Report',
        subtitle: `${records.length} transaction${records.length !== 1 ? 's' : ''} across ${driverCount} driver${driverCount !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'pending-debriefs',
        summaryRows: [
            ['Total Transactions', String(records.length)],
            ['Drivers', String(driverCount)],
            ['Average Fuel Efficiency', `${avgEfficiency.toFixed(2)} km/L`],
        ],
        emailCategory: 'diesel',
    });
}

// Driver Behavior
interface BehaviorExportRow {
    driver_name: string;
    fleet_number: string | null;
    event_type: string;
    event_date: string;
    event_time: string | null;
    severity: string | null;
    description: string;
    location: string | null;
    points: number | null;
}

export function exportDriverBehavior(events: BehaviorExportRow[], target: 'pdf' | 'excel' | 'outlook') {
    const columns: ExportColumn[] = [
        { header: 'Driver', key: 'driver', width: 28, excelWidth: 22 },
        { header: 'Event Type', key: 'event_type', width: 28, excelWidth: 20 },
        { header: 'Description', key: 'description', width: 50, excelWidth: 35 },
        { header: 'Fleet', key: 'fleet', width: 16, excelWidth: 12 },
        { header: 'Location', key: 'location', width: 28, excelWidth: 20 },
        { header: 'Date / Time', key: 'datetime', width: 24, excelWidth: 18 },
        { 
            header: 'Severity', 
            key: 'severity', 
            width: 16, 
            excelWidth: 12,
            colorRule: colorRules.severity
        },
        { 
            header: 'Points', 
            key: 'points', 
            width: 12, 
            excelWidth: 8,
            isNumeric: true,
            colorRule: (value) => {
                const points = typeof value === 'number' ? value : 0;
                if (points === 0) return 'good';
                if (points > 5) return 'bad';
                if (points > 2) return 'warning';
                return 'neutral';
            }
        },
    ];

    const fmt = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const rows = events.map(e => ({
        driver: e.driver_name,
        event_type: fmt(e.event_type),
        description: e.description,
        fleet: e.fleet_number || '',
        location: e.location || '',
        datetime: `${format(new Date(e.event_date), 'dd MMM yyyy')}${e.event_time ? ` ${e.event_time}` : ''}`,
        severity: e.severity ? e.severity.toUpperCase() : '',
        points: e.points ?? 0,
    }));

    const totalPoints = events.reduce((acc, e) => acc + (e.points || 0), 0);

    dispatch(target, {
        title: 'Driver Behavior Events Report',
        subtitle: `${events.length} event${events.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'driver-behavior',
        summaryRows: [
            ['Total Events', String(events.length)],
            ['Total Points', String(totalPoints)],
        ],
        emailCategory: 'driver_behavior',
    });
}

// Incidents
interface IncidentExportRow {
    incident_number: string;
    incident_type: string;
    incident_date: string;
    incident_time: string;
    status: string;
    severity_rating: number | null;
    description: string | null;
    location: string;
    driver_name: string | null;
    vehicle_number: string | null;
    total_cost: number | null;
}

export function exportIncidents(incidents: IncidentExportRow[], target: 'pdf' | 'excel' | 'outlook') {
    const fmt = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const columns: ExportColumn[] = [
        { header: 'Incident #', key: 'number', width: 22, excelWidth: 16 },
        { header: 'Type', key: 'type', width: 24, excelWidth: 18 },
        { header: 'Description', key: 'description', width: 45, excelWidth: 35 },
        { header: 'Location', key: 'location', width: 28, excelWidth: 20 },
        { header: 'Driver', key: 'driver', width: 24, excelWidth: 18 },
        { header: 'Vehicle', key: 'vehicle', width: 18, excelWidth: 12 },
        { 
            header: 'Status', 
            key: 'status', 
            width: 16, 
            excelWidth: 12,
            colorRule: (value) => {
                const str = String(value).toLowerCase();
                if (str === 'closed' || str === 'resolved') return 'good';
                if (str === 'open' || str === 'new') return 'bad';
                if (str === 'investigating' || str === 'processing') return 'warning';
                return 'neutral';
            }
        },
        { header: 'Date / Time', key: 'datetime', width: 24, excelWidth: 18 },
        { 
            header: 'Est. Cost', 
            key: 'cost', 
            width: 18, 
            excelWidth: 14,
            isCurrency: true,
            colorRule: (value) => {
                const cost = typeof value === 'number' ? value : 0;
                if (cost === 0) return 'good';
                if (cost > 50000) return 'bad';
                if (cost > 10000) return 'warning';
                return 'neutral';
            }
        },
    ];

    const rows = incidents.map(i => ({
        number: i.incident_number,
        type: fmt(i.incident_type),
        description: i.description || '',
        location: i.location,
        driver: i.driver_name || '',
        vehicle: i.vehicle_number || '',
        status: i.status.toUpperCase(),
        datetime: `${format(new Date(i.incident_date), 'dd MMM yyyy')} ${i.incident_time}`,
        cost: i.total_cost ?? 0,
    }));

    const open = incidents.filter(i => i.status === 'open').length;
    const processing = incidents.filter(i => i.status === 'processing').length;
    const totalCost = incidents.reduce((acc, i) => acc + (i.total_cost || 0), 0);

    dispatch(target, {
        title: 'Incidents Report',
        subtitle: `${incidents.length} incident${incidents.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'incidents',
        summaryRows: [
            ['Total', String(incidents.length)],
            ['Open', String(open)],
            ['Processing', String(processing)],
            ['Total Estimated Cost', `R ${totalCost.toLocaleString()}`],
        ],
        emailCategory: 'incidents',
    });
}

// Document Alerts
interface DocumentAlertExportRow {
    entityType: 'vehicle' | 'driver';
    entityName: string;
    entityDetail: string;
    documentType: string;
    documentNumber: string;
    expiryDate: string;
    daysUntilExpiry: number;
    isOverdue: boolean;
}

export function exportDocumentAlerts(alerts: DocumentAlertExportRow[], entityFilter: string, target: 'outlook') {
    const fmtDocType = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const columns: ExportColumn[] = [
        { header: entityFilter === 'vehicle' ? 'Vehicle' : 'Driver', key: 'entity', excelWidth: 22 },
        { header: entityFilter === 'vehicle' ? 'Make / Model' : 'Driver #', key: 'detail', excelWidth: 20 },
        { header: 'Doc Type', key: 'doc_type', excelWidth: 18 },
        { header: 'Doc Number', key: 'doc_number', excelWidth: 18 },
        { 
            header: 'Expiry Date', 
            key: 'expiry', 
            excelWidth: 14,
            colorRule: colorRules.expiry
        },
        { 
            header: 'Days', 
            key: 'days', 
            excelWidth: 10,
            colorRule: (value) => {
                if (!value) return 'neutral';
                const str = String(value);
                if (str.includes('overdue')) return 'bad';
                const days = parseInt(str);
                if (days < 7) return 'warning';
                if (days < 30) return 'neutral';
                return 'good';
            }
        },
        { 
            header: 'Status', 
            key: 'status', 
            excelWidth: 14,
            colorRule: (value) => {
                if (value === 'OVERDUE') return 'bad';
                if (value === 'EXPIRING') return 'warning';
                return 'good';
            }
        },
    ];

    const rows = alerts.map(a => ({
        entity: a.entityName,
        detail: a.entityDetail,
        doc_type: fmtDocType(a.documentType),
        doc_number: a.documentNumber || '',
        expiry: format(new Date(a.expiryDate), 'dd MMM yyyy'),
        days: a.isOverdue ? `${Math.abs(a.daysUntilExpiry)}d overdue` : `${a.daysUntilExpiry}d left`,
        status: a.isOverdue ? 'OVERDUE' : 'EXPIRING',
    }));

    dispatch(target, {
        title: `Document Expiry Report – ${entityFilter === 'vehicle' ? 'Vehicles' : 'Drivers'}`,
        subtitle: `${alerts.length} document${alerts.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: `document-expiry-${entityFilter}`,
        summaryRows: [
            ['Total', String(alerts.length)],
            ['Overdue', String(alerts.filter(a => a.isOverdue).length)],
            ['Expiring', String(alerts.filter(a => !a.isOverdue).length)],
        ],
        emailCategory: 'documents',
    });
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

function dispatch(target: 'pdf' | 'excel' | 'outlook', config: ExportConfig): void {
    switch (target) {
        case 'pdf':
            buildPDF(config);
            break;
        case 'excel':
            buildExcel(config);
            break;
        case 'outlook':
            buildOutlookEmail(config);
            break;
    }
}