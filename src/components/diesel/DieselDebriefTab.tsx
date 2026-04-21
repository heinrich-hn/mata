import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    generateFleetDebriefSummaryPDF,
    generateSelectedTransactionsPDF,
    generateDebriefExcel,
    generateDebriefPDF,
    generateWeeklyDebriefsPDF,
    type DebriefExcelRecord,
} from '@/lib/dieselDebriefExport';
import { formatDate, formatNumber } from '@/lib/formatters';
import type { DieselConsumptionRecord, DieselNorms } from '@/types/operations';
import { AlertCircle, Calendar, CheckCircle, ChevronDown, Download, FileSpreadsheet, FileText, Filter, MessageCircle, Truck } from 'lucide-react';
import { useState, useMemo } from 'react';

interface DieselDebriefTabProps {
    truckRecords: DieselConsumptionRecord[];
    dieselRecords: DieselConsumptionRecord[];
    dieselNorms: DieselNorms[];
    uniqueFleetNumbers: string[];
    recordsRequiringDebrief: DieselConsumptionRecord[];
    whatsappSharedSet: Set<string>;
    calculateKmPerLitre: (record: DieselConsumptionRecord) => number | null;
    getNormForFleet: (fleetNumber: string) => DieselNorms | undefined;
    onOpenDebrief: (record: DieselConsumptionRecord) => void;
    onOpenBatchDebrief: (fleet: string) => void;
}

