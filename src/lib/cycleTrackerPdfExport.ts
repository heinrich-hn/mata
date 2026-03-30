import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ───────────────────────────────────────────────────────────

interface CycleTracker {
    id: string;
    trip_id: string;
    truck_type: 'reefer' | 'flatbed' | null;
    route: string | null;
    current_phase: number;
    is_completed: boolean;
    created_at: string | null;
    updated_at: string | null;
    p1_inspection_start: string | null;
    p1_inspection_end: string | null;
    p1_refuel_start: string | null;
    p1_refuel_end: string | null;
    p1_reefer_start_time: string | null;
    p1_reefer_start_temp: number | null;
    p1_yard_departure: string | null;
    p2_farm_arrival: string | null;
    p2_loading_start: string | null;
    p2_loading_end: string | null;
    p2_farm_departure: string | null;
    p2_delay_reason: string[] | null;
    p2_delay_other_detail: string | null;
    p2_farm_supervisor: string | null;
    p4_depot_arrival: string | null;
    p4_offloading_start: string | null;
    p4_offloading_end: string | null;
    p4_reefer_arrival_temp: number | null;
    p5_crates_count: number | null;
    p5_bins_count: number | null;
    p5_damaged_packaging: boolean | null;
    p5_damaged_details: string | null;
    p5_depot_departure: string | null;
    p5_depot_supervisor: string | null;
    p6_yard_arrival: string | null;
    p6_unloading_start: string | null;
    p6_unloading_end: string | null;
    p6_road_comments: string | null;
}

interface TransitStop {
    id: string;
    sort_order: number;
    location: string;
    reason: string;
    time_in: string | null;
    time_out: string | null;
    duration_mins: number | null;
}

interface JsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────

const DELAY_LABELS: Record<string, string> = {
    packaging_shortage: 'Packaging Shortage',
    labor_shortage: 'Labor Shortage',
    fruit_not_harvested: 'Fruit not Harvested',
    qc_delay: 'QC Delay',
    mechanical: 'Mechanical',
    other: 'Other',
};

