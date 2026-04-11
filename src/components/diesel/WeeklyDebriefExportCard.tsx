import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
    generateWeeklyDebriefsPDF,
    type WeeklyDebriefExportOptions,
    type WeeklyDebriefNorm,
    type WeeklyDebriefRecord,
} from '@/lib/dieselDebriefExport';
import { format } from 'date-fns';
import {
    Calendar,
    Download,
    Eye,
    FileText,
    Loader2,
    Save,
    Trash2,
    Truck,
    User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface SavedExport {
    id: string;
    fileName: string;
    fileUrl: string;
    filterType: 'all' | 'fleet' | 'driver';
    filterValue: string;
    createdAt: string;
    recordCount: number;
}

const STORAGE_KEY = 'mata-weekly-debrief-exports';

function loadSavedExports(): SavedExport[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function persistSavedExports(exports: SavedExport[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exports));
}

interface WeeklyDebriefExportCardProps {
    dieselRecords: WeeklyDebriefRecord[];
    dieselNorms: WeeklyDebriefNorm[];
}

export default function WeeklyDebriefExportCard({
    dieselRecords,
    dieselNorms,
}: WeeklyDebriefExportCardProps) {
    const [filterType, setFilterType] = useState<'all' | 'fleet' | 'driver'>('all');
    const [selectedFleet, setSelectedFleet] = useState('');
    const [selectedDriver, setSelectedDriver] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedExports, setSavedExports] = useState<SavedExport[]>(loadSavedExports);

    // Reload saved exports on mount
    useEffect(() => {
        setSavedExports(loadSavedExports());
    }, []);

    // Date range info
    const dateRange = useMemo(() => {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
            start: format(sevenDaysAgo, 'dd MMM yyyy'),
            end: format(now, 'dd MMM yyyy'),
        };
    }, []);

    // Records that fall in the last 7 days
    const weeklyRecords = useMemo(() => {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const rangeStart = format(sevenDaysAgo, 'yyyy-MM-dd');
        const rangeEnd = format(now, 'yyyy-MM-dd');
        return dieselRecords.filter(r => r.date >= rangeStart && r.date <= rangeEnd);
    }, [dieselRecords]);

    // Unique fleets and drivers from weekly data
    const uniqueFleets = useMemo(
        () => [...new Set(weeklyRecords.map(r => r.fleet_number))].sort(),
        [weeklyRecords],
    );
    const uniqueDrivers = useMemo(
        () =>
            [...new Set(weeklyRecords.map(r => r.driver_name).filter(Boolean) as string[])].sort(),
        [weeklyRecords],
    );

    // Filtered record count preview
    const filteredCount = useMemo(() => {
        let filtered = weeklyRecords;
        if (filterType === 'fleet' && selectedFleet)
            filtered = filtered.filter(r => r.fleet_number === selectedFleet);
        if (filterType === 'driver' && selectedDriver)
            filtered = filtered.filter(r => r.driver_name === selectedDriver);
        return filtered.length;
    }, [weeklyRecords, filterType, selectedFleet, selectedDriver]);

    const buildOptions = useCallback(
        (returnBlob?: boolean): WeeklyDebriefExportOptions => ({
            records: dieselRecords,
            norms: dieselNorms,
            fleetNumber: filterType === 'fleet' ? selectedFleet : undefined,
            driverName: filterType === 'driver' ? selectedDriver : undefined,
            returnBlob,
        }),
        [dieselRecords, dieselNorms, filterType, selectedFleet, selectedDriver],
    );

    // Download only (no save)
    const handleDownload = useCallback(() => {
        if (filterType === 'fleet' && !selectedFleet) {
            toast.error('Please select a fleet number');
            return;
        }
        if (filterType === 'driver' && !selectedDriver) {
            toast.error('Please select a driver');
            return;
        }
        setIsExporting(true);
        try {
            generateWeeklyDebriefsPDF(buildOptions(false));
            toast.success('PDF downloaded');
        } catch {
            toast.error('Failed to generate PDF');
        } finally {
            setIsExporting(false);
        }
    }, [buildOptions, filterType, selectedFleet, selectedDriver]);

    // Download + save to Supabase Storage
    const handleSaveAndDownload = useCallback(async () => {
        if (filterType === 'fleet' && !selectedFleet) {
            toast.error('Please select a fleet number');
            return;
        }
        if (filterType === 'driver' && !selectedDriver) {
            toast.error('Please select a driver');
            return;
        }
        setIsSaving(true);
        try {
            // 1. Generate blob
            const blob = generateWeeklyDebriefsPDF(buildOptions(true));
            if (!blob || !(blob instanceof Blob)) {
                toast.error('No records found for the selected filter');
                return;
            }

            // 2. Also trigger download
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const filterLabel =
                filterType === 'fleet'
                    ? selectedFleet
                    : filterType === 'driver'
                        ? selectedDriver.replace(/\s+/g, '_')
                        : 'all-vehicles';
            const fileName = `weekly-debriefs-${filterLabel}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
            a.href = downloadUrl;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(downloadUrl);

            // 3. Upload to Supabase Storage
            const storagePath = `debrief-exports/${fileName}`;
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(storagePath, blob, {
                    contentType: 'application/pdf',
                    upsert: true,
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                toast.warning('Downloaded but failed to save online — ' + uploadError.message);
                return;
            }

            const {
                data: { publicUrl },
            } = supabase.storage.from('documents').getPublicUrl(storagePath);

            // 4. Save reference locally
            const newExport: SavedExport = {
                id: crypto.randomUUID(),
                fileName,
                fileUrl: publicUrl,
                filterType,
                filterValue:
                    filterType === 'fleet'
                        ? selectedFleet
                        : filterType === 'driver'
                            ? selectedDriver
                            : 'All Vehicles',
                createdAt: new Date().toISOString(),
                recordCount: filteredCount,
            };

            const updated = [newExport, ...savedExports].slice(0, 50); // Keep max 50
            setSavedExports(updated);
            persistSavedExports(updated);
            toast.success('PDF downloaded and saved');
        } catch (err) {
            console.error('Save failed:', err);
            toast.error('Failed to save export');
        } finally {
            setIsSaving(false);
        }
    }, [
        buildOptions,
        filterType,
        selectedFleet,
        selectedDriver,
        filteredCount,
        savedExports,
    ]);

    const handleDeleteExport = useCallback(
        async (exportItem: SavedExport) => {
            // Remove from storage (best effort)
            const storagePath = `debrief-exports/${exportItem.fileName}`;
            await supabase.storage.from('documents').remove([storagePath]);

            const updated = savedExports.filter(e => e.id !== exportItem.id);
            setSavedExports(updated);
            persistSavedExports(updated);
            toast.success('Export removed');
        },
        [savedExports],
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Weekly Debrief Export
                        </CardTitle>
                        <CardDescription>
                            Download or save the last 7 days of diesel debriefs ({dateRange.start} –{' '}
                            {dateRange.end}) — per fleet, per driver, or all vehicles. Saved exports can
                            be viewed again.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">{weeklyRecords.length} records this week</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* Filter controls */}
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Group By</label>
                        <select
                            title="Group by"
                            value={filterType}
                            onChange={e => {
                                setFilterType(e.target.value as 'all' | 'fleet' | 'driver');
                                setSelectedFleet('');
                                setSelectedDriver('');
                            }}
                            className="px-3 py-2 border rounded-md bg-background text-sm min-w-[140px]"
                        >
                            <option value="all">All Vehicles</option>
                            <option value="fleet">By Fleet / Truck</option>
                            <option value="driver">By Driver</option>
                        </select>
                    </div>

                    {filterType === 'fleet' && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Fleet Number</label>
                            <select
                                title="Select fleet"
                                value={selectedFleet}
                                onChange={e => setSelectedFleet(e.target.value)}
                                className="px-3 py-2 border rounded-md bg-background text-sm min-w-[140px]"
                            >
                                <option value="">Select fleet...</option>
                                {uniqueFleets.map(f => (
                                    <option key={f} value={f}>
                                        {f}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {filterType === 'driver' && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Driver</label>
                            <select
                                title="Select driver"
                                value={selectedDriver}
                                onChange={e => setSelectedDriver(e.target.value)}
                                className="px-3 py-2 border rounded-md bg-background text-sm min-w-[180px]"
                            >
                                <option value="">Select driver...</option>
                                {uniqueDrivers.map(d => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                        <Badge variant="outline" className="text-xs">
                            {filteredCount} transactions
                        </Badge>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            disabled={isExporting || filteredCount === 0}
                            className="gap-2"
                        >
                            {isExporting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Download PDF
                        </Button>

                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveAndDownload}
                            disabled={isSaving || filteredCount === 0}
                            className="gap-2"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save &amp; Download
                        </Button>
                    </div>
                </div>

                {/* Saved Exports list */}
                {savedExports.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Saved Exports ({savedExports.length})
                        </h4>
                        <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-2">
                            {savedExports.map(exp => (
                                <div
                                    key={exp.id}
                                    className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{exp.fileName}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    {exp.filterType === 'fleet' ? (
                                                        <Truck className="h-3 w-3" />
                                                    ) : exp.filterType === 'driver' ? (
                                                        <User className="h-3 w-3" />
                                                    ) : (
                                                        <Calendar className="h-3 w-3" />
                                                    )}
                                                    {exp.filterValue}
                                                </span>
                                                <span>•</span>
                                                <span>{exp.recordCount} records</span>
                                                <span>•</span>
                                                <span>{format(new Date(exp.createdAt), 'dd MMM yyyy HH:mm')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(exp.fileUrl, '_blank')}
                                            title="View PDF"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteExport(exp)}
                                            title="Delete export"
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
