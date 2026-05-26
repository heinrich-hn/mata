import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
    type MutareDepotStay,
} from "@/hooks/useMutareDepotActivity";
import { format, parseISO, subMonths } from "date-fns";
import { Download, MapPin } from "lucide-react";
import { useMemo } from "react";

type TimeRange = "3months" | "6months" | "12months";

interface MutareDepotTabProps {
    timeRange: TimeRange;
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

function csvEscape(val: string | number | null | undefined): string {
    if (val == null) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function downloadCsv(stays: MutareDepotStay[]) {
    const headers = [
        "Vehicle",
        "Entry Time",
        "Exit Time",
        "Duration (minutes)",
        "Duration",
        "Still Inside",
    ];
    const rows = stays.map((s) => [
        s.vehicleRegistration,
        formatTime(s.entryTime),
        formatTime(s.exitTime),
        s.durationMinutes ?? "",
        formatDuration(s.durationMinutes),
        s.stillInside ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows]
        .map((r) => r.map(csvEscape).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mutare-depot-activity-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => downloadCsv(stays)}
                        disabled={stays.length === 0}
                    >
                        <Download className="h-4 w-4" />
                        Download CSV
                    </Button>
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
