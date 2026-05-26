import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import {
    useMutareDepotActivity,
} from "@/hooks/useMutareDepotActivity";
import {
    exportMutareDepotToExcel,
    exportMutareDepotToPdf,
    type MutareDepotExportData,
    type MutareDepotTimeRange,
} from "@/lib/exportMutareDepot";
import { format, parseISO, subMonths } from "date-fns";
import { Download, MapPin } from "lucide-react";
import { useMemo } from "react";

interface MutareDepotTabProps {
    timeRange: MutareDepotTimeRange;
}

function formatDuration(minutes: number | null): string {
    if (minutes == null) return "—";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatTime(iso: string | null): string {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "yyyy-MM-dd HH:mm");
    } catch {
        return iso;
    }
}

export function MutareDepotTab({ timeRange }: MutareDepotTabProps) {
    const { startDate, endDate } = useMemo(() => {
        const end = new Date();
        const months = timeRange === "3months" ? 3 : timeRange === "6months" ? 6 : 12;
        return { startDate: subMonths(end, months), endDate: end };
    }, [timeRange]);

    const { data: stays = [], isLoading } = useMutareDepotActivity({ startDate, endDate });

    const summary = useMemo(() => {
        const completed = stays.filter((s) => s.durationMinutes != null && !s.stillInside);
        const totalMinutes = completed.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
        const uniqueVehicles = new Set(stays.map((s) => s.vehicleRegistration)).size;
        return {
            totalStays: stays.length,
            uniqueVehicles,
            currentlyInside: stays.filter((s) => s.stillInside).length,
            avgMinutes: completed.length ? Math.round(totalMinutes / completed.length) : null,
        };
    }, [stays]);

    const exportData = useMemo<MutareDepotExportData>(
        () => ({ stays, summary, startDate, endDate, timeRange }),
        [stays, summary, startDate, endDate, timeRange],
    );

    const disabled = stays.length === 0 || isLoading;

    return (
        <TabsContent value="mutare-depot" className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-orange-500" />
                            Mutare Depot Activity
                        </CardTitle>
                        <CardDescription>
                            Entry / exit times for every truck detected at the Mutare Depot geofence.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
                                    <Download className="h-4 w-4" />
                                    Export PDF
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Mutare Depot Report</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => exportMutareDepotToPdf(exportData)}>
                                    Full Report (PDF)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
                                    <Download className="h-4 w-4" />
                                    Export Excel
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Mutare Depot Workbook</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => exportMutareDepotToExcel(exportData)}>
                                    Full Report (Excel)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <SummaryCard label="Total Stays" value={summary.totalStays} />
                        <SummaryCard label="Unique Trucks" value={summary.uniqueVehicles} />
                        <SummaryCard label="Currently Inside" value={summary.currentlyInside} />
                        <SummaryCard
                            label="Avg Stay"
                            value={summary.avgMinutes != null ? formatDuration(summary.avgMinutes) : "—"}
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Entry Time</TableHead>
                                    <TableHead>Exit Time</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            Loading depot activity…
                                        </TableCell>
                                    </TableRow>
                                ) : stays.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            No Mutare Depot activity recorded in this period.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    stays.map((s, i) => (
                                        <TableRow key={`${s.vehicleRegistration}-${s.entryTime ?? s.exitTime}-${i}`}>
                                            <TableCell className="font-medium">{s.vehicleRegistration}</TableCell>
                                            <TableCell>{formatTime(s.entryTime)}</TableCell>
                                            <TableCell>{formatTime(s.exitTime)}</TableCell>
                                            <TableCell className="text-right">
                                                {formatDuration(s.durationMinutes)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {s.stillInside ? (
                                                    <span className="text-orange-600 font-medium">Inside</span>
                                                ) : s.entryTime && s.exitTime ? (
                                                    <span className="text-emerald-600">Completed</span>
                                                ) : (
                                                    <span className="text-muted-foreground">Partial</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
    return (
        <Card className="bg-muted/30">
            <CardContent className="pt-6">
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
        </Card>
    );
}
