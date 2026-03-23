import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface JsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

export interface DebriefRecord {
    id: string;
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

type GroupedDrivers = [string, DebriefRecord[]][];

function formatCurrency(amount: number | null, currency: string | null): string {
    if (amount == null) return '-';
    return `${currency || 'ZAR'} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate a PDF of all pending debriefs grouped by driver
 */
export function generateDebriefPDF(grouped: GroupedDrivers) {
    const doc = new jsPDF() as JsPDFWithAutoTable;
    const pw = doc.internal.pageSize.getWidth();
    const totalRecords = grouped.reduce((sum, [, recs]) => sum + recs.length, 0);

    // Title
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.setFont('helvetica', 'bold');
    doc.text('Pending Diesel Debriefs', pw / 2, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    // Meta
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 30);
    doc.text(`Drivers: ${grouped.length}  |  Transactions: ${totalRecords}`, 14, 36);

    let y = 46;

    for (const [driverName, records] of grouped) {
        if (y > 250) { doc.addPage(); y = 20; }

        // Driver header
        doc.setFillColor(240, 240, 240);
        doc.rect(14, y - 5, pw - 28, 10, 'F');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(`${driverName}  (${records.length})`, 16, y);
        doc.setFont('helvetica', 'normal');
        y += 8;

        const rows = records.map(r => [
            format(new Date(r.date), 'dd MMM yyyy'),
            r.fleet_number,
            r.fuel_station || '-',
            r.litres_filled != null ? `${r.litres_filled.toFixed(1)} L` : '-',
            formatCurrency(r.total_cost, r.currency),
            r.distance_travelled != null ? `${r.distance_travelled.toFixed(0)} km` : '-',
            r.km_per_litre != null ? r.km_per_litre.toFixed(2) : '-',
            r.expected_km_per_litre != null ? r.expected_km_per_litre.toFixed(2) : '-',
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Date', 'Fleet', 'Station', 'Litres', 'Cost', 'Distance', 'Actual', 'Standard']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 16 },
                2: { cellWidth: 30 },
                3: { cellWidth: 18 },
                4: { cellWidth: 26 },
                5: { cellWidth: 20 },
                6: { cellWidth: 16 },
                7: { cellWidth: 24 },
            },
            margin: { left: 14, right: 14 },
        });

        y = (doc.lastAutoTable?.finalY ?? y + rows.length * 10) + 12;
    }

    doc.save(`pending-debriefs-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

/**
 * Generate a PDF for a single driver's pending debriefs
 */
export function generateDriverDebriefPDF(driverName: string, records: DebriefRecord[]) {
    generateDebriefPDF([[driverName, records]]);
}

/**
 * Build a WhatsApp message summarising pending debriefs
 */
export function buildDebriefWhatsAppMessage(grouped: GroupedDrivers): string {
    const totalRecords = grouped.reduce((sum, [, recs]) => sum + recs.length, 0);
    const lines: string[] = [
        '🚛 *Pending Diesel Debriefs*',
        `📅 ${format(new Date(), 'dd MMM yyyy')}`,
        `👤 ${grouped.length} driver${grouped.length !== 1 ? 's' : ''} | 📋 ${totalRecords} transaction${totalRecords !== 1 ? 's' : ''}`,
        '',
    ];

    for (const [driverName, records] of grouped) {
        lines.push(`*${driverName}* (${records.length}):`);
        for (const r of records) {
            const parts = [
                `  • ${r.fleet_number}`,
                format(new Date(r.date), 'dd MMM'),
            ];
            if (r.litres_filled != null) parts.push(`${r.litres_filled.toFixed(0)}L`);
            if (r.km_per_litre != null && r.expected_km_per_litre != null) {
                parts.push(`${r.km_per_litre.toFixed(1)}/${r.expected_km_per_litre.toFixed(1)} km/L`);
            } else if (r.km_per_litre != null) {
                parts.push(`${r.km_per_litre.toFixed(1)} km/L`);
            }
            lines.push(parts.join(' | '));
        }
        lines.push('');
    }

    lines.push('_Please action these outstanding debriefs._');
    return lines.join('\n');
}

/**
 * Build a WhatsApp message for a single driver
 */
export function buildDriverWhatsAppMessage(driverName: string, records: DebriefRecord[]): string {
    return buildDebriefWhatsAppMessage([[driverName, records]]);
}

/**
 * Normalise a South African phone number for WhatsApp
 */
function normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 10) return '27' + digits.slice(1);
    if (digits.length === 9) return '27' + digits;
    return digits;
}

/**
 * Open WhatsApp with a pre-filled message
 */
export function openWhatsApp(message: string, phone?: string): void {
    const encoded = encodeURIComponent(message);
    const url = phone
        ? `https://wa.me/${normalisePhone(phone)}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}
