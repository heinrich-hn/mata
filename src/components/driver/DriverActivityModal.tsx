import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { DayStatus, DriverPlanningData, DriverLeave } from '@/hooks/useDriverPlanning';
import {
    createWorkbook,
    saveWorkbook,
    addStyledSheet,
    addSummarySheet,
    generatedSubtitle,
    statusColours,
} from '@/utils/excelStyles';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isToday } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    AlertTriangle,
    CalendarDays,
    Download,
    FileSpreadsheet,
    MapPin,
    Truck,
} from 'lucide-react';
import { useMemo } from 'react';

const DAY_STATUS_COLORS: Record<DayStatus, string> = {
    at_work: 'bg-amber-400',
    on_trip: 'bg-green-500',
    leave: 'bg-blue-500',
    off: 'bg-gray-200',
};

const DAY_STATUS_LABELS: Record<DayStatus, string> = {
    at_work: 'At Work',
    on_trip: 'On Trip',
    leave: 'On Leave',
    off: 'Off',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
    annual: 'Annual Leave',
    sick: 'Sick Leave',
    family: 'Family Responsibility',
    unpaid: 'Unpaid Leave',
    other: 'Other',
};

interface DriverActivityModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    driverData: DriverPlanningData | null;
    selectedMonth: Date;
    onEditLeave: (leave: DriverLeave) => void;
    onDeleteLeave: (id: string) => void;
}

