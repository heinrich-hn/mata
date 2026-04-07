import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

// ── Types ────────────────────────────────────────────────────────────────────

interface JsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

interface ExportColumn {
    header: string;
    key: string;
    width?: number;
    excelWidth?: number;
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

// ── Brand Colours ────────────────────────────────────────────────────────────

const BRAND = {
    primary: [30, 58, 95] as [number, number, number],      // dark navy
    accent: [59, 130, 246] as [number, number, number],       // blue
    text: [33, 33, 33] as [number, number, number],
    subtext: [100, 100, 100] as [number, number, number],
    headerBg: [30, 58, 95] as [number, number, number],
    stripeBg: [245, 247, 250] as [number, number, number],
};

// ── Shared PDF builder ───────────────────────────────────────────────────────

function buildPDF(config: ExportConfig): void {
    const doc = new jsPDF({
        orientation: config.orientation ?? 'landscape',
    }) as JsPDFWithAutoTable;

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const now = new Date();

    // ── Header bar ──
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, pw, 22, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(config.title, 14, 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(now, 'dd MMM yyyy HH:mm')}`, pw - 14, 14, { align: 'right' });

    // ── Subtitle / summary ──
    let y = 30;

    if (config.subtitle) {
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.subtext);
        doc.text(config.subtitle, 14, y);
        y += 6;
    }

    if (config.summaryRows && config.summaryRows.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.subtext);
        const summaryText = config.summaryRows.map(([k, v]) => `${k}: ${v}`).join('  |  ');
        doc.text(summaryText, 14, y);
        y += 8;
    }

    // ── Data table ──
    const heads = config.columns.map(c => c.header);
    const body = config.rows.map(row =>
        config.columns.map(c => {
            const val = row[c.key];
            return val != null ? String(val) : '–';
        })
    );

    const colStyles: Record<number, { cellWidth?: number }> = {};
    config.columns.forEach((c, i) => {
        if (c.width) colStyles[i] = { cellWidth: c.width };
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
            fontSize: 7.5,
            cellPadding: 3,
        },
        bodyStyles: {
            fontSize: 7.5,
            cellPadding: 2.5,
            textColor: BRAND.text,
        },
        alternateRowStyles: {
            fillColor: BRAND.stripeBg,
        },
        columnStyles: colStyles,
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
            // Footer on every page
            doc.setFontSize(7);
            doc.setTextColor(...BRAND.subtext);
            doc.text('MATA Fleet Monitor', 14, ph - 8);
            doc.text(`Page ${doc.getNumberOfPages()}`, pw - 14, ph - 8, { align: 'right' });
        },
    });

    doc.save(`${config.filename}-${format(now, 'yyyy-MM-dd')}.pdf`);
}

// ── Shared Excel builder ─────────────────────────────────────────────────────

function buildExcel(config: ExportConfig): void {
    const now = new Date();

    const sheetRows = config.rows.map(row => {
        const obj: Record<string, string | number | null | undefined> = {};
        config.columns.forEach(c => {
            obj[c.header] = row[c.key] ?? '';
        });
        return obj;
    });

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.title.slice(0, 31));

    ws['!cols'] = config.columns.map(c => ({ wch: c.excelWidth ?? c.width ?? 18 }));

    XLSX.writeFile(wb, `${config.filename}-${format(now, 'yyyy-MM-dd')}.xlsx`);
}

// ── Email Recipients ─────────────────────────────────────────────────────────

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

function getRecipients(category?: EmailCategory) {
    const to = category ? CATEGORY_TO[category] : [];
    return { to, cc: ALWAYS_CC };
}

// ── Shared Outlook builder ───────────────────────────────────────────────────

function buildOutlookEmail(config: ExportConfig): void {
    const now = new Date();
    const dateStr = format(now, 'dd MMMM yyyy');
    const timeStr = format(now, 'HH:mm');

    const { to, cc } = getRecipients(config.emailCategory);

    const subject = encodeURIComponent(`${config.title} – ${dateStr}`);

    // ── Professional plain-text email body ──
    const lines: string[] = [
        'Good day,',
        '',
        `Please find below the ${config.title} as at ${dateStr}, ${timeStr}.`,
        '',
    ];

    // Summary section
    if (config.summaryRows && config.summaryRows.length > 0) {
        lines.push('SUMMARY');
        lines.push('─'.repeat(40));
        for (const [label, value] of config.summaryRows) {
            lines.push(`  ${label}: ${value}`);
        }
        lines.push('');
    }

    if (config.subtitle) {
        lines.push(config.subtitle);
        lines.push('');
    }

    // Data table
    lines.push('DETAILS');
    lines.push('─'.repeat(40));
    lines.push('');

    // Calculate column widths for alignment
    const colWidths = config.columns.map(c => {
        const headerLen = c.header.length;
        let maxDataLen = 0;
        for (const row of config.rows.slice(0, 100)) {
            const val = row[c.key];
            const len = val != null ? String(val).length : 1;
            if (len > maxDataLen) maxDataLen = len;
        }
        return Math.min(Math.max(headerLen, maxDataLen) + 2, 30);
    });

    // Header row
    lines.push(
        config.columns.map((c, i) => c.header.padEnd(colWidths[i])).join('  ')
    );
    lines.push(
        config.columns.map((_, i) => '─'.repeat(colWidths[i])).join('  ')
    );

    // Data rows (limit to 80 for email readability)
    const displayRows = config.rows.slice(0, 80);
    for (const row of displayRows) {
        lines.push(
            config.columns.map((c, i) => {
                const val = row[c.key];
                const text = val != null ? String(val) : '–';
                return text.slice(0, colWidths[i]).padEnd(colWidths[i]);
            }).join('  ')
        );
    }

    if (config.rows.length > 80) {
        lines.push('');
        lines.push(`... and ${config.rows.length - 80} additional record(s) not shown.`);
        lines.push('Please refer to the attached PDF/Excel export for the complete dataset.');
    }

    lines.push('');
    lines.push('─'.repeat(40));
    lines.push('');
    lines.push('Please action the above items at your earliest convenience.');
    lines.push('Should you have any queries, please do not hesitate to reach out.');
    lines.push('');
    lines.push('Kind regards,');
    lines.push('MATA Fleet Monitor');
    lines.push('Matanuska Transport Operations');

    const body = encodeURIComponent(lines.join('\n'));
    const toParam = to.join('; ');
    const ccParam = cc.join('; ');

    window.open(
        `mailto:${toParam}?cc=${ccParam}&subject=${subject}&body=${body}`,
        '_self'
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE-SPECIFIC EXPORTERS
// ═══════════════════════════════════════════════════════════════════════════

// ── Trip Alerts ──────────────────────────────────────────────────────────────

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
        { header: 'Status', key: 'alert_status', width: 20, excelWidth: 14 },
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

// ── Faults ───────────────────────────────────────────────────────────────────

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
        { header: 'Date', key: 'date', width: 22, excelWidth: 14 },
    ];

    const rows = faults.map(f => ({
        fleet: f.vehicles?.fleet_number || 'N/A',
        registration: f.vehicles?.registration_number || '',
        fault_number: f.fault_number,
        description: f.fault_description,
        reported_by: f.reported_by,
        date: format(new Date(f.reported_date), 'dd MMM yyyy'),
    }));

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

// ── Maintenance ──────────────────────────────────────────────────────────────

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
        { header: 'Overdue', key: 'overdue', width: 28, excelWidth: 18 },
        { header: 'Assigned To', key: 'assigned_to', width: 28, excelWidth: 20 },
        { header: 'Due Date', key: 'due_date', width: 22, excelWidth: 14 },
    ];

    const rows = items.map(m => {
        const unit = m.overdue_type === 'hours' ? 'hrs' : m.overdue_type === 'km' ? 'km' : 'days';
        const overdueLabel = m.overdue_amount != null
            ? `${Math.round(m.overdue_amount).toLocaleString()} ${unit} overdue`
            : '';

        return {
            fleet: m.vehicles?.fleet_number || 'N/A',
            registration: m.vehicles?.registration_number || '',
            title: m.title,
            overdue: overdueLabel,
            assigned_to: m.assigned_to || 'Unassigned',
            due_date: format(new Date(m.due_date), 'dd MMM yyyy'),
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

// ── Breakdowns ───────────────────────────────────────────────────────────────

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
        { header: 'Severity', key: 'severity', width: 16, excelWidth: 12 },
        { header: 'Status', key: 'status', width: 20, excelWidth: 14 },
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

// ── Diesel Debriefs ──────────────────────────────────────────────────────────

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
        { header: 'Litres', key: 'litres', width: 16, excelWidth: 10 },
        { header: 'Cost', key: 'cost', width: 22, excelWidth: 14 },
        { header: 'Distance', key: 'distance', width: 18, excelWidth: 12 },
        { header: 'Actual km/L', key: 'actual', width: 18, excelWidth: 12 },
        { header: 'Standard km/L', key: 'standard', width: 20, excelWidth: 14 },
    ];

    const rows = records.map(r => ({
        driver: r.driver_name,
        fleet: r.fleet_number,
        date: format(new Date(r.date), 'dd MMM yyyy'),
        station: r.fuel_station || '',
        litres: r.litres_filled != null ? `${r.litres_filled.toFixed(1)} L` : '',
        cost: r.total_cost != null ? `${r.currency || 'ZAR'} ${r.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
        distance: r.distance_travelled != null ? `${r.distance_travelled.toFixed(0)} km` : '',
        actual: r.km_per_litre != null ? r.km_per_litre.toFixed(2) : '',
        standard: r.expected_km_per_litre != null ? r.expected_km_per_litre.toFixed(2) : '',
    }));

    const driverCount = new Set(records.map(r => r.driver_name)).size;

    dispatch(target, {
        title: 'Pending Diesel Debriefs Report',
        subtitle: `${records.length} transaction${records.length !== 1 ? 's' : ''} across ${driverCount} driver${driverCount !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'pending-debriefs',
        summaryRows: [
            ['Total Transactions', String(records.length)],
            ['Drivers', String(driverCount)],
        ],
        emailCategory: 'diesel',
    });
}

// ── Driver Behavior ──────────────────────────────────────────────────────────

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
        { header: 'Severity', key: 'severity', width: 16, excelWidth: 12 },
        { header: 'Points', key: 'points', width: 12, excelWidth: 8 },
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
        points: e.points != null ? String(e.points) : '',
    }));

    dispatch(target, {
        title: 'Driver Behavior Events Report',
        subtitle: `${events.length} event${events.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'driver-behavior',
        summaryRows: [['Total Events', String(events.length)]],
        emailCategory: 'driver_behavior',
    });
}

