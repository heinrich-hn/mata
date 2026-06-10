/**
 * Fleet Analytics dialog — on-demand utilization & geofence dwell-time
 * reports computed from Telematics Guru trips and stored geofence events.
 */

import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, Clock, Download, Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { supabase } from "@/integrations/supabase/client";
import {
    computeDwellSummary,
    computeUtilization,
    exportFleetAnalyticsToExcel,
    formatMinutes,
    type DwellSummaryRow,
    type UtilizationRow,
} from "@/lib/fleetAnalytics";
import type { RawGeofenceEvent } from "@/lib/exportVehicleMovementReport";
import { getTrips } from "@/lib/telematicsGuru";

interface FleetAnalyticsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organisationId: number | null;
}

function defaultRange(): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { start: iso(start), end: iso(end) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geofenceEventsTable = () => (supabase as any).from("geofence_events");

export function FleetAnalyticsDialog({
    open,
    onOpenChange,
    organisationId,
}: FleetAnalyticsDialogProps) {
    const [{ start, end }] = useState(defaultRange);
    const [startDate, setStartDate] = useState(start);
    const [endDate, setEndDate] = useState(end);
    const [loading, setLoading] = useState(false);
    const [utilization, setUtilization] = useState<UtilizationRow[] | null>(null);
    const [dwell, setDwell] = useState<DwellSummaryRow[] | null>(null);

    const rangeStart = () => new Date(`${startDate}T00:00:00`);
    const rangeEnd = () => new Date(`${endDate}T23:59:59`);

    const generate = async () => {
        if (!organisationId) {
            toast.error("Connect to Telematics Guru first.");
            return;
        }
        if (rangeStart() > rangeEnd()) {
            toast.error("Start date must be before end date.");
            return;
        }

        setLoading(true);
        try {
            const [trips, eventsResult] = await Promise.all([
                getTrips({
                    organisationId,
                    from: rangeStart().toISOString(),
                    to: rangeEnd().toISOString(),
                    take: 2000,
                }).catch(() => []),
                geofenceEventsTable()
                    .select(
                        "event_type, geofence_name, vehicle_registration, telematics_asset_id, event_time, load_number, source",
                    )
                    .gte("event_time", rangeStart().toISOString())
                    .lte("event_time", rangeEnd().toISOString())
                    .order("event_time", { ascending: true })
                    .limit(5000),
            ]);

            const events = (eventsResult.data ?? []) as RawGeofenceEvent[];
            setUtilization(computeUtilization(trips, rangeStart(), rangeEnd()));
            setDwell(computeDwellSummary(events));

            if (trips.length === 0 && events.length === 0) {
                toast.info("No trip or geofence data found for this period.");
            }
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to generate analytics",
            );
        } finally {
            setLoading(false);
        }
    };

    const exportExcel = () => {
        if (!utilization || !dwell) return;
        exportFleetAnalyticsToExcel(utilization, dwell, rangeStart(), rangeEnd());
        toast.success("Fleet analytics exported");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Fleet Analytics
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Vehicle utilization and geofence dwell-time analysis
                    </DialogDescription>
                </DialogHeader>

                {/* Range + actions */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="fa-start" className="text-xs text-muted-foreground">From</Label>
                        <Input
                            id="fa-start"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-8 w-[150px] text-xs"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="fa-end" className="text-xs text-muted-foreground">To</Label>
                        <Input
                            id="fa-end"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-8 w-[150px] text-xs"
                        />
                    </div>
                    <Button size="sm" onClick={generate} disabled={loading} className="h-8 text-xs">
                        {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                        {loading ? "Generating…" : "Generate"}
                    </Button>
                    {utilization && dwell && (
                        <Button size="sm" variant="outline" onClick={exportExcel} className="h-8 text-xs">
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Export Excel
                        </Button>
                    )}
                </div>

                {/* Results */}
                {utilization && dwell ? (
                    <Tabs defaultValue="utilization" className="flex-1 min-h-0 flex flex-col">
                        <TabsList className="self-start h-8">
                            <TabsTrigger value="utilization" className="text-xs h-7">
                                Utilization ({utilization.length})
                            </TabsTrigger>
                            <TabsTrigger value="dwell" className="text-xs h-7">
                                Dwell Times ({dwell.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="utilization" className="flex-1 min-h-0 overflow-y-auto mt-2">
                            {utilization.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    No trips recorded in this period.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Vehicle</TableHead>
                                            <TableHead className="text-xs text-right">Trips</TableHead>
                                            <TableHead className="text-xs text-right">Distance</TableHead>
                                            <TableHead className="text-xs text-right">Driving</TableHead>
                                            <TableHead className="text-xs text-right">Idle</TableHead>
                                            <TableHead className="text-xs text-right">Max km/h</TableHead>
                                            <TableHead className="text-xs text-right">Util %</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {utilization.map((r) => (
                                            <TableRow key={r.vehicle}>
                                                <TableCell className="text-xs font-medium">{r.vehicle}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{r.trips}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{Math.round(r.distanceKm)} km</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{formatMinutes(r.drivingMinutes)}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{formatMinutes(r.idleMinutes)}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{Math.round(r.maxSpeedKmH)}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums font-semibold">
                                                    {r.utilizationPct.toFixed(1)}%
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>

                        <TabsContent value="dwell" className="flex-1 min-h-0 overflow-y-auto mt-2">
                            {dwell.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    No geofence visits recorded in this period.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Location</TableHead>
                                            <TableHead className="text-xs text-right">Visits</TableHead>
                                            <TableHead className="text-xs text-right">Avg Dwell</TableHead>
                                            <TableHead className="text-xs text-right">Max Dwell</TableHead>
                                            <TableHead className="text-xs text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dwell.map((r) => (
                                            <TableRow key={r.location}>
                                                <TableCell className="text-xs font-medium">{r.location}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{r.visits}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{formatMinutes(r.avgMinutes)}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums">{formatMinutes(r.maxMinutes)}</TableCell>
                                                <TableCell className="text-xs text-right tabular-nums font-semibold">{formatMinutes(r.totalMinutes)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Clock className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Pick a date range and generate the report</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