const DieselDebriefTab = ({
    truckRecords,
    dieselRecords,
    dieselNorms,
    uniqueFleetNumbers,
    recordsRequiringDebrief,
    whatsappSharedSet,
    calculateKmPerLitre,
    getNormForFleet,
    onOpenDebrief,
    onOpenBatchDebrief,
}: DieselDebriefTabProps) => {
    // Debrief-only state
    const [debriefFleetFilter, setDebriefFleetFilter] = useState<string>('');
    const [expandedPendingFleets, setExpandedPendingFleets] = useState<Set<string>>(new Set());

    // Export helpers
    const buildDebriefRecords = (type: 'pending' | 'completed' | 'all'): DebriefExcelRecord[] => {
        let recordsToExport: DieselConsumptionRecord[] = [];

        if (type === 'pending') {
            recordsToExport = recordsRequiringDebrief;
        } else if (type === 'completed') {
            recordsToExport = truckRecords.filter(r => r.debrief_signed);
        } else {
            recordsToExport = [...recordsRequiringDebrief, ...truckRecords.filter(r => r.debrief_signed)];
        }

        return recordsToExport.map(record => {
            const kmPerLitre = record.distance_travelled && record.litres_filled
                ? record.distance_travelled / record.litres_filled
                : undefined;
            const norm = getNormForFleet(record.fleet_number);
            const variance = kmPerLitre && norm
                ? ((kmPerLitre - norm.expected_km_per_litre) / norm.expected_km_per_litre * 100)
                : undefined;

            let debriefStatus: 'Pending' | 'Completed' | 'Within Norm' = 'Pending';
            if (record.debrief_signed) {
                debriefStatus = 'Completed';
            } else if (!norm || (kmPerLitre != null && kmPerLitre >= (norm?.min_acceptable ?? 0))) {
                debriefStatus = 'Within Norm';
            }

            return {
                date: record.date,
                fleet_number: record.fleet_number,
                driver_name: record.driver_name,
                fuel_station: record.fuel_station,
                litres_filled: record.litres_filled,
                total_cost: record.total_cost,
                currency: record.currency,
                distance_travelled: record.distance_travelled,
                km_per_litre: kmPerLitre,
                expected_km_per_litre: norm?.expected_km_per_litre,
                min_acceptable: norm?.min_acceptable,
                variance_pct: variance,
                debrief_status: debriefStatus,
                debrief_signed_by: record.debrief_signed_by,
                debrief_date: record.debrief_date,
                debrief_trigger_reason: record.debrief_trigger_reason,
                notes: record.notes,
            } satisfies DebriefExcelRecord;
        });
    };

    const exportDebriefTransactions = async (type: 'pending' | 'completed' | 'all') => {
        const records = buildDebriefRecords(type);
        await generateDebriefExcel(records, type);
    };

    const exportDebriefTransactionsPDF = (type: 'pending' | 'completed' | 'all') => {
        const records = buildDebriefRecords(type);
        generateDebriefPDF(records, type);
    };

    const handleExportFleetDebriefSummary = (fleetNumber: string, showPendingOnly: boolean = false) => {
        const fleetRecords = truckRecords.filter(r => r.fleet_number === fleetNumber);
        const recordsWithDebriefStatus = fleetRecords.map(record => {
            const kmPerLitre = calculateKmPerLitre(record);
            const norm = getNormForFleet(record.fleet_number);
            const requiresDebrief = kmPerLitre !== null && norm && kmPerLitre < norm.min_acceptable;

            return {
                id: record.id,
                fleet_number: record.fleet_number,
                date: record.date,
                driver_name: record.driver_name,
                fuel_station: record.fuel_station,
                litres_filled: record.litres_filled,
                total_cost: record.total_cost,
                currency: record.currency,
                km_per_litre: kmPerLitre ?? undefined,
                debrief_signed: record.debrief_signed,
                debrief_signed_by: record.debrief_signed_by,
                debrief_signed_at: record.debrief_signed_at,
                debrief_notes: record.debrief_notes,
                requires_debrief: requiresDebrief,
                debrief_trigger_reason: record.debrief_trigger_reason,
            };
        });

        generateFleetDebriefSummaryPDF({
            fleetNumber,
            records: recordsWithDebriefStatus,
            showPendingOnly,
        });
    };

    const handleExportAllDebriefsPDF = () => {
        const recordsWithDebriefStatus = truckRecords.map(record => {
            const kmPerLitre = calculateKmPerLitre(record);
            const norm = getNormForFleet(record.fleet_number);
            const requiresDebrief = kmPerLitre !== null && norm && kmPerLitre < norm.min_acceptable;

            return {
                id: record.id,
                fleet_number: record.fleet_number,
                date: record.date,
                driver_name: record.driver_name,
                fuel_station: record.fuel_station,
                litres_filled: record.litres_filled,
                total_cost: record.total_cost,
                currency: record.currency,
                km_per_litre: kmPerLitre ?? undefined,
                debrief_signed: record.debrief_signed,
                debrief_signed_by: record.debrief_signed_by,
                debrief_signed_at: record.debrief_signed_at,
                debrief_notes: record.debrief_notes,
                requires_debrief: requiresDebrief,
                debrief_trigger_reason: record.debrief_trigger_reason,
            };
        });

        const debriefRecords = recordsWithDebriefStatus.filter(r => r.requires_debrief || r.debrief_signed);
        generateSelectedTransactionsPDF(debriefRecords, 'ALL FLEETS DEBRIEF SUMMARY');
    };

    // Group pending records by fleet
    const pendingByFleet = useMemo(() => {
        const fleetMap: Record<string, DieselConsumptionRecord[]> = {};
        for (const r of recordsRequiringDebrief) {
            const fleet = r.fleet_number || 'Unknown';
            if (!fleetMap[fleet]) fleetMap[fleet] = [];
            fleetMap[fleet].push(r);
        }
        return Object.entries(fleetMap).sort(([a], [b]) => a.localeCompare(b));
    }, [recordsRequiringDebrief]);

    return (
        <div className="space-y-6">
            {/* Fleet Debrief Summary Export Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Fleet Debrief Summary</CardTitle>
                            <CardDescription>
                                Export PDF summary of debrief status per fleet or across all fleets
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <select
                                    title="Filter by fleet number"
                                    value={debriefFleetFilter}
                                    onChange={(e) => setDebriefFleetFilter(e.target.value)}
                                    className="px-3 py-1.5 border rounded-md bg-background text-sm min-w-[150px]"
                                >
                                    <option value="">Select Fleet...</option>
                                    {uniqueFleetNumbers.map((fleet) => (
                                        <option key={fleet} value={fleet}>{fleet}</option>
                                    ))}
                                </select>
                            </div>
                            {debriefFleetFilter && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExportFleetDebriefSummary(debriefFleetFilter, false)}
                                        className="gap-2"
                                    >
                                        <FileText className="h-4 w-4" />
                                        Full Summary PDF
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExportFleetDebriefSummary(debriefFleetFilter, true)}
                                        className="gap-2"
                                    >
                                        <AlertCircle className="h-4 w-4" />
                                        Pending Only PDF
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => generateWeeklyDebriefsPDF({
                                            records: dieselRecords,
                                            norms: dieselNorms,
                                            fleetNumber: debriefFleetFilter,
                                        })}
                                        className="gap-2"
                                    >
                                        <Calendar className="h-4 w-4" />
                                        Weekly Debriefs PDF
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleExportAllDebriefsPDF}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                All Fleets PDF
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => generateWeeklyDebriefsPDF({
                                    records: dieselRecords,
                                    norms: dieselNorms,
                                })}
                                className="gap-2"
                            >
                                <Calendar className="h-4 w-4" />
                                All Fleets Weekly PDF
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Pending Debriefs */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <CardTitle>Pending Debriefs</CardTitle>
                            <CardDescription>
                                Grouped by fleet — records with fuel efficiency outside acceptable norms
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {recordsRequiringDebrief.length > 0 && (
                                <>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Download className="h-4 w-4" />
                                                Export Pending
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => exportDebriefTransactions('pending')}>
                                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                                Excel (.xlsx)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => exportDebriefTransactionsPDF('pending')}>
                                                <FileText className="h-4 w-4 mr-2" />
                                                PDF
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <Download className="h-4 w-4" />
                                                Export All
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => exportDebriefTransactions('all')}>
                                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                                Excel (.xlsx)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => exportDebriefTransactionsPDF('all')}>
                                                <FileText className="h-4 w-4 mr-2" />
                                                PDF
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                            const fleets = [...new Set(recordsRequiringDebrief.map(r => r.fleet_number))];
                                            if (fleets.length === 1) {
                                                onOpenBatchDebrief(fleets[0]);
                                            } else {
                                                onOpenBatchDebrief('');
                                            }
                                        }}
                                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <CheckCircle className="h-4 w-4" />
                                        Batch Debrief All
                                    </Button>
                                </>
                            )}
                            {recordsRequiringDebrief.length === 0 && truckRecords.filter(r => r.debrief_signed).length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Download className="h-4 w-4" />
                                            Export All
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => exportDebriefTransactions('all')}>
                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            Excel (.xlsx)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportDebriefTransactionsPDF('all')}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            PDF
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {recordsRequiringDebrief.length > 0 ? (
                        <div className="space-y-2">
                            {pendingByFleet.map(([fleet, records]) => {
                                const isOpen = expandedPendingFleets.has(fleet);
                                const sentCount = records.filter(r => whatsappSharedSet.has(r.id)).length;
                                const allSent = sentCount === records.length;
                                const someSent = sentCount > 0 && !allSent;
                                return (
                                    <div key={fleet} className="border rounded-lg overflow-hidden">
                                        <div className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors">
                                            <button
                                                type="button"
                                                className="flex-1 flex items-center justify-between gap-2 text-left min-w-0"
                                                onClick={() =>
                                                    setExpandedPendingFleets(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(fleet)) {
                                                            next.delete(fleet);
                                                        } else {
                                                            next.add(fleet);
                                                        }
                                                        return next;
                                                    })
                                                }
                                            >
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="font-semibold text-sm">{fleet}</span>
                                                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                                        {records.length} pending
                                                    </Badge>
                                                    {allSent && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                                            <CheckCircle className="h-3 w-3" />
                                                            All WA Sent
                                                        </span>
                                                    )}
                                                    {someSent && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
                                                            {sentCount}/{records.length} WA Sent
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="ml-2 h-7 px-2 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                onClick={() => onOpenBatchDebrief(fleet)}
                                            >
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Batch
                                            </Button>
                                        </div>

                                        {isOpen && (
                                            <div className="border-t divide-y">
                                                {records.map(record => {
                                                    const kmPerLitre = calculateKmPerLitre(record);
                                                    const norm = getNormForFleet(record.fleet_number);
                                                    const waSent = whatsappSharedSet.has(record.id);
                                                    return (
                                                        <div key={record.id} className="px-3 py-2 flex items-center gap-2 bg-muted/10 hover:bg-muted/25 transition-colors">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 flex-1 text-xs">
                                                                <div>
                                                                    <span className="text-muted-foreground">Date </span>
                                                                    <span className="font-medium">{formatDate(record.date)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground">Driver </span>
                                                                    <span className="font-medium">{record.driver_name || 'N/A'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground">Actual </span>
                                                                    <span className="font-medium text-destructive">
                                                                        {kmPerLitre ? `${formatNumber(kmPerLitre, 2)} km/L` : 'N/A'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground">Norm </span>
                                                                    <span className="font-medium">
                                                                        {norm ? `${formatNumber(norm.expected_km_per_litre, 2)} km/L` : '—'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {waSent ? (
                                                                <span
                                                                    title="Debriefed via WhatsApp"
                                                                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full"
                                                                >
                                                                    <CheckCircle className="h-3 w-3" />
                                                                    WA Sent
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    title="WhatsApp debrief not yet sent"
                                                                    className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                                                                >
                                                                    <MessageCircle className="h-3 w-3" />
                                                                    WA Pending
                                                                </span>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="shrink-0 text-xs h-7 px-2"
                                                                onClick={() => onOpenDebrief(record)}
                                                            >
                                                                <FileText className="h-3.5 w-3.5 mr-1" />
                                                                Debrief
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Pending Debriefs</h3>
                            <p className="text-muted-foreground">
                                All records are within acceptable fuel efficiency norms
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DieselDebriefTab;
