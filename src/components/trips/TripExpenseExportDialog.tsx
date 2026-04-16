import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, getISOWeek, parseISO, startOfWeek } from 'date-fns';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface JsPDFWithAutoTable extends jsPDF {
    lastAutoTable?: { finalY: number };
}

interface TripStub {
    id: string;
    trip_number: string;
    fleet_number?: string;
    driver_name?: string;
    client_name?: string;
    departure_date?: string;
    arrival_date?: string;
    route?: string;
}

interface CostEntry {
    id: string;
    trip_id: string | null;
    amount: number;
    category: string;
    sub_category: string | null;
    currency: string | null;
    date: string;
    notes: string | null;
    is_flagged: boolean | null;
    investigation_status: string | null;
    flag_reason: string | null;
    is_system_generated: boolean | null;
    reference_number: string | null;
}

type GroupByType = 'category' | 'fleet' | 'weekly' | 'monthly';
type ExportFormatType = 'excel' | 'pdf';

interface TripExpenseExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    trips: TripStub[];
}

const TripExpenseExportDialog = ({ isOpen, onClose, trips }: TripExpenseExportDialogProps) => {
    const { toast } = useToast();
    const [groupBy, setGroupBy] = useState<GroupByType>('category');
    const [exportFormat, setExportFormat] = useState<ExportFormatType>('excel');
    const [isExporting, setIsExporting] = useState(false);

    const tripIds = useMemo(() => trips.map(t => t.id), [trips]);

    // Build a trip lookup map
    const tripMap = useMemo(() => {
        const map = new Map<string, TripStub>();
        trips.forEach(t => map.set(t.id, t));
        return map;
    }, [trips]);

    // Fetch cost entries for the given trips
    const { data: costEntries = [], isLoading } = useQuery({
        queryKey: ['expense-export-costs', tripIds.join(',')],
        queryFn: async () => {
            if (tripIds.length === 0) return [];
            const allEntries: CostEntry[] = [];
            const BATCH_SIZE = 50;
            for (let i = 0; i < tripIds.length; i += BATCH_SIZE) {
                const batch = tripIds.slice(i, i + BATCH_SIZE);
                const { data, error } = await supabase
                    .from('cost_entries')
                    .select('id, trip_id, amount, category, sub_category, currency, date, notes, is_flagged, investigation_status, flag_reason, is_system_generated, reference_number')
                    .in('trip_id', batch);
                if (error) throw error;
                allEntries.push(...(data || []));
            }
            return allEntries;
        },
        enabled: isOpen && tripIds.length > 0,
    });

    const formatCurrency = (amount: number, currency = 'USD') =>
        new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

    // Group data according to the selected groupBy
    const groupedData = useMemo(() => {
        if (costEntries.length === 0) return [];

        type GroupedRow = {
            group: string;
            entries: (CostEntry & { tripInfo?: TripStub })[];
            totalAmount: number;
            flaggedCount: number;
        };

        const groups = new Map<string, (CostEntry & { tripInfo?: TripStub })[]>();

        const enriched = costEntries.map(ce => ({
            ...ce,
            tripInfo: ce.trip_id ? tripMap.get(ce.trip_id) : undefined,
        }));

        enriched.forEach(entry => {
            let key: string;

            switch (groupBy) {
                case 'category':
                    key = entry.category || 'Uncategorized';
                    break;
                case 'fleet':
                    key = entry.tripInfo?.fleet_number || 'Unknown Fleet';
                    break;
                case 'weekly': {
                    const d = parseISO(entry.date);
                    const monday = startOfWeek(d, { weekStartsOn: 1 });
                    const sunday = addDays(monday, 6);
                    const weekNum = getISOWeek(d);
                    key = `Week ${weekNum} (${format(monday, 'dd MMM')} - ${format(sunday, 'dd MMM yyyy')})`;
                    break;
                }
                case 'monthly': {
                    const d = parseISO(entry.date);
                    key = format(d, 'MMMM yyyy');
                    break;
                }
                default:
                    key = 'All';
            }

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(entry);
        });

        const result: GroupedRow[] = [];
        for (const [group, entries] of groups) {
            result.push({
                group,
                entries,
                totalAmount: entries.reduce((s, e) => s + (e.amount || 0), 0),
                flaggedCount: entries.filter(e => e.is_flagged && e.investigation_status !== 'resolved').length,
            });
        }

        // Sort groups
        result.sort((a, b) => {
            if (groupBy === 'weekly' || groupBy === 'monthly') {
                // Sort chronologically (first entry date)
                const aDate = a.entries[0]?.date || '';
                const bDate = b.entries[0]?.date || '';
                return aDate.localeCompare(bDate);
            }
            return a.group.localeCompare(b.group);
        });

        return result;
    }, [costEntries, groupBy, tripMap]);

    const totalExpenses = useMemo(() => costEntries.reduce((s, e) => s + (e.amount || 0), 0), [costEntries]);
    const totalFlagged = useMemo(() => costEntries.filter(e => e.is_flagged && e.investigation_status !== 'resolved').length, [costEntries]);

    const handleExport = async () => {
        if (costEntries.length === 0) {
            toast({ title: 'No expenses', description: 'No expense data to export.', variant: 'destructive' });
            return;
        }

        setIsExporting(true);
        try {
            if (exportFormat === 'excel') {
                exportToExcel();
            } else {
                exportToPDF();
            }
            toast({ title: 'Export successful', description: `Expenses exported to ${exportFormat === 'excel' ? 'Excel' : 'PDF'} successfully.` });
            onClose();
        } catch (error) {
            console.error('Export error:', error);
            toast({ title: 'Export failed', description: 'An error occurred while exporting.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const groupLabel = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);

        // Summary sheet
        const summaryRows: (string | number)[][] = [
            ['Trip Expense Report'],
            [''],
            ['Export Date', format(new Date(), 'dd MMM yyyy')],
            ['Grouped By', groupLabel],
            ['Total Trips', trips.length],
            ['Total Expenses', totalExpenses],
            ['Total Flagged', totalFlagged],
            [''],
            ['Group', 'Entries', 'Total Amount', 'Flagged'],
        ];

        groupedData.forEach(g => {
            summaryRows.push([g.group, g.entries.length, g.totalAmount, g.flaggedCount]);
        });

        const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
        summaryWs['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        // Detail sheet with all entries
        const detailData = costEntries.map(ce => {
            const trip = ce.trip_id ? tripMap.get(ce.trip_id) : undefined;
            return {
                'POD Number': trip?.trip_number || '',
                'Fleet': trip?.fleet_number || '',
                'Driver': trip?.driver_name || '',
                'Route': trip?.route || '',
                'Date': ce.date ? format(parseISO(ce.date), 'dd MMM yyyy') : '',
                'Category': ce.category || '',
                'Sub-Category': ce.sub_category || '',
                'Amount': ce.amount,
                'Currency': ce.currency || 'USD',
                'Flagged': ce.is_flagged ? 'Yes' : 'No',
                'Status': ce.investigation_status === 'resolved' ? 'Resolved' : ce.is_flagged ? 'Flagged' : 'OK',
                'Flag Reason': ce.flag_reason || '',
                'Reference': ce.reference_number || '',
                'Notes': ce.notes || '',
            };
        });

        const detailWs = XLSX.utils.json_to_sheet(detailData);
        detailWs['!cols'] = [
            { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 12 },
            { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
            { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 20 },
        ];
        XLSX.utils.book_append_sheet(wb, detailWs, 'All Expenses');

        // Per-group sheets
        groupedData.forEach(g => {
            const sheetName = g.group.substring(0, 31).replace(/[\\/*?[\]:]/g, '_');
            const rows = g.entries.map(ce => ({
                'POD Number': ce.tripInfo?.trip_number || '',
                'Fleet': ce.tripInfo?.fleet_number || '',
                'Driver': ce.tripInfo?.driver_name || '',
                'Date': ce.date ? format(parseISO(ce.date), 'dd MMM yyyy') : '',
                'Category': ce.category || '',
                'Sub-Category': ce.sub_category || '',
                'Amount': ce.amount,
                'Currency': ce.currency || 'USD',
                'Flagged': ce.is_flagged ? 'Yes' : 'No',
                'Status': ce.investigation_status === 'resolved' ? 'Resolved' : ce.is_flagged ? 'Flagged' : 'OK',
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [
                { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 12 },
                { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
            ];
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        const filename = `Trip_Expenses_by_${groupLabel}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    const exportToPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' }) as JsPDFWithAutoTable;
        const dateStr = format(new Date(), 'dd MMM yyyy');
        const groupLabel = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);

        // Title
        doc.setFontSize(16);
        doc.text('Trip Expense Report', 14, 18);
        doc.setFontSize(10);
        doc.text(`Grouped by: ${groupLabel} | Date: ${dateStr} | Trips: ${trips.length} | Total: ${formatCurrency(totalExpenses)}`, 14, 26);

        if (totalFlagged > 0) {
            doc.setTextColor(220, 38, 38);
            doc.text(`${totalFlagged} flagged expense${totalFlagged === 1 ? '' : 's'} require attention`, 14, 32);
            doc.setTextColor(0, 0, 0);
        }

        // Summary table
        const summaryHead = [['Group', 'Entries', 'Total Amount', 'Flagged']];
        const summaryBody = groupedData.map(g => [
            g.group,
            String(g.entries.length),
            formatCurrency(g.totalAmount),
            g.flaggedCount > 0 ? String(g.flaggedCount) : '-',
        ]);
        summaryBody.push(['TOTAL', String(costEntries.length), formatCurrency(totalExpenses), totalFlagged > 0 ? String(totalFlagged) : '-']);

        autoTable(doc, {
            startY: totalFlagged > 0 ? 36 : 30,
            head: summaryHead,
            body: summaryBody,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 80 },
                2: { halign: 'right' },
                3: { halign: 'center' },
            },
        });

        // Detail pages per group
        groupedData.forEach(g => {
            doc.addPage();
            doc.setFontSize(12);
            doc.text(g.group, 14, 16);
            doc.setFontSize(9);
            doc.text(`${g.entries.length} entries | Total: ${formatCurrency(g.totalAmount)}${g.flaggedCount > 0 ? ` | ${g.flaggedCount} flagged` : ''}`, 14, 22);

            const head = [['POD', 'Fleet', 'Driver', 'Date', 'Category', 'Sub-Category', 'Amount', 'Status']];
            const body = g.entries.map(ce => [
                ce.tripInfo?.trip_number || '',
                ce.tripInfo?.fleet_number || '',
                ce.tripInfo?.driver_name || '',
                ce.date ? format(parseISO(ce.date), 'dd MMM') : '',
                ce.category || '',
                ce.sub_category || '',
                formatCurrency(ce.amount, ce.currency || 'USD'),
                ce.investigation_status === 'resolved' ? 'Resolved' : ce.is_flagged ? 'FLAGGED' : 'OK',
            ]);

            autoTable(doc, {
                startY: 26,
                head,
                body,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
                bodyStyles: { fontSize: 7 },
                columnStyles: {
                    6: { halign: 'right' },
                    7: { halign: 'center' },
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 7 && data.cell.raw === 'FLAGGED') {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
            });
        });

        const filename = `Trip_Expenses_by_${groupLabel}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(filename);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-violet-600" />
                        Export Trip Expenses
                    </DialogTitle>
                    <DialogDescription>
                        Export expense data from {trips.length} trip{trips.length === 1 ? '' : 's'} grouped by category, fleet, week, or month.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Group By Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Group By</Label>
                        <RadioGroup
                            value={groupBy}
                            onValueChange={(v) => setGroupBy(v as GroupByType)}
                            className="grid grid-cols-2 gap-3"
                        >
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <RadioGroupItem value="category" id="exp-category" />
                                <Label htmlFor="exp-category" className="cursor-pointer text-sm flex-1">
                                    <div className="font-medium">By Category</div>
                                    <div className="text-xs text-gray-500">Border, Diesel, Parking, etc.</div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <RadioGroupItem value="fleet" id="exp-fleet" />
                                <Label htmlFor="exp-fleet" className="cursor-pointer text-sm flex-1">
                                    <div className="font-medium">By Fleet</div>
                                    <div className="text-xs text-gray-500">Grouped per vehicle</div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <RadioGroupItem value="weekly" id="exp-weekly" />
                                <Label htmlFor="exp-weekly" className="cursor-pointer text-sm flex-1">
                                    <div className="font-medium">Weekly</div>
                                    <div className="text-xs text-gray-500">Mon–Sun week buckets</div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <RadioGroupItem value="monthly" id="exp-monthly" />
                                <Label htmlFor="exp-monthly" className="cursor-pointer text-sm flex-1">
                                    <div className="font-medium">Monthly</div>
                                    <div className="text-xs text-gray-500">Calendar month breakdown</div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Export Format */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Export Format</Label>
                        <RadioGroup
                            value={exportFormat}
                            onValueChange={(v) => setExportFormat(v as ExportFormatType)}
                            className="grid grid-cols-2 gap-3"
                        >
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <RadioGroupItem value="excel" id="fmt-excel" />
                                <Label htmlFor="fmt-excel" className="cursor-pointer text-sm flex-1">
                                    <div className="font-medium flex items-center gap-1">
                                        <FileSpreadsheet className="h-3.5 w-3.5" />
                                        Excel
                                    </div>
                                    <div className="text-xs text-gray-500">Multi-sheet workbook</div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <RadioGroupItem value="pdf" id="fmt-pdf" />
                                <Label htmlFor="fmt-pdf" className="cursor-pointer text-sm flex-1">
                                    <div className="font-medium flex items-center gap-1">
                                        <FileText className="h-3.5 w-3.5" />
                                        PDF
                                    </div>
                                    <div className="text-xs text-gray-500">Printable report</div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Preview */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-2">Export Preview</div>
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading expense data...
                            </div>
                        ) : (
                            <div className="space-y-1 text-sm text-gray-600">
                                <p>
                                    <span className="font-medium">{costEntries.length}</span> expenses across{' '}
                                    <span className="font-medium">{trips.length}</span> trips
                                </p>
                                <p>
                                    Total: <span className="font-medium">{formatCurrency(totalExpenses)}</span>
                                </p>
                                <p>
                                    Groups: <span className="font-medium">{groupedData.length}</span> {groupBy === 'category' ? 'categories' : groupBy === 'fleet' ? 'fleets' : groupBy === 'weekly' ? 'weeks' : 'months'}
                                </p>
                                {totalFlagged > 0 && (
                                    <p className="text-destructive font-medium">
                                        {totalFlagged} flagged expense{totalFlagged === 1 ? '' : 's'}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isExporting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || isLoading || costEntries.length === 0}
                        className="gap-2 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700"
                    >
                        {isExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        {isExporting ? 'Exporting...' : `Export to ${exportFormat === 'excel' ? 'Excel' : 'PDF'}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TripExpenseExportDialog;
