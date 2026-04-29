import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDriverPlanning } from '@/hooks/useDriverPlanning';
import { AT_WORK_LOCATIONS } from '@/hooks/useDriverPlanning';
import type { DayStatus, DriverLeave, DriverPlanningData } from '@/hooks/useDriverPlanning';
import {
    createWorkbook,
    saveWorkbook,
    addStyledSheet,
    addSummarySheet,
    generatedSubtitle,
    statusColours,
    styleHeaderRow,
    styleBodyRow,
    bodyFont,
    headerFill,
    headerFont,
    headerAlign,
    thinBorder,
    addTitle,
    addSubtitle,
    colLetter,
} from '@/utils/excelStyles';
import AddDriverLeaveDialog from './AddDriverLeaveDialog';
import DriverActivityModal from './DriverActivityModal';
import {
    subMonths,
    addMonths,
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    getDay,
    isToday,
    isFuture,
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Download,
    FileSpreadsheet,
    Loader2,
    MapPin,
    Plus,
    X,
} from 'lucide-react';
import { useState } from 'react';

const DAY_STATUS_COLORS: Record<DayStatus, string> = {
    at_work: 'bg-emerald-500',
    on_trip: 'bg-emerald-600',
    leave: 'bg-sky-500',
    off: 'bg-slate-200',
    off_day: 'bg-purple-300',
};

const DAY_STATUS_LABELS: Record<DayStatus, string> = {
    at_work: 'At Work',
    on_trip: 'On Trip',
    leave: 'On Leave',
    off: 'Off',
    off_day: 'Off Day',
};

