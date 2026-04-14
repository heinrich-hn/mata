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
};

const DAY_STATUS_LABELS: Record<DayStatus, string> = {
    at_work: 'At Work',
    on_trip: 'On Trip',
    leave: 'On Leave',
    off: 'Off',
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

    // ─── Bulk Export: All Drivers Excel ──────────────────────────────────────

    const handleExportAllExcel = async () => {
        const wb = createWorkbook();

        // Summary sheet with totals per driver
        addSummarySheet(wb, 'Summary', {
            title: `All Drivers – Work Pattern`,
            subtitle: generatedSubtitle(monthLabel),
            rows: [
                ['Month', monthLabel],
                ['Total Active Drivers', planningData.length],
                ['', ''],
                ...planningData.map((d): [string, string | number] => [
                    d.driverName,
                    `Work: ${d.daysAtWork} | Trip: ${d.daysOnTrip} | Leave: ${d.daysOnLeave} | Off: ${d.daysOff} | Streak: ${d.maxConsecutiveWorkingDays}d`,
                ]),
            ],
        });

        // Daily status sheet — all drivers, all days
        const headers = ['Driver', ...daysInMonth.map((d) => format(d, 'dd')), 'Work', 'Trip', 'Leave', 'Off', 'Streak'];
        const rows = planningData.map((driver) => {
            const dayCells = daysInMonth.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const status = driver.dayStatuses[key] || 'off';
                const tripName = driver.tripDays[key];
                const note = driver.dayNotes[key];
                if (tripName) return `W (${tripName})`;
                if (status === 'at_work' && note) return `W (${note})`;
                if (status === 'at_work') return 'W';
                if (status === 'leave') return 'L';
                return '';
            });
            return [
                driver.driverName,
                ...dayCells,
                String(driver.daysAtWork),
                String(driver.daysOnTrip),
                String(driver.daysOnLeave),
                String(driver.daysOff),
                `${driver.maxConsecutiveWorkingDays}d`,
            ];
        });

        addStyledSheet(wb, 'Daily Status', {
            title: `All Drivers – Daily Status`,
            subtitle: generatedSubtitle(monthLabel),
            headers,
            rows,
        });

        // Per-driver detail sheets (one sheet per driver with daily breakdown)
        for (const driver of planningData) {
            const safeName = driver.driverName.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 28);
            addStyledSheet(wb, safeName, {
                title: `${driver.driverName} – Daily Status`,
                subtitle: generatedSubtitle(monthLabel),
                headers: ['Date', 'Day', 'Status', 'Trip', 'Location'],
                rows: daysInMonth.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const status = driver.dayStatuses[key] || 'off';
                    return [
                        format(day, 'yyyy-MM-dd'),
                        format(day, 'EEEE'),
                        DAY_STATUS_LABELS[status],
                        driver.tripDays[key] || '',
                        driver.dayNotes[key] || '',
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
        }

        await saveWorkbook(wb, `All_Drivers_Work_Pattern_${format(selectedMonth, 'yyyy_MM')}.xlsx`);
    };

    // ─── Bulk Export: All Drivers PDF ────────────────────────────────────────

    const handleExportAllPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });

        doc.setFontSize(16);
        doc.text(`All Drivers – Work Pattern`, 14, 20);
        doc.setFontSize(10);
        doc.text(monthLabel, 14, 28);

        // Summary table
        autoTable(doc, {
            startY: 34,
            head: [['Driver', 'Work', 'Trip', 'Leave', 'Off', 'Streak']],
            body: planningData.map((d) => [
                d.driverName,
                String(d.daysAtWork),
                String(d.daysOnTrip),
                String(d.daysOnLeave),
                String(d.daysOff),
                `${d.maxConsecutiveWorkingDays}d`,
            ]),
            theme: 'grid',
            headStyles: { fillColor: [31, 56, 100] },
            styles: { fontSize: 8 },
        });

        // Daily grid per driver on subsequent pages
        for (const driver of planningData) {
            doc.addPage();
            doc.setFontSize(14);
            doc.text(driver.driverName, 14, 16);
            doc.setFontSize(9);
            doc.text(`Work: ${driver.daysAtWork}  |  Trip: ${driver.daysOnTrip}  |  Leave: ${driver.daysOnLeave}  |  Off: ${driver.daysOff}`, 14, 23);

            autoTable(doc, {
                startY: 28,
                head: [['Date', 'Day', 'Status', 'Trip', 'Location']],
                body: daysInMonth.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const status = driver.dayStatuses[key] || 'off';
                    return [
                        format(day, 'dd MMM'),
                        format(day, 'EEE'),
                        DAY_STATUS_LABELS[status],
                        driver.tripDays[key] || '',
                        driver.dayNotes[key] || '',
                    ];
                }),
                theme: 'grid',
                headStyles: { fillColor: [31, 56, 100] },
                styles: { fontSize: 7 },
            });
        }

        doc.save(`All_Drivers_Work_Pattern_${format(selectedMonth, 'yyyy_MM')}.pdf`);
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
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Work</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" /> Leave</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border inline-block" /> Off</span>
                                <span className="flex items-center gap-1 pl-1.5 border-l border-slate-300"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Trip</span>
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
    onSetStatus: (data: { driverName: string; date: string; notes?: string }) => Promise<unknown>;
    onClearStatus: (data: { driverName: string; date: string }) => Promise<unknown>;
}

function DayCell({ driverName, dateKey, currentStatus, tripName, dayNote, isFutureDay, onSetStatus, onClearStatus }: DayCellProps) {
    const [open, setOpen] = useState(false);

    const isAutomatic = currentStatus === 'leave';

    const handleSelectLocation = async (location: string) => {
        setOpen(false);
        await onSetStatus({ driverName, date: dateKey, notes: location });
    };

    const handleClear = async () => {
        setOpen(false);
        await onClearStatus({ driverName, date: dateKey });
    };

    if (isAutomatic) {
        return (
            <div
                className={`w-5 h-5 rounded-[3px] mx-auto ${DAY_STATUS_COLORS[currentStatus]}`}
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
                    <div className={`w-full h-full rounded-[3px] ${DAY_STATUS_COLORS[currentStatus]}`} />
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
    onSetDayStatus: (data: { driverName: string; date: string; notes?: string }) => Promise<unknown>;
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
                                <TableHead className="text-center min-w-[38px] bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider py-2">O</TableHead>
                                <TableHead className="text-center min-w-[48px] bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider py-2">Str</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {planningData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={daysInMonth.length + 6} className="text-center py-10 text-slate-400 text-sm">
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
                                        <TableCell className="text-center text-slate-400 text-[11px] py-1.5">
                                            {driver.daysOff}
                                        </TableCell>
                                        <TableCell className="text-center py-1.5">
                                            <Badge
                                                variant={driver.maxConsecutiveWorkingDays >= 14 ? 'destructive' : 'outline'}
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