function fmtDT(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function calcDuration(start: string | null, end: string | null): string {
    if (!start || !end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0) return '—';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return `${hrs}h ${rm}m`;
}

function calcMins(start: string | null, end: string | null): number | null {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return ms > 0 ? Math.round(ms / 60000) : null;
}

// ─── PDF Generation ──────────────────────────────────────────────────

const HEAD_BG: [number, number, number] = [30, 41, 59]; // Slate-800
const PHASE_COMPLETE: [number, number, number] = [16, 185, 129]; // Emerald-500
const PHASE_PROGRESS: [number, number, number] = [59, 130, 246]; // Blue-500
const PHASE_PENDING: [number, number, number] = [156, 163, 175]; // Gray-400
const SECTION_BG: [number, number, number] = [241, 245, 249]; // Slate-100
const WARN_BG: [number, number, number] = [254, 243, 199]; // Amber-100

export function generateCycleTrackerPDF(
    tracker: CycleTracker,
    stops: TransitStop[],
    tripNumber: string,
    route?: string,
): void {
    const doc = new jsPDF() as JsPDFWithAutoTable;
    const pw = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 0;

    const phaseStatus = (phase: number) => {
        if (tracker.current_phase > phase || tracker.is_completed) return 'completed';
        if (tracker.current_phase === phase) return 'in-progress';
        return 'pending';
    };

    // ── Header Banner ──
    doc.setFillColor(...HEAD_BG);
    doc.rect(0, 0, pw, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('360° Transport Cycle Report', margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Trip: ${tripNumber}`, margin, 22);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pw - margin, 14, { align: 'right' });
    doc.text(
        `Status: ${tracker.is_completed ? 'Completed' : `Phase ${tracker.current_phase}/6`}`,
        pw - margin,
        22,
        { align: 'right' },
    );
    y = 38;

    // ── Trip Overview ──
    doc.setTextColor(0, 0, 0);
    const overviewRows: [string, string][] = [
        ['Truck Type', tracker.truck_type ? tracker.truck_type.charAt(0).toUpperCase() + tracker.truck_type.slice(1) : '—'],
        ['Route', route || tracker.route || '—'],
        ['Last Updated', fmtDT(tracker.updated_at)],
    ];

    autoTable(doc, {
        startY: y,
        body: overviewRows,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 100] },
            1: { cellWidth: pw - 2 * margin - 40 },
        },
        margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── Phase Helper ──
    const addPhaseHeader = (title: string, phase: number) => {
        checkPage(20);
        const status = phaseStatus(phase);
        const color = status === 'completed' ? PHASE_COMPLETE : status === 'in-progress' ? PHASE_PROGRESS : PHASE_PENDING;
        doc.setFillColor(...color);
        doc.circle(margin + 4, y + 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(String(phase), margin + 4, y + 5.5, { align: 'center' });
        doc.setTextColor(...HEAD_BG);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(title, margin + 12, y + 5.5);
        doc.setFont('helvetica', 'normal');
        y += 12;
    };

    const addKV = (key: string, value: string) => {
        checkPage(8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(key, margin + 4, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(value, margin + 55, y);
        y += 6;
    };

    const addDurationKV = (key: string, start: string | null, end: string | null, target?: number) => {
        const dur = calcDuration(start, end);
        const mins = calcMins(start, end);
        const overTarget = target && mins ? mins > target : false;
        const suffix = target ? ` (target: ${target}m)` : '';
        checkPage(8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(key, margin + 4, y);
        doc.setFont('helvetica', 'normal');
        if (overTarget) {
            doc.setTextColor(217, 119, 6); // Amber-600
        } else {
            doc.setTextColor(0, 0, 0);
        }
        doc.text(`${dur}${suffix}`, margin + 55, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
    };

    const addSeparator = () => {
        y += 2;
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pw - margin, y);
        y += 4;
    };

    const checkPage = (needed: number) => {
        if (y + needed > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = 16;
        }
    };

    // ── Phase 1: Preparation ──
    addPhaseHeader('Phase 1: Preparation (Transport Yard)', 1);
    addKV('Inspection Start', fmtDT(tracker.p1_inspection_start));
    addKV('Inspection End', fmtDT(tracker.p1_inspection_end));
    addDurationKV('Inspection Duration', tracker.p1_inspection_start, tracker.p1_inspection_end, 45);
    addKV('Refuel Start', fmtDT(tracker.p1_refuel_start));
    addKV('Refuel End', fmtDT(tracker.p1_refuel_end));
    addDurationKV('Refuel Duration', tracker.p1_refuel_start, tracker.p1_refuel_end, 60);
    if (tracker.truck_type === 'reefer') {
        addKV('Reefer Unit Started', fmtDT(tracker.p1_reefer_start_time));
        addKV('Start Temperature', tracker.p1_reefer_start_temp != null ? `${tracker.p1_reefer_start_temp}°C` : '—');
    }
    addKV('Departure from Yard', fmtDT(tracker.p1_yard_departure));
    addSeparator();

    // ── Phase 2: Farm Loading ──
    addPhaseHeader('Phase 2: Farm Loading (Origin)', 2);
    addKV('Arrival at Farm Gate', fmtDT(tracker.p2_farm_arrival));
    addKV('Loading Start', fmtDT(tracker.p2_loading_start));
    addKV('Loading End', fmtDT(tracker.p2_loading_end));
    addKV('Departure from Farm', fmtDT(tracker.p2_farm_departure));
    addDurationKV('Loading Duration', tracker.p2_loading_start, tracker.p2_loading_end);
    addDurationKV('Farm Dwell Time', tracker.p2_farm_arrival, tracker.p2_farm_departure, 120);
    if (tracker.p2_delay_reason && tracker.p2_delay_reason.length > 0) {
        const reasons = tracker.p2_delay_reason.map(r => DELAY_LABELS[r] || r).join(', ');
        addKV('Delay Reasons', reasons);
        if (tracker.p2_delay_other_detail) {
            addKV('Delay Detail', tracker.p2_delay_other_detail);
        }
    }
    if (tracker.p2_farm_supervisor) {
        addKV('Farm Supervisor', tracker.p2_farm_supervisor);
    }
    addSeparator();

    // ── Phase 3: In-Transit Log ──
    addPhaseHeader('Phase 3: In-Transit Log', 3);
    if (stops.length === 0) {
        checkPage(8);
        doc.setFontSize(9);
        doc.setTextColor(130, 130, 130);
        doc.text('No transit stops logged.', margin + 4, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
    } else {
        autoTable(doc, {
            startY: y,
            head: [['#', 'Location', 'Reason', 'Time In', 'Time Out', 'Duration']],
            body: stops.map((s, i) => [
                String(i + 1),
                s.location,
                s.reason,
                fmtDT(s.time_in),
                fmtDT(s.time_out),
                s.duration_mins != null ? `${s.duration_mins} min` : '—',
            ]),
            theme: 'striped',
            headStyles: { fillColor: SECTION_BG, textColor: [50, 50, 50], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 0: { cellWidth: 8 } },
            margin: { left: margin, right: margin },
        });
        y = doc.lastAutoTable.finalY + 2;
        const totalTransitMins = stops.reduce((sum, s) => sum + (s.duration_mins || 0), 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Stop Time: ${totalTransitMins} min`, pw - margin, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 6;
    }
    addSeparator();

    // ── Phase 4: Depot Arrival ──
    addPhaseHeader('Phase 4: Depot Arrival & Offloading', 4);
    addKV('Arrival at Depot', fmtDT(tracker.p4_depot_arrival));
    if (tracker.truck_type === 'reefer') {
        addKV('Reefer Temp on Arrival', tracker.p4_reefer_arrival_temp != null ? `${tracker.p4_reefer_arrival_temp}°C` : '—');
    }
    addKV('Offloading Start', fmtDT(tracker.p4_offloading_start));
    addKV('Offloading End', fmtDT(tracker.p4_offloading_end));
    addDurationKV('Offloading Duration', tracker.p4_offloading_start, tracker.p4_offloading_end);
    addDurationKV('Depot Dwell Time', tracker.p4_depot_arrival, tracker.p4_offloading_end);
    addSeparator();

    // ── Phase 5: Return Leg ──
    addPhaseHeader('Phase 5: Return Leg (Packaging)', 5);
    addKV('Crates', tracker.p5_crates_count != null ? String(tracker.p5_crates_count) : '—');
    addKV('Bins', tracker.p5_bins_count != null ? String(tracker.p5_bins_count) : '—');
    addKV('Damaged Packaging', tracker.p5_damaged_packaging ? 'Yes' : 'No');
    if (tracker.p5_damaged_packaging && tracker.p5_damaged_details) {
        addKV('Damage Details', tracker.p5_damaged_details);
    }
    addKV('Departure from Depot', fmtDT(tracker.p5_depot_departure));
    if (tracker.p5_depot_supervisor) {
        addKV('Depot Supervisor', tracker.p5_depot_supervisor);
    }
    addSeparator();

    // ── Phase 6: Completing the Loop ──
    addPhaseHeader('Phase 6: Completing the Loop', 6);
    addKV('Arrival at Yard/Farm', fmtDT(tracker.p6_yard_arrival));
    addKV('Unloading Start', fmtDT(tracker.p6_unloading_start));
    addKV('Unloading End', fmtDT(tracker.p6_unloading_end));
    addDurationKV('Unloading Duration', tracker.p6_unloading_start, tracker.p6_unloading_end);
    if (tracker.p6_road_comments) {
        addKV('Road Comments', tracker.p6_road_comments);
    }
    addSeparator();

    // ── Cycle Summary ──
    checkPage(50);
    doc.setFillColor(...SECTION_BG);
    doc.rect(margin, y, pw - 2 * margin, 8, 'F');
    doc.setTextColor(...HEAD_BG);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total Cycle Summary', margin + 4, y + 5.5);
    doc.setFont('helvetica', 'normal');
    y += 12;

    const totalTransitMins = stops.reduce((sum, s) => sum + (s.duration_mins || 0), 0);

    const summaryRows: [string, string][] = [
        ['Transport Yard → Farm', calcDuration(tracker.p1_yard_departure, tracker.p2_farm_arrival)],
        ['Farm Dwell Time', calcDuration(tracker.p2_farm_arrival, tracker.p2_farm_departure)],
        [
            'Transit Time (incl. stops)',
            `${calcDuration(tracker.p2_farm_departure, tracker.p4_depot_arrival)}${totalTransitMins > 0 ? ` (${totalTransitMins} min in stops)` : ''}`,
        ],
        ['Depot Dwell Time', calcDuration(tracker.p4_depot_arrival, tracker.p5_depot_departure)],
        ['Return Leg', calcDuration(tracker.p5_depot_departure, tracker.p6_yard_arrival)],
    ];

    autoTable(doc, {
        startY: y,
        body: summaryRows,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60, textColor: [100, 100, 100] },
            1: { halign: 'right' },
        },
        margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 2;

    // Total row
    checkPage(12);
    doc.setFillColor(...WARN_BG);
    doc.rect(margin, y, pw - 2 * margin, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...HEAD_BG);
    doc.text('TOTAL 360° CYCLE TIME', margin + 4, y + 7);
    doc.text(
        calcDuration(tracker.p1_yard_departure, tracker.p6_yard_arrival),
        pw - margin - 4,
        y + 7,
        { align: 'right' },
    );
    y += 14;

    // ── Footer on all pages ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const ph = doc.internal.pageSize.getHeight();
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, ph - 14, pw - margin, ph - 14);
        doc.setTextColor(130, 130, 130);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${totalPages}`, pw / 2, ph - 8, { align: 'center' });
        doc.text('Matanuska — 360° Cycle Report', margin, ph - 8);
    }

    doc.save(`360_Cycle_Report_${tripNumber}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