export default function DriverPlanningSection() {
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
    const [editingLeave, setEditingLeave] = useState<DriverLeave | null>(null);
    const [deletingLeaveId, setDeletingLeaveId] = useState<string | null>(null);
    const [modalDriver, setModalDriver] = useState<string | null>(null);

    const {
        planningData,
        isLoading,
        activeDrivers,
        getDriverFullName,
        setDayStatus,
        clearDayStatus,
        createLeave,
        updateLeave,
        deleteLeave,
        isCreatingLeave,
        isUpdatingLeave,
        isDeletingLeave,
    } = useDriverPlanning(selectedMonth);

    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(selectedMonth),
        end: endOfMonth(selectedMonth),
    });

    const overworkedCount = planningData.filter((d) => d.isOverworked).length;
    const monthLabel = format(selectedMonth, 'MMMM yyyy');

    const handlePrevMonth = () => setSelectedMonth((prev) => subMonths(prev, 1));
    const handleNextMonth = () => setSelectedMonth((prev) => addMonths(prev, 1));

    const handleEditLeave = (leave: DriverLeave) => {
        setEditingLeave(leave);
        setIsLeaveDialogOpen(true);
    };

    const handleDeleteLeave = async () => {
        if (deletingLeaveId) {
            await deleteLeave(deletingLeaveId);
            setDeletingLeaveId(null);
        }
    };

    const handleAddLeave = () => {
        setEditingLeave(null);
        setIsLeaveDialogOpen(true);
    };

    // ─── Location Breakdown Helper ───────────────────────────────────────────
    // Build a map of { location -> days } for at_work days.
    // - Trip days are bucketed under "On Trip" (auto-derived).
    // - Manual at_work days use the dayNote (location); empty notes go to "Unspecified".
    const buildLocationBreakdown = (driver: DriverPlanningData): Array<{ location: string; days: number }> => {
        const counts: Record<string, number> = {};
        for (const day of daysInMonth) {
            const key = format(day, 'yyyy-MM-dd');
            const status = driver.dayStatuses[key] || 'off';
            if (status !== 'at_work') continue;
            const tripName = driver.tripDays[key];
            const note = driver.dayNotes[key];
            const bucket = tripName ? 'On Trip' : (note && note.trim() ? note.trim() : 'Unspecified');
            counts[bucket] = (counts[bucket] || 0) + 1;
        }
        return Object.entries(counts)
            .map(([location, days]) => ({ location, days }))
            .sort((a, b) => b.days - a.days);
    };

    // ─── Bulk Export: All Drivers Excel ──────────────────────────────────────

    const handleExportAllExcel = async () => {
        const wb = createWorkbook();

        // ━━━ Sheet 1: Driver Summary (statistics per driver) ━━━
        const totalWorkDays = planningData.reduce((s, d) => s + d.daysAtWork, 0);
        const totalTripDays = planningData.reduce((s, d) => s + d.daysOnTrip, 0);
        const totalLeaveDays = planningData.reduce((s, d) => s + d.daysOnLeave, 0);
        const totalOffDays = planningData.reduce((s, d) => s + d.daysOffDay, 0);
        const overworkedDrivers = planningData.filter((d) => d.isOverworked);

        addStyledSheet(wb, 'Driver Summary', {
            title: `Driver Planning Summary – ${monthLabel}`,
            subtitle: generatedSubtitle(`${planningData.length} active drivers • ${daysInMonth.length} days in month`),
            headers: ['Driver', 'Work Days', 'Trip Days', 'Leave Days', 'Off Days (Applied)', 'Off (Unassigned)', 'Max Streak', 'Status', 'Trips This Month'],
            rows: planningData.map((d) => [
                d.driverName,
                String(d.daysAtWork),
                String(d.daysOnTrip),
                String(d.daysOnLeave),
                String(d.daysOffDay),
                String(d.daysOff),
                `${d.maxConsecutiveWorkingDays} days`,
                d.isOverworked ? 'OVERWORKED' : 'Normal',
                d.trips.length > 0 ? d.trips.map((t) => t.trip_number || 'N/A').join(', ') : 'None',
            ]),
            cellStyler: (rowData, colIndex) => {
                if (colIndex === 8) {
                    const status = String(rowData[7] || '').toLowerCase();
                    if (status === 'overworked') return { ...bodyFont, color: { argb: 'DC2626' }, bold: true };
                    return { ...bodyFont, color: { argb: '16A34A' } };
                }
                return undefined;
            },
        });

        // ━━━ Sheet: Workdays by Location (per driver breakdown) ━━━
        {
            // Build per-driver breakdown rows. Each driver gets one row per location.
            const breakdownRows: (string | number)[][] = [];
            for (const driver of planningData) {
                const breakdown = buildLocationBreakdown(driver);
                if (breakdown.length === 0) {
                    breakdownRows.push([driver.driverName, '—', 0, driver.daysAtWork]);
                    continue;
                }
                breakdown.forEach((entry, i) => {
                    breakdownRows.push([
                        i === 0 ? driver.driverName : '',
                        entry.location,
                        entry.days,
                        i === 0 ? driver.daysAtWork : '',
                    ]);
                });
            }
            // Aggregate fleet-wide totals by location
            const fleetTotals: Record<string, number> = {};
            for (const driver of planningData) {
                for (const { location, days } of buildLocationBreakdown(driver)) {
                    fleetTotals[location] = (fleetTotals[location] || 0) + days;
                }
            }
            const fleetRows = Object.entries(fleetTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([loc, days]): (string | number)[] => ['', `Σ ${loc}`, days, '']);

            addStyledSheet(wb, 'Workdays by Location', {
                title: `Workdays by Location – ${monthLabel}`,
                subtitle: generatedSubtitle(`${planningData.length} drivers • ${totalWorkDays} total work days`),
                headers: ['Driver', 'Location', 'Days', 'Driver Total'],
                rows: [
                    ...breakdownRows,
                    ['', '', '', ''],
                    ['── Fleet Totals by Location ──', '', '', ''],
                    ...fleetRows,
                    ['', 'TOTAL', totalWorkDays, ''],
                ],
                cellStyler: (rowData, colIndex) => {
                    const loc = String(rowData[1] || '');
                    if (loc.startsWith('Σ') || loc === 'TOTAL') {
                        return { ...bodyFont, bold: true, color: { argb: '1F3864' } };
                    }
                    if (colIndex === 3 && rowData[3] !== '') {
                        return { ...bodyFont, bold: true };
                    }
                    return undefined;
                },
            });
        }

        // ━━━ Sheet 2: Monthly Calendar Grid (colorful calendar-style) ━━━
        {
            const calWs = wb.addWorksheet('Monthly Calendar');
            const numDays = daysInMonth.length;
            const lastColStr = colLetter(numDays + 7); // driver + days + 6 summary cols

            addTitle(calWs, `All Drivers – Monthly Calendar – ${monthLabel}`, lastColStr);
            addSubtitle(calWs, generatedSubtitle(monthLabel), lastColStr);

            // Status fill colours (ARGB)
            const FILL_WORK = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'D1FAE5' } };   // emerald-100
            const FILL_TRIP = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'A7F3D0' } };   // emerald-200
            const FILL_LEAVE = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'BAE6FD' } };  // sky-200
            const FILL_OFF_DAY = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'E9D5FF' } }; // purple-200
            const FILL_OFF = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F1F5F9' } };    // slate-100
            const FILL_WEEKEND = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FEF3C7' } }; // amber-100 (weekend header tint)

            const FONT_WORK = { size: 8, name: 'Calibri', color: { argb: '065F46' }, bold: true } as const;   // emerald-800
            const FONT_TRIP = { size: 8, name: 'Calibri', color: { argb: '064E3B' }, bold: true } as const;   // emerald-900
            const FONT_LEAVE = { size: 8, name: 'Calibri', color: { argb: '0369A1' }, bold: true } as const;  // sky-700
            const FONT_OFF_DAY = { size: 8, name: 'Calibri', color: { argb: '6B21A8' }, bold: true } as const; // purple-800
            const FONT_OFF = { size: 8, name: 'Calibri', color: { argb: '94A3B8' } } as const;               // slate-400

            // ── Legend row (row 3) ──
            const legendRow = calWs.getRow(3);
            const legends = [
                { label: '■ Work', fill: FILL_WORK, font: FONT_WORK },
                { label: '■ Trip', fill: FILL_TRIP, font: FONT_TRIP },
                { label: '■ Leave', fill: FILL_LEAVE, font: FONT_LEAVE },
                { label: '■ Off Day', fill: FILL_OFF_DAY, font: FONT_OFF_DAY },
                { label: '■ Off', fill: FILL_OFF, font: FONT_OFF },
                { label: '■ Weekend', fill: FILL_WEEKEND, font: { size: 8, name: 'Calibri', color: { argb: '92400E' } } as const },
            ];
            legends.forEach((l, i) => {
                const c = legendRow.getCell(2 + i);
                c.value = l.label;
                c.fill = l.fill;
                c.font = l.font;
                c.border = thinBorder;
                c.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            legendRow.height = 18;

            // ── Header row (row 4) ──
            const hdrRow = 4;
            const calHeaders = ['Driver', ...daysInMonth.map((d) => format(d, 'dd')), 'Work', 'Trip', 'Leave', 'OD', 'Off', 'Str'];
            calWs.getRow(hdrRow).values = calHeaders;
            styleHeaderRow(calWs, hdrRow);

            // Sub-header with day names (row 5)
            const dayNameRow = calWs.getRow(5);
            dayNameRow.getCell(1).value = '';
            daysInMonth.forEach((d, i) => {
                const c = dayNameRow.getCell(i + 2);
                c.value = format(d, 'EEE');
                const isWeekend = getDay(d) === 0 || getDay(d) === 6;
                c.fill = isWeekend ? FILL_WEEKEND : headerFill;
                c.font = { size: 7, name: 'Calibri', bold: true, color: { argb: isWeekend ? '92400E' : 'FFFFFF' } };
                c.alignment = headerAlign;
                c.border = thinBorder;
            });
            // Style summary header cells on day-name row
            for (let s = 0; s < 6; s++) {
                const c = dayNameRow.getCell(numDays + 2 + s);
                c.fill = headerFill;
                c.font = headerFont;
                c.alignment = headerAlign;
                c.border = thinBorder;
            }
            dayNameRow.height = 16;

            // ── Body rows (row 6+) ──
            planningData.forEach((driver, driverIdx) => {
                const rowNum = 6 + driverIdx;
                const row = calWs.getRow(rowNum);

                // Driver name
                const nameCell = row.getCell(1);
                nameCell.value = driver.driverName;
                nameCell.font = { size: 9, name: 'Calibri', bold: true };
                nameCell.border = thinBorder;
                nameCell.alignment = { vertical: 'middle' };

                // Day cells with colour fills
                daysInMonth.forEach((day, dayIdx) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const status = driver.dayStatuses[key] || 'off';
                    const tripName = driver.tripDays[key];
                    const note = driver.dayNotes[key];
                    const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                    const cell = row.getCell(dayIdx + 2);
                    cell.border = thinBorder;
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                    // Determine label, fill, and font based on status
                    if (tripName) {
                        cell.value = tripName;
                        cell.fill = FILL_TRIP;
                        cell.font = FONT_TRIP;
                    } else if (status === 'at_work' && note) {
                        cell.value = note;
                        cell.fill = FILL_WORK;
                        cell.font = FONT_WORK;
                    } else if (status === 'at_work') {
                        cell.value = '✓';
                        cell.fill = FILL_WORK;
                        cell.font = FONT_WORK;
                    } else if (status === 'leave') {
                        cell.value = 'L';
                        cell.fill = FILL_LEAVE;
                        cell.font = FONT_LEAVE;
                    } else if (status === 'off_day') {
                        cell.value = 'OD';
                        cell.fill = FILL_OFF_DAY;
                        cell.font = FONT_OFF_DAY;
                    } else {
                        cell.value = isWeekend ? '' : '—';
                        cell.fill = isWeekend ? FILL_WEEKEND : FILL_OFF;
                        cell.font = FONT_OFF;
                    }
                });

                // Summary cells
                const summaryData = [
                    { val: driver.daysAtWork, font: FONT_WORK },
                    { val: driver.daysOnTrip, font: FONT_TRIP },
                    { val: driver.daysOnLeave, font: FONT_LEAVE },
                    { val: driver.daysOffDay, font: FONT_OFF_DAY },
                    { val: driver.daysOff, font: FONT_OFF },
                    { val: `${driver.maxConsecutiveWorkingDays}d`, font: driver.isOverworked ? { size: 9, name: 'Calibri', color: { argb: 'DC2626' }, bold: true } as const : { size: 9, name: 'Calibri' } as const },
                ];
                summaryData.forEach((s, i) => {
                    const c = row.getCell(numDays + 2 + i);
                    c.value = s.val;
                    c.font = s.font;
                    c.border = thinBorder;
                    c.alignment = { horizontal: 'center', vertical: 'middle' };
                });

                // Overworked row highlight
                if (driver.isOverworked) {
                    nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
                    nameCell.font = { size: 9, name: 'Calibri', bold: true, color: { argb: 'DC2626' } };
                }

                row.height = 22;
            });

            // Column widths
            calWs.getColumn(1).width = 22;
            for (let d = 0; d < numDays; d++) calWs.getColumn(d + 2).width = 12;
            for (let s = 0; s < 6; s++) calWs.getColumn(numDays + 2 + s).width = 7;

            // Freeze panes
            calWs.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];

            // Auto-filter on header row
            const lastDataRow = 5 + planningData.length;
            calWs.autoFilter = { from: `A${hdrRow}`, to: `${lastColStr}${lastDataRow}` };
        }

        // ━━━ Sheet 3: Trip Assignments (all trips with details) ━━━
        const allTrips: (string | number)[][] = [];
        for (const driver of planningData) {
            for (const trip of driver.trips) {
                allTrips.push([
                    driver.driverName,
                    trip.trip_number || '—',
                    trip.origin || '—',
                    trip.destination || '—',
                    trip.departure_date ? format(new Date(trip.departure_date), 'dd MMM yyyy') : '—',
                    trip.arrival_date ? format(new Date(trip.arrival_date), 'dd MMM yyyy') : '—',
                    trip.status || '—',
                    trip.vehicle_id || '—',
                ]);
            }
        }
        if (allTrips.length > 0) {
            addStyledSheet(wb, 'Trip Assignments', {
                title: `Trip Assignments – ${monthLabel}`,
                subtitle: generatedSubtitle(`${allTrips.length} trips across ${planningData.filter((d) => d.trips.length > 0).length} drivers`),
                headers: ['Driver', 'Load Ref / Trip #', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status', 'Vehicle'],
                rows: allTrips,
                cellStyler: (rowData, colIndex) => {
                    if (colIndex === 7) {
                        const status = String(rowData[6] || '').toLowerCase();
                        if (status === 'completed') return { ...bodyFont, color: { argb: '16A34A' }, bold: true };
                        if (status === 'in_progress' || status === 'in progress') return { ...bodyFont, color: { argb: '2563EB' }, bold: true };
                        if (status === 'scheduled') return { ...bodyFont, color: { argb: 'D97706' }, bold: true };
                    }
                    return undefined;
                },
            });
        }

        // ━━━ Sheet 4: Leave Schedule ━━━
        const allLeave: (string | number)[][] = [];
        for (const driver of planningData) {
            for (const leave of driver.leaveEntries) {
                const startDate = new Date(leave.start_date);
                const endDate = new Date(leave.end_date);
                const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                allLeave.push([
                    driver.driverName,
                    leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1),
                    format(startDate, 'dd MMM yyyy'),
                    format(endDate, 'dd MMM yyyy'),
                    `${days} days`,
                    leave.status.charAt(0).toUpperCase() + leave.status.slice(1),
                    leave.notes || '—',
                ]);
            }
        }
        if (allLeave.length > 0) {
            addStyledSheet(wb, 'Leave Schedule', {
                title: `Leave Schedule – ${monthLabel}`,
                subtitle: generatedSubtitle(`${allLeave.length} leave entries`),
                headers: ['Driver', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Status', 'Notes'],
                rows: allLeave,
                cellStyler: (rowData, colIndex) => {
                    if (colIndex === 6) {
                        const status = String(rowData[5] || '').toLowerCase();
                        if (status === 'approved') return { ...bodyFont, color: { argb: '16A34A' }, bold: true };
                        if (status === 'planned') return { ...bodyFont, color: { argb: 'D97706' }, bold: true };
                        if (status === 'rejected') return { ...bodyFont, color: { argb: 'DC2626' }, bold: true };
                    }
                    return undefined;
                },
            });
        }

        // ━━━ Sheet 5: Fleet Overview KPIs ━━━
        addSummarySheet(wb, 'Fleet Overview', {
            title: `Fleet Overview – ${monthLabel}`,
            subtitle: generatedSubtitle(monthLabel),
            rows: [
                ['Report Period', monthLabel],
                ['Total Active Drivers', planningData.length],
                ['Days in Month', daysInMonth.length],
                ['', ''],
                ['── Attendance ──', ''],
                ['Total Work Days (all drivers)', totalWorkDays],
                ['Total Trip Days (all drivers)', totalTripDays],
                ['Total Leave Days (all drivers)', totalLeaveDays],
                ['Total Off Days Applied', totalOffDays],
                ['Avg Work Days per Driver', planningData.length > 0 ? Math.round(totalWorkDays / planningData.length) : 0],
                ['Avg Trip Days per Driver', planningData.length > 0 ? Math.round(totalTripDays / planningData.length) : 0],
                ['', ''],
                ['── Overwork Alerts ──', ''],
                ['Drivers Flagged Overworked', overworkedDrivers.length],
                ...(overworkedDrivers.map((d): [string, string | number] => [`  ⚠ ${d.driverName}`, `${d.maxConsecutiveWorkingDays} consecutive days`])),
                ['', ''],
                ['── Trips ──', ''],
                ['Total Trips This Month', allTrips.length],
                ['Drivers With Trips', planningData.filter((d) => d.trips.length > 0).length],
                ['Drivers Without Trips', planningData.filter((d) => d.trips.length === 0).length],
            ],
        });

        // ━━━ Per-driver detail sheets ━━━
        for (const driver of planningData) {
            const safeName = driver.driverName.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 28);
            const ws = addStyledSheet(wb, safeName, {
                title: `${driver.driverName} – Complete Schedule`,
                subtitle: generatedSubtitle(`${monthLabel} • Work: ${driver.daysAtWork}d • Trip: ${driver.daysOnTrip}d • Leave: ${driver.daysOnLeave}d • Off Day: ${driver.daysOffDay}d • Off: ${driver.daysOff}d • Streak: ${driver.maxConsecutiveWorkingDays}d`),
                headers: ['Date', 'Day', 'Status', 'Load Ref / Trip #', 'Location', 'Trip Route', 'Notes'],
                rows: daysInMonth.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const status = driver.dayStatuses[key] || 'off';
                    const tripRef = driver.tripDays[key] || '';
                    const location = driver.dayNotes[key] || '';
                    // Find matching trip for route info
                    const matchingTrip = driver.trips.find((t) => {
                        if (!t.departure_date) return false;
                        const dep = t.departure_date;
                        const arr = t.arrival_date || t.departure_date;
                        return key >= dep && key <= arr;
                    });
                    const route = matchingTrip ? `${matchingTrip.origin || '?'} → ${matchingTrip.destination || '?'}` : '';
                    const notes = matchingTrip?.status ? `Status: ${matchingTrip.status}` : '';
                    return [
                        format(day, 'dd MMM yyyy'),
                        format(day, 'EEEE'),
                        DAY_STATUS_LABELS[status],
                        tripRef,
                        location,
                        route,
                        notes,
                    ];
                }),
                cellStyler: (rowData, colIndex) => {
                    if (colIndex === 3) {
                        const status = String(rowData[2] || '').toLowerCase().replace(/\s+/g, '_');
                        if (status === 'at_work') return { ...bodyFont, color: { argb: '16A34A' }, bold: true };
                        if (status === 'on_trip') return { ...bodyFont, color: { argb: '059669' }, bold: true };
                        if (status === 'on_leave') return { ...bodyFont, color: { argb: '0284C7' }, bold: true };
                        if (status === 'off_day') return { ...bodyFont, color: { argb: '7C3AED' }, bold: true };
                        return statusColours[status];
                    }
                    return undefined;
                },
            });

            // Add trip summary below the daily grid if the driver has trips
            if (driver.trips.length > 0) {
                const lastRow = ws.lastRow?.number || 0;
                const gapRow = lastRow + 2;
                ws.getCell(`A${gapRow}`).value = 'Trip Details';
                ws.getCell(`A${gapRow}`).font = { bold: true, size: 11, name: 'Calibri' };
                const tripHeaderRow = gapRow + 1;
                const tripHeaders = ['Load Ref / Trip #', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status', 'Vehicle'];
                ws.getRow(tripHeaderRow).values = tripHeaders;
                styleHeaderRow(ws, tripHeaderRow);
                driver.trips.forEach((trip, i) => {
                    const r = ws.getRow(tripHeaderRow + 1 + i);
                    r.values = [
                        trip.trip_number || '—',
                        trip.origin || '—',
                        trip.destination || '—',
                        trip.departure_date ? format(new Date(trip.departure_date), 'dd MMM yyyy') : '—',
                        trip.arrival_date ? format(new Date(trip.arrival_date), 'dd MMM yyyy') : '—',
                        trip.status || '—',
                        trip.vehicle_id || '—',
                    ];
                    styleBodyRow(ws, tripHeaderRow + 1 + i, i % 2 === 1);
                });
            }

            // Add per-driver Workdays-by-Location breakdown
            {
                const breakdown = buildLocationBreakdown(driver);
                const lastRow2 = ws.lastRow?.number || 0;
                const sectionRow = lastRow2 + 2;
                ws.getCell(`A${sectionRow}`).value = `Workdays by Location (Total: ${driver.daysAtWork})`;
                ws.getCell(`A${sectionRow}`).font = { bold: true, size: 11, name: 'Calibri' };
                const hdr = sectionRow + 1;
                ws.getRow(hdr).values = ['Location', 'Days'];
                styleHeaderRow(ws, hdr);
                if (breakdown.length === 0) {
                    const r = ws.getRow(hdr + 1);
                    r.values = ['—', 0];
                    styleBodyRow(ws, hdr + 1, false);
                } else {
                    breakdown.forEach((entry, i) => {
                        const r = ws.getRow(hdr + 1 + i);
                        r.values = [entry.location, entry.days];
                        styleBodyRow(ws, hdr + 1 + i, i % 2 === 1);
                    });
                }
            }
        }

        await saveWorkbook(wb, `Driver_Planning_Schedule_${format(selectedMonth, 'yyyy_MM')}.xlsx`);
    };

    // ─── Bulk Export: All Drivers PDF ────────────────────────────────────────

    const handleExportAllPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const brandColor: [number, number, number] = [31, 56, 100];
        const greenColor: [number, number, number] = [22, 163, 74];
        const blueColor: [number, number, number] = [37, 99, 235];
        const amberColor: [number, number, number] = [217, 119, 6];
        const redColor: [number, number, number] = [220, 38, 38];

        // ━━━ Page 1: Cover / Fleet Overview ━━━
        doc.setFillColor(...brandColor);
        doc.rect(0, 0, 297, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('Driver Planning Schedule', 14, 22);
        doc.setFontSize(12);
        doc.text(monthLabel, 14, 33);
        doc.setTextColor(0, 0, 0);

        // Fleet statistics
        const totalWorkDaysPdf = planningData.reduce((s, d) => s + d.daysAtWork, 0);
        const totalTripDaysPdf = planningData.reduce((s, d) => s + d.daysOnTrip, 0);
        const totalLeaveDaysPdf = planningData.reduce((s, d) => s + d.daysOnLeave, 0);
        const overworkedPdf = planningData.filter((d) => d.isOverworked);
        const driversWithTrips = planningData.filter((d) => d.trips.length > 0).length;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Fleet Overview', 14, 52);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const stats = [
            `Active Drivers: ${planningData.length}`,
            `Total Work Days: ${totalWorkDaysPdf}  |  Total Trip Days: ${totalTripDaysPdf}  |  Total Leave Days: ${totalLeaveDaysPdf}`,
            `Drivers With Trips: ${driversWithTrips}  |  Drivers Without Trips: ${planningData.length - driversWithTrips}`,
            `Overworked Alerts: ${overworkedPdf.length}${overworkedPdf.length > 0 ? ` (${overworkedPdf.map((d) => d.driverName).join(', ')})` : ''}`,
        ];
        stats.forEach((s, i) => doc.text(s, 14, 60 + i * 6));

        // Summary table with all driver stats
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Driver Summary', 14, 88);

        autoTable(doc, {
            startY: 92,
            head: [['Driver', 'Work', 'Trip', 'Leave', 'Off Day', 'Off', 'Streak', 'Status', 'Workdays by Location', 'Trips']],
            body: planningData.map((d) => {
                const breakdown = buildLocationBreakdown(d);
                const breakdownStr = breakdown.length > 0
                    ? breakdown.map((b) => `${b.location}: ${b.days}d`).join(', ')
                    : '—';
                return [
                    d.driverName,
                    String(d.daysAtWork),
                    String(d.daysOnTrip),
                    String(d.daysOnLeave),
                    String(d.daysOffDay),
                    String(d.daysOff),
                    `${d.maxConsecutiveWorkingDays}d`,
                    d.isOverworked ? 'OVERWORKED' : 'Normal',
                    breakdownStr,
                    d.trips.length > 0 ? d.trips.map((t) => t.trip_number || '—').join(', ') : 'None',
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: brandColor, fontSize: 7, halign: 'center' },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 32 },
                7: { halign: 'center' },
                8: { cellWidth: 70 },
                9: { cellWidth: 40 },
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 7) {
                    if (data.cell.raw === 'OVERWORKED') {
                        data.cell.styles.textColor = redColor;
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.textColor = greenColor;
                    }
                }
            },
        });

        // ━━━ Page: Workdays by Location (per driver + fleet totals) ━━━
        {
            const breakdownBody: string[][] = [];
            const fleetTotals: Record<string, number> = {};
            for (const driver of planningData) {
                const breakdown = buildLocationBreakdown(driver);
                if (breakdown.length === 0) {
                    breakdownBody.push([driver.driverName, '—', '0', String(driver.daysAtWork)]);
                    continue;
                }
                breakdown.forEach((entry, i) => {
                    breakdownBody.push([
                        i === 0 ? driver.driverName : '',
                        entry.location,
                        String(entry.days),
                        i === 0 ? String(driver.daysAtWork) : '',
                    ]);
                    fleetTotals[entry.location] = (fleetTotals[entry.location] || 0) + entry.days;
                });
            }

            doc.addPage();
            doc.setFillColor(...brandColor);
            doc.rect(0, 0, 297, 14, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text(`Workdays by Location – ${monthLabel}`, 14, 10);
            doc.setTextColor(0, 0, 0);

            autoTable(doc, {
                startY: 20,
                head: [['Driver', 'Location', 'Days', 'Driver Total']],
                body: breakdownBody,
                theme: 'grid',
                headStyles: { fillColor: brandColor, fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 45 },
                    1: { cellWidth: 60 },
                    2: { halign: 'center', cellWidth: 20 },
                    3: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
                },
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fleetY = (doc as any).lastAutoTable?.finalY || 80;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Fleet Totals by Location', 14, fleetY + 8);
            doc.setFont('helvetica', 'normal');

            const fleetSorted = Object.entries(fleetTotals).sort((a, b) => b[1] - a[1]);
            autoTable(doc, {
                startY: fleetY + 11,
                head: [['Location', 'Total Days']],
                body: [
                    ...fleetSorted.map(([loc, days]) => [loc, String(days)]),
                    ['TOTAL', String(totalWorkDaysPdf)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [5, 150, 105], fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 80, fontStyle: 'bold' },
                    1: { halign: 'center', cellWidth: 30 },
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.cell.raw === 'TOTAL') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [243, 244, 246];
                    }
                },
            });
        }

        // ━━━ Page 2: Trip Assignments ━━━
        const allTripsPdf: string[][] = [];
        for (const driver of planningData) {
            for (const trip of driver.trips) {
                allTripsPdf.push([
                    driver.driverName,
                    trip.trip_number || '—',
                    trip.origin || '—',
                    trip.destination || '—',
                    trip.departure_date ? format(new Date(trip.departure_date), 'dd MMM yyyy') : '—',
                    trip.arrival_date ? format(new Date(trip.arrival_date), 'dd MMM yyyy') : '—',
                    trip.status || '—',
                ]);
            }
        }

        if (allTripsPdf.length > 0) {
            doc.addPage();
            doc.setFillColor(...brandColor);
            doc.rect(0, 0, 297, 14, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text(`Trip Assignments – ${monthLabel}`, 14, 10);
            doc.setTextColor(0, 0, 0);

            autoTable(doc, {
                startY: 20,
                head: [['Driver', 'Load Ref / Trip #', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status']],
                body: allTripsPdf,
                theme: 'grid',
                headStyles: { fillColor: brandColor, fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 2.5 },
                columnStyles: { 0: { fontStyle: 'bold' } },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 6) {
                        const val = String(data.cell.raw || '').toLowerCase();
                        if (val === 'completed') data.cell.styles.textColor = greenColor;
                        else if (val.includes('progress')) data.cell.styles.textColor = blueColor;
                        else if (val === 'scheduled') data.cell.styles.textColor = amberColor;
                    }
                },
            });
        }

        // ━━━ Per-driver detail pages ━━━
        for (const driver of planningData) {
            doc.addPage();

            // Driver header bar
            doc.setFillColor(...brandColor);
            doc.rect(0, 0, 297, 14, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text(driver.driverName, 14, 10);
            doc.setFontSize(8);
            doc.text(`Work: ${driver.daysAtWork}  |  Trip: ${driver.daysOnTrip}  |  Leave: ${driver.daysOnLeave}  |  Off Day: ${driver.daysOffDay}  |  Off: ${driver.daysOff}  |  Streak: ${driver.maxConsecutiveWorkingDays}d`, 120, 10);
            doc.setTextColor(0, 0, 0);

            // Overwork warning
            let currentY = 18;
            if (driver.isOverworked) {
                doc.setTextColor(...redColor);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text(`⚠ OVERWORK ALERT: ${driver.maxConsecutiveWorkingDays} consecutive working days`, 14, currentY);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);
                currentY += 6;
            }

            // Workdays-by-Location summary box — rendered AFTER the daily schedule
            // table to avoid overlapping the table content on the right side.
            const driverBreakdown = buildLocationBreakdown(driver);

            // Daily schedule table
            autoTable(doc, {
                startY: currentY + 2, head: [['Date', 'Day', 'Status', 'Load Ref / Trip #', 'Location', 'Route']],
                body: daysInMonth.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const status = driver.dayStatuses[key] || 'off';
                    const tripRef = driver.tripDays[key] || '';
                    const location = driver.dayNotes[key] || '';
                    const matchingTrip = driver.trips.find((t) => {
                        if (!t.departure_date) return false;
                        const dep = t.departure_date;
                        const arr = t.arrival_date || t.departure_date;
                        return key >= dep && key <= arr;
                    });
                    const route = matchingTrip ? `${matchingTrip.origin || '?'} -> ${matchingTrip.destination || '?'}` : '';
                    return [
                        format(day, 'dd MMM'),
                        format(day, 'EEE'),
                        DAY_STATUS_LABELS[status],
                        tripRef,
                        location,
                        route,
                    ];
                }),
                theme: 'grid',
                headStyles: { fillColor: brandColor, fontSize: 7.5, halign: 'center' },
                styles: { fontSize: 7, cellPadding: 1.5 },
                columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 12 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 38 },
                    4: { cellWidth: 32 },
                    5: { cellWidth: 60 },
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 2) {
                        const val = String(data.cell.raw || '').toLowerCase().replace(/\s+/g, '_');
                        if (val === 'at_work') data.cell.styles.textColor = greenColor;
                        else if (val === 'on_trip') data.cell.styles.textColor = [5, 150, 105];
                        else if (val === 'on_leave') data.cell.styles.textColor = blueColor;
                        else if (val === 'off_day') data.cell.styles.textColor = [124, 58, 237];
                    }
                },
            });

            // Workdays-by-Location summary table (below the daily schedule)
            {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const afterScheduleY = (doc as any).lastAutoTable?.finalY || 160;
                autoTable(doc, {
                    startY: afterScheduleY + 6,
                    head: [[`Workdays by Location (Total: ${driver.daysAtWork})`, 'Days']],
                    body: driverBreakdown.length > 0
                        ? driverBreakdown.map((entry) => [entry.location, String(entry.days)])
                        : [['No work days recorded', '0']],
                    theme: 'grid',
                    headStyles: { fillColor: brandColor, fontSize: 8 },
                    styles: { fontSize: 7.5, cellPadding: 2 },
                    columnStyles: {
                        0: { cellWidth: 80, fontStyle: 'bold' },
                        1: { halign: 'center', cellWidth: 20 },
                    },
                    margin: { left: 14 },
                    tableWidth: 100,
                });
            }

            // Trip details section if driver has trips
            if (driver.trips.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const lastTableY = (doc as any).lastAutoTable?.finalY || 160;
                const tripStartY = lastTableY + 8;

                if (tripStartY < 175) {
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Trip Details', 14, tripStartY);
                    doc.setFont('helvetica', 'normal');

                    autoTable(doc, {
                        startY: tripStartY + 3,
                        head: [['Load Ref / Trip #', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status']],
                        body: driver.trips.map((trip) => [
                            trip.trip_number || '—',
                            trip.origin || '—',
                            trip.destination || '—',
                            trip.departure_date ? format(new Date(trip.departure_date), 'dd MMM yyyy') : '—',
                            trip.arrival_date ? format(new Date(trip.arrival_date), 'dd MMM yyyy') : '—',
                            trip.status || '—',
                        ]),
                        theme: 'grid',
                        headStyles: { fillColor: [5, 150, 105], fontSize: 7.5 },
                        styles: { fontSize: 7.5, cellPadding: 2 },
                    });
                }
            }

            // Leave entries if driver has leave
            if (driver.leaveEntries.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const lastY = (doc as any).lastAutoTable?.finalY || 160;
                const leaveStartY = lastY + 8;

                if (leaveStartY < 185) {
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Leave Entries', 14, leaveStartY);
                    doc.setFont('helvetica', 'normal');

                    autoTable(doc, {
                        startY: leaveStartY + 3,
                        head: [['Type', 'Start', 'End', 'Status', 'Notes']],
                        body: driver.leaveEntries.map((leave) => [
                            leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1),
                            format(new Date(leave.start_date), 'dd MMM yyyy'),
                            format(new Date(leave.end_date), 'dd MMM yyyy'),
                            leave.status.charAt(0).toUpperCase() + leave.status.slice(1),
                            leave.notes || '—',
                        ]),
                        theme: 'grid',
                        headStyles: { fillColor: [2, 132, 199], fontSize: 7.5 },
                        styles: { fontSize: 7.5, cellPadding: 2 },
                    });
                }
            }
        }

        // Footer with generation info on last page
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })} • Page ${i} of ${pageCount}`, 14, 200);
        }

        doc.save(`Driver_Planning_Schedule_${format(selectedMonth, 'yyyy_MM')}.pdf`);
    };

    const modalDriverData = planningData.find((d) => d.driverName === modalDriver) || null;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Controls */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardDescription className="text-sm text-slate-500">
                            Click on cells to mark attendance with location. Trips and leave are calculated automatically. Click a driver name for details & export.
                        </CardDescription>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={handleExportAllExcel} className="gap-1.5 text-xs">
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Export All
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportAllPDF} className="gap-1.5 text-xs">
                                <Download className="w-3.5 h-3.5" />
                                PDF All
                            </Button>
                            <Button size="sm" onClick={handleAddLeave} className="gap-1.5 text-xs">
                                <Plus className="w-3.5 h-3.5" />
                                Add Leave
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        {/* Month Navigation */}
                        <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-semibold min-w-[140px] text-center text-slate-700">
                                {monthLabel}
                            </span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            {overworkedCount > 0 && (
                                <Badge variant="destructive" className="gap-1 text-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    {overworkedCount} overworked
                                </Badge>
                            )}
                            {/* Legend - compact inline */}
                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-700 inline-block" /> Trip (Work)</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-200 border border-yellow-300 inline-block" /> Work · Mutare</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-200 border border-red-300 inline-block" /> Work · Other</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" /> Leave</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-300 inline-block" /> Off Day</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border inline-block" /> Off</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Overview Grid */}
            <OverviewGrid
                planningData={planningData}
                daysInMonth={daysInMonth}
                onSetDayStatus={setDayStatus}
                onClearDayStatus={clearDayStatus}
                onSelectDriver={setModalDriver}
            />

            {/* Driver Activity Modal */}
            <DriverActivityModal
                open={!!modalDriver}
                onOpenChange={(open) => { if (!open) setModalDriver(null); }}
                driverData={modalDriverData}
                selectedMonth={selectedMonth}
                onEditLeave={handleEditLeave}
                onDeleteLeave={setDeletingLeaveId}
            />

            {/* Add/Edit Leave Dialog */}
            <AddDriverLeaveDialog
                open={isLeaveDialogOpen}
                onOpenChange={setIsLeaveDialogOpen}
                drivers={activeDrivers}
                getDriverFullName={getDriverFullName}
                onSubmit={createLeave}
                onUpdate={updateLeave}
                isSubmitting={isCreatingLeave || isUpdatingLeave}
                editingLeave={editingLeave}
                preselectedDriver={modalDriver || undefined}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingLeaveId} onOpenChange={() => setDeletingLeaveId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Leave Entry</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this leave entry? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteLeave}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeletingLeave}
                        >
                            {isDeletingLeave && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Day Status Cell with Location Picker ────────────────────────────────────

interface DayCellProps {
    driverName: string;
    dateKey: string;
    currentStatus: DayStatus;
    tripName: string | undefined;
    dayNote: string | undefined;
    isFutureDay: boolean;
    onSetStatus: (data: { driverName: string; date: string; status?: DayStatus; notes?: string }) => Promise<unknown>;
    onClearStatus: (data: { driverName: string; date: string }) => Promise<unknown>;
}

function DayCell({ driverName, dateKey, currentStatus, tripName, dayNote, isFutureDay, onSetStatus, onClearStatus }: DayCellProps) {
    const [open, setOpen] = useState(false);

    const isAutomatic = currentStatus === 'leave';

    const handleSelectLocation = async (location: string) => {
        setOpen(false);
        await onSetStatus({ driverName, date: dateKey, notes: location });
    };

    const handleMarkOffDay = async () => {
        setOpen(false);
        await onSetStatus({ driverName, date: dateKey, status: 'off_day' });
    };

    const handleClear = async () => {
        setOpen(false);
        await onClearStatus({ driverName, date: dateKey });
    };

    // Color rules for at_work cells:
    //  - Auto-derived from a trip (tripName present)        → dark green
    //  - Manual at_work at Mutare                           → light yellow
    //  - Manual at_work at any other location (or no note)  → light red
    const atWorkColor =
        currentStatus === 'at_work'
            ? tripName
                ? 'bg-green-700'
                : dayNote === 'Mutare'
                    ? 'bg-yellow-200'
                    : 'bg-red-200'
            : null;

    const cellColor = atWorkColor ?? DAY_STATUS_COLORS[currentStatus];

    if (isAutomatic) {
        return (
            <div
                className={`w-5 h-5 rounded-[3px] mx-auto ${cellColor}`}
                title={DAY_STATUS_LABELS[currentStatus]}
            />
        );
    }

    if (isFutureDay && currentStatus === 'off' && !tripName) {
        return (
            <div className="w-5 h-5 rounded-[3px] mx-auto bg-slate-50 border border-dashed border-slate-200" title="Future date" />
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className="w-5 h-5 rounded-[3px] mx-auto relative focus:outline-none focus:ring-1 focus:ring-slate-400 focus:ring-offset-1 cursor-pointer transition-transform hover:scale-110"
                    type="button"
                >
                    <div className={`w-full h-full rounded-[3px] ${cellColor}`} />
                    {tripName && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500 border border-white" />
                    )}
                    {dayNote && !tripName && currentStatus === 'at_work' && (
                        <div className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-emerald-800" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="center" side="bottom" sideOffset={4}>
                <div className="flex flex-col gap-0.5 min-w-[160px]">
                    {tripName && (
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-green-700 border-b pb-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                            <span className="truncate">{tripName}</span>
                        </div>
                    )}
                    {currentStatus !== 'at_work' && (
                        <>
                            <p className="text-[10px] font-medium text-slate-400 px-2 pt-0.5 uppercase tracking-wider">Select location</p>
                            {AT_WORK_LOCATIONS.map((loc) => (
                                <button
                                    key={loc}
                                    type="button"
                                    className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-emerald-50 text-left transition-colors"
                                    onClick={() => handleSelectLocation(loc)}
                                >
                                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                    {loc}
                                </button>
                            ))}
                            <div className="border-t mt-1 pt-1">
                                <button
                                    type="button"
                                    className={`flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-purple-50 text-left transition-colors w-full ${currentStatus === 'off_day' ? 'bg-purple-50 font-medium' : ''}`}
                                    onClick={handleMarkOffDay}
                                >
                                    <span className="w-3 h-3 rounded-sm bg-purple-300 shrink-0 inline-block" />
                                    Off Day (unapplied)
                                </button>
                            </div>
                        </>
                    )}
                    {currentStatus === 'at_work' && !tripName && (
                        <>
                            {dayNote && (
                                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-emerald-700 border-b pb-1.5 mb-1">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    {dayNote}
                                </div>
                            )}
                            <p className="text-[10px] font-medium text-slate-400 px-2 pt-0.5 uppercase tracking-wider">Change location</p>
                            {AT_WORK_LOCATIONS.map((loc) => (
                                <button
                                    key={loc}
                                    type="button"
                                    className={`flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-emerald-50 text-left transition-colors ${dayNote === loc ? 'bg-emerald-50 font-medium' : ''}`}
                                    onClick={() => handleSelectLocation(loc)}
                                >
                                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                    {loc}
                                </button>
                            ))}
                            <div className="border-t mt-1 pt-1">
                                <button
                                    type="button"
                                    className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-purple-50 text-left transition-colors w-full"
                                    onClick={handleMarkOffDay}
                                >
                                    <span className="w-3 h-3 rounded-sm bg-purple-300 shrink-0 inline-block" />
                                    Off Day (unapplied)
                                </button>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-slate-50 text-left text-slate-400 w-full transition-colors"
                                    onClick={handleClear}
                                >
                                    <X className="w-3 h-3" />
                                    Clear
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ─── Overview Grid ───────────────────────────────────────────────────────────

interface OverviewGridProps {
    planningData: DriverPlanningData[];
    daysInMonth: Date[];
    onSetDayStatus: (data: { driverName: string; date: string; status?: DayStatus; notes?: string }) => Promise<unknown>;
    onClearDayStatus: (data: { driverName: string; date: string }) => Promise<unknown>;
    onSelectDriver: (name: string) => void;
}

function OverviewGrid({ planningData, daysInMonth, onSetDayStatus, onClearDayStatus, onSelectDriver }: OverviewGridProps) {
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow className="border-b-2 border-slate-200">
                                <TableHead className="sticky left-0 z-10 min-w-[170px] bg-slate-50 text-slate-600 font-semibold text-[11px] uppercase tracking-wider py-2">
                                    Driver
                                </TableHead>
                                {daysInMonth.map((day) => {
                                    const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                                    const today = isToday(day);
                                    return (
                                        <TableHead
                                            key={day.toISOString()}
                                            className={`text-center px-0 w-7 min-w-[28px] py-1.5 ${isWeekend ? 'bg-slate-100/80' : 'bg-slate-50'
                                                } ${today ? 'ring-1 ring-inset ring-slate-400' : ''}`}
                                        >
                                            <div className={`text-[10px] leading-tight font-medium ${today ? 'text-slate-900' : 'text-slate-500'}`}>
                                                {format(day, 'd')}
                                            </div>
                                            <div className={`text-[9px] leading-tight ${isWeekend ? 'text-slate-400 font-medium' : 'text-slate-400'}`}>
                                                {format(day, 'EEE').charAt(0)}
                                            </div>
                                        </TableHead>
                                    );
                                })}
                                <TableHead className="text-center min-w-[38px] bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider py-2">W</TableHead>
                                <TableHead className="text-center min-w-[38px] bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider py-2">T</TableHead>
                                <TableHead className="text-center min-w-[38px] bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider py-2">L</TableHead>
                                <TableHead className="text-center min-w-[38px] bg-slate-50 text-purple-600 font-semibold text-[10px] uppercase tracking-wider py-2">OD</TableHead>
                                <TableHead className="text-center min-w-[38px] bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider py-2">O</TableHead>
                                <TableHead className="text-center min-w-[48px] bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider py-2">Str</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {planningData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={daysInMonth.length + 7} className="text-center py-10 text-slate-400 text-sm">
                                        No active drivers found for this month
                                    </TableCell>
                                </TableRow>
                            ) : (
                                planningData.map((driver, idx) => (
                                    <TableRow
                                        key={driver.driverName}
                                        className={`border-b border-slate-100 transition-colors ${driver.isOverworked
                                            ? 'bg-red-50/60 hover:bg-red-50'
                                            : idx % 2 === 0
                                                ? 'bg-white hover:bg-slate-50/60'
                                                : 'bg-slate-50/30 hover:bg-slate-50/60'
                                            }`}
                                    >
                                        <TableCell
                                            className="sticky left-0 z-10 bg-inherit font-medium cursor-pointer hover:underline py-1.5"
                                            onClick={() => onSelectDriver(driver.driverName)}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate max-w-[130px] text-slate-700 text-[11px]">{driver.driverName}</span>
                                                {driver.isOverworked && (
                                                    <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                                                )}
                                            </div>
                                        </TableCell>
                                        {daysInMonth.map((day) => {
                                            const key = format(day, 'yyyy-MM-dd');
                                            const status = driver.dayStatuses[key] || 'off';
                                            const tripName = driver.tripDays[key];
                                            const dayNote = driver.dayNotes[key];
                                            const futureDay = isFuture(day);
                                            return (
                                                <TableCell key={key} className="p-0.5 text-center">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div>
                                                                    <DayCell
                                                                        driverName={driver.driverName}
                                                                        dateKey={key}
                                                                        currentStatus={status}
                                                                        tripName={tripName}
                                                                        dayNote={dayNote}
                                                                        isFutureDay={futureDay}
                                                                        onSetStatus={onSetDayStatus}
                                                                        onClearStatus={onClearDayStatus}
                                                                    />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-xs">
                                                                <p className="font-medium">{driver.driverName}</p>
                                                                <p className="text-slate-500">{format(day, 'EEE, MMM d')}</p>
                                                                <p>{futureDay && status === 'off' ? '—' : DAY_STATUS_LABELS[status]}</p>
                                                                {tripName && <p className="text-green-600">{tripName}</p>}
                                                                {dayNote && <p className="text-emerald-600">{dayNote}</p>}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell className="text-center font-semibold text-emerald-700 text-[11px] py-1.5">
                                            {driver.daysAtWork}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-green-600 text-[11px] py-1.5">
                                            {driver.daysOnTrip}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-sky-600 text-[11px] py-1.5">
                                            {driver.daysOnLeave}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-purple-500 text-[11px] py-1.5">
                                            {driver.daysOffDay}
                                        </TableCell>
                                        <TableCell className="text-center text-slate-400 text-[11px] py-1.5">
                                            {driver.daysOff}
                                        </TableCell>
                                        <TableCell className="text-center py-1.5">
                                            <Badge
                                                variant={driver.maxConsecutiveWorkingDays >= 26 ? 'destructive' : 'outline'}
                                                className="text-[10px] px-1.5 py-0 h-4 font-medium"
                                            >
                                                {driver.maxConsecutiveWorkingDays}d
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