// ── Incidents ────────────────────────────────────────────────────────────────

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
        { header: 'Status', key: 'status', width: 16, excelWidth: 12 },
        { header: 'Date / Time', key: 'datetime', width: 24, excelWidth: 18 },
        { header: 'Est. Cost', key: 'cost', width: 18, excelWidth: 14 },
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
        cost: i.total_cost != null && i.total_cost > 0 ? `R ${i.total_cost.toLocaleString()}` : '',
    }));

    const open = incidents.filter(i => i.status === 'open').length;
    const processing = incidents.filter(i => i.status === 'processing').length;

    dispatch(target, {
        title: 'Incidents Report',
        subtitle: `${incidents.length} open incident${incidents.length !== 1 ? 's' : ''}`,
        columns,
        rows,
        filename: 'incidents',
        summaryRows: [
            ['Total', String(incidents.length)],
            ['Open', String(open)],
            ['Processing', String(processing)],
        ],
        emailCategory: 'incidents',
    });
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

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
// ── Document Alerts (Outlook only — PDF/Excel handled by documentExport.ts) ─

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
        { header: 'Expiry Date', key: 'expiry', excelWidth: 14 },
        { header: 'Days', key: 'days', excelWidth: 10 },
        { header: 'Status', key: 'status', excelWidth: 14 },
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