export default function DriverActivityModal({
    open,
    onOpenChange,
    driverData,
    selectedMonth,
    onEditLeave,
    onDeleteLeave,
}: DriverActivityModalProps) {
    const daysInMonth = useMemo(
        () => eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) }),
        [selectedMonth],
    );

    if (!driverData) return null;

    const monthLabel = format(selectedMonth, 'MMMM yyyy');

    // ─── Export to Excel ─────────────────────────────────────────────────────

    const handleExportExcel = async () => {
        const wb = createWorkbook();

        // Summary sheet
        addSummarySheet(wb, 'Summary', {
            title: `${driverData.driverName} – Work Pattern`,
            subtitle: generatedSubtitle(monthLabel),
            rows: [
                ['Driver', driverData.driverName],
                ['Month', monthLabel],
                ['Days At Work', driverData.daysAtWork],
                ['Trip Days (incl. in Work)', driverData.daysOnTrip],
                ['Days On Leave', driverData.daysOnLeave],
                ['Days Off', driverData.daysOff],
                ['Max Consecutive Working Days', driverData.maxConsecutiveWorkingDays],
                ['Overworked?', driverData.isOverworked ? 'YES' : 'No'],
            ],
        });

        // Daily status sheet
        addStyledSheet(wb, 'Daily Status', {
            title: `${driverData.driverName} – Daily Status`,
            subtitle: generatedSubtitle(monthLabel),
            headers: ['Date', 'Day', 'Status', 'Trip', 'Location'],
            rows: daysInMonth.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const status = driverData.dayStatuses[key] || 'off';
                return [
                    format(day, 'yyyy-MM-dd'),
                    format(day, 'EEEE'),
                    DAY_STATUS_LABELS[status],
                    driverData.tripDays[key] || '',
                    driverData.dayNotes[key] || '',
                ];
            }),
            cellStyler: (rowData, colIndex) => {
                if (colIndex === 3) {
                    const status = String(rowData[2] || '').toLowerCase().replace(/\s+/g, '_');
                    return statusColours[status];
                }
                return undefined;
            },
        });

        // Trips sheet
        if (driverData.trips.length > 0) {
            addStyledSheet(wb, 'Trips', {
                title: `${driverData.driverName} – Trips`,
                subtitle: generatedSubtitle(monthLabel),
                headers: ['Trip Number', 'Vehicle ID', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status'],
                rows: driverData.trips.map((trip) => [
                    trip.trip_number || '—',
                    trip.vehicle_id || '—',
                    trip.origin || '—',
                    trip.destination || '—',
                    trip.departure_date ? format(new Date(trip.departure_date + 'T00:00'), 'dd MMM yyyy') : '—',
                    trip.arrival_date ? format(new Date(trip.arrival_date + 'T00:00'), 'dd MMM yyyy') : '—',
                    trip.status || '—',
                ]),
            });
        }

        // Leave sheet
        if (driverData.leaveEntries.length > 0) {
            addStyledSheet(wb, 'Leave', {
                title: `${driverData.driverName} – Leave Entries`,
                subtitle: generatedSubtitle(monthLabel),
                headers: ['Leave Type', 'Start Date', 'End Date', 'Status', 'Notes'],
                rows: driverData.leaveEntries.map((leave) => [
                    LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type,
                    format(new Date(leave.start_date + 'T00:00'), 'dd MMM yyyy'),
                    format(new Date(leave.end_date + 'T00:00'), 'dd MMM yyyy'),
                    leave.status,
                    leave.notes || '',
                ]),
            });
        }

        const safeName = driverData.driverName.replace(/[^a-zA-Z0-9]/g, '_');
        await saveWorkbook(wb, `${safeName}_Work_Pattern_${format(selectedMonth, 'yyyy_MM')}.xlsx`);
    };

    // ─── Export to PDF ───────────────────────────────────────────────────────

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });

        doc.setFontSize(16);
        doc.text(`${driverData.driverName} – Work Pattern`, 14, 20);
        doc.setFontSize(10);
        doc.text(monthLabel, 14, 28);

        // Summary table
        autoTable(doc, {
            startY: 34,
            head: [['Metric', 'Value']],
            body: [
                ['Days At Work', String(driverData.daysAtWork)],
                ['Trip Days (incl. in Work)', String(driverData.daysOnTrip)],
                ['Days On Leave', String(driverData.daysOnLeave)],
                ['Days Off', String(driverData.daysOff)],
                ['Max Consecutive Working Days', String(driverData.maxConsecutiveWorkingDays)],
                ['Overworked?', driverData.isOverworked ? 'YES' : 'No'],
            ],
            theme: 'grid',
            headStyles: { fillColor: [31, 56, 100] },
            styles: { fontSize: 9 },
        });

        // Daily status table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryEnd = (doc as any).lastAutoTable?.finalY || 80;

        autoTable(doc, {
            startY: summaryEnd + 10,
            head: [['Date', 'Day', 'Status', 'Trip', 'Location']],
            body: daysInMonth.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const status = driverData.dayStatuses[key] || 'off';
                return [
                    format(day, 'yyyy-MM-dd'),
                    format(day, 'EEE'),
                    DAY_STATUS_LABELS[status],
                    driverData.tripDays[key] || '',
                    driverData.dayNotes[key] || '',
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: [31, 56, 100] },
            styles: { fontSize: 8 },
        });

        // Trips table on new page
        if (driverData.trips.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text('Trips', 14, 20);

            autoTable(doc, {
                startY: 26,
                head: [['Trip #', 'Vehicle ID', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status']],
                body: driverData.trips.map((trip) => [
                    trip.trip_number || '—',
                    trip.vehicle_id || '—',
                    trip.origin || '—',
                    trip.destination || '—',
                    trip.departure_date ? format(new Date(trip.departure_date + 'T00:00'), 'dd MMM') : '—',
                    trip.arrival_date ? format(new Date(trip.arrival_date + 'T00:00'), 'dd MMM') : '—',
                    trip.status || '—',
                ]),
                theme: 'grid',
                headStyles: { fillColor: [31, 56, 100] },
                styles: { fontSize: 8 },
            });
        }

        // Leave table
        if (driverData.leaveEntries.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text('Leave Entries', 14, 20);

            autoTable(doc, {
                startY: 26,
                head: [['Type', 'Start', 'End', 'Status', 'Notes']],
                body: driverData.leaveEntries.map((leave) => [
                    LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type,
                    format(new Date(leave.start_date + 'T00:00'), 'dd MMM yyyy'),
                    format(new Date(leave.end_date + 'T00:00'), 'dd MMM yyyy'),
                    leave.status,
                    leave.notes || '',
                ]),
                theme: 'grid',
                headStyles: { fillColor: [31, 56, 100] },
                styles: { fontSize: 8 },
            });
        }

        const safeName = driverData.driverName.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`${safeName}_Work_Pattern_${format(selectedMonth, 'yyyy_MM')}.pdf`);
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">
                            {driverData.driverName} — {monthLabel}
                        </DialogTitle>
                        <div className="flex items-center gap-2 mr-8">
                            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
                                <FileSpreadsheet className="w-4 h-4" />
                                Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
                                <Download className="w-4 h-4" />
                                PDF
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 mt-2">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <span className="text-sm text-amber-700">At Work</span>
                            <span className="text-lg font-bold text-amber-700">{driverData.daysAtWork}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                            <div>
                                <span className="text-sm text-green-700">Trip Days</span>
                                <span className="text-[10px] text-green-600 block">(incl. in Work)</span>
                            </div>
                            <span className="text-lg font-bold text-green-700">{driverData.daysOnTrip}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <span className="text-sm text-blue-700">On Leave</span>
                            <span className="text-lg font-bold text-blue-700">{driverData.daysOnLeave}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <span className="text-sm text-gray-600">Off</span>
                            <span className="text-lg font-bold text-gray-600">{driverData.daysOff}</span>
                        </div>
                    </div>

                    {driverData.isOverworked && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                                This driver may be overworked ({driverData.maxConsecutiveWorkingDays} consecutive working days).
                                Consider scheduling leave.
                            </span>
                        </div>
                    )}

                    {/* Work Pattern Grid */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2">Work Pattern</h3>
                        <div className="border rounded-lg p-3">
                            <div className="grid grid-cols-7 gap-1">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                                        {d}
                                    </div>
                                ))}
                                {/* Pad first week */}
                                {(() => {
                                    const firstDay = getDay(startOfMonth(selectedMonth));
                                    const offset = firstDay === 0 ? 6 : firstDay - 1;
                                    return Array.from({ length: offset }).map((_, i) => (
                                        <div key={`pad-${i}`} />
                                    ));
                                })()}
                                {daysInMonth.map((day) => {
                                    const key = format(day, 'yyyy-MM-dd');
                                    const status = driverData.dayStatuses[key] || 'off';
                                    const tripName = driverData.tripDays[key];
                                    const dayNote = driverData.dayNotes[key];
                                    return (
                                        <div key={key} className="flex flex-col items-center gap-0.5"
                                            title={`${format(day, 'EEE, MMM d')} — ${DAY_STATUS_LABELS[status]}${tripName ? ` | Trip: ${tripName}` : ''}${dayNote ? ` | ${dayNote}` : ''}`}
                                        >
                                            <span className={`text-[10px] ${isToday(day) ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                                                {format(day, 'd')}
                                            </span>
                                            <div className={`w-6 h-6 rounded-sm relative ${DAY_STATUS_COLORS[status]}`}>
                                                {tripName && (
                                                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500 border border-white" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                                    At Work
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                                    Leave
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 rounded-sm bg-gray-200 border" />
                                    Off
                                </div>
                                <div className="flex items-center gap-1 ml-1 pl-1 border-l">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    Trip day
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trips Table */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Trips ({driverData.trips.length})
                        </h3>
                        {driverData.trips.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                                No trips this month
                            </p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Trip #</TableHead>
                                            <TableHead>Vehicle ID</TableHead>
                                            <TableHead>Route</TableHead>
                                            <TableHead>Departure</TableHead>
                                            <TableHead>Arrival</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {driverData.trips.map((trip, i) => (
                                            <TableRow key={`${trip.trip_number}-${i}`}>
                                                <TableCell className="font-medium">
                                                    {trip.trip_number || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {trip.vehicle_id || '—'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="flex items-center gap-1 text-sm">
                                                    <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                                                    {trip.origin || '—'} → {trip.destination || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {trip.departure_date
                                                        ? format(new Date(trip.departure_date + 'T00:00'), 'dd MMM')
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {trip.arrival_date
                                                        ? format(new Date(trip.arrival_date + 'T00:00'), 'dd MMM')
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {trip.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>

                    {/* Leave Entries */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" />
                            Leave Entries ({driverData.leaveEntries.length})
                        </h3>
                        {driverData.leaveEntries.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                                No leave entries this month
                            </p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Type</TableHead>
                                            <TableHead>Period</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Notes</TableHead>
                                            <TableHead className="w-[80px]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {driverData.leaveEntries.map((leave) => (
                                            <TableRow key={leave.id}>
                                                <TableCell className="font-medium">
                                                    {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                                                </TableCell>
                                                <TableCell>
                                                    {format(new Date(leave.start_date + 'T00:00'), 'dd MMM')} →{' '}
                                                    {format(new Date(leave.end_date + 'T00:00'), 'dd MMM')}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={leave.status === 'approved' ? 'default' : 'secondary'}
                                                        className="text-xs"
                                                    >
                                                        {leave.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                    {leave.notes || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => onEditLeave(leave)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs text-destructive"
                                                            onClick={() => onDeleteLeave(leave.id)}
                                                        >
                                                            Del
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
