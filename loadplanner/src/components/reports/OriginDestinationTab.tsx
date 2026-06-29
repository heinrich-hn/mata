import { useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowDownTrayIcon, MapPinIcon, TruckIcon } from "@heroicons/react/24/outline";
import {
    aggregate,
    buildBuckets,
    buildRoutes,
    filterLoads,
    exportOriginDestinationToExcel,
    exportOriginDestinationToPdf,
    type TimeRange,
} from "@/lib/exportOriginDestinationReport";
import type { Load } from "@/hooks/useTrips";

interface OriginDestinationTabProps {
    loads: Load[];
    timeRange: TimeRange;
}

function BreakdownTable({
    locationHeader,
    buckets,
    rows,
}: {
    locationHeader: string;
    buckets: { key: string; label: string }[];
    rows: { location: string; counts: number[]; total: number }[];
}) {
    const bucketTotals = buckets.map((_, i) => rows.reduce((s, r) => s + r.counts[i], 0));
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="sticky left-0 bg-background font-semibold">
                            {locationHeader}
                        </TableHead>
                        {buckets.map((b) => (
                            <TableHead key={b.key} className="text-right whitespace-nowrap">
                                {b.label}
                            </TableHead>
                        ))}
                        <TableHead className="text-right font-semibold">Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={buckets.length + 2} className="text-center text-muted-foreground">
                                No loads in selected period
                            </TableCell>
                        </TableRow>
                    ) : (
                        rows.map((r) => (
                            <TableRow key={r.location}>
                                <TableCell className="sticky left-0 bg-background font-medium">
                                    {r.location}
                                </TableCell>
                                {r.counts.map((c, i) => (
                                    <TableCell key={i} className="text-right">
                                        {c || ""}
                                    </TableCell>
                                ))}
                                <TableCell className="text-right font-semibold">{r.total}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                {rows.length > 0 && (
                    <tfoot>
                        <TableRow className="bg-muted/50 font-semibold">
                            <TableCell className="sticky left-0 bg-muted/50">TOTAL</TableCell>
                            {bucketTotals.map((t, i) => (
                                <TableCell key={i} className="text-right">
                                    {t}
                                </TableCell>
                            ))}
                            <TableCell className="text-right">{grandTotal}</TableCell>
                        </TableRow>
                    </tfoot>
                )}
            </Table>
        </div>
    );
}

export function OriginDestinationTab({
    loads,
    timeRange,
}: OriginDestinationTabProps) {
    const { buckets, origins, destinations, routes } = useMemo(() => {
        const data = filterLoads(loads, timeRange);
        const bks = buildBuckets(timeRange, "monthly");
        return {
            buckets: bks,
            origins: aggregate(data, bks, "origin"),
            destinations: aggregate(data, bks, "destination"),
            routes: buildRoutes(data).slice(0, 15),
        };
    }, [loads, timeRange]);

    return (
        <TabsContent value="origin-destination" className="space-y-6">
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={() => exportOriginDestinationToExcel(loads, timeRange, "monthly")}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                    <ArrowDownTrayIcon className="h-4 w-4 text-emerald-600" />
                    Export Excel
                </button>
                <button
                    type="button"
                    onClick={() => exportOriginDestinationToPdf(loads, timeRange, "monthly")}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                    <ArrowDownTrayIcon className="h-4 w-4 text-rose-600" />
                    Export PDF
                </button>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <TruckIcon className="h-5 w-5 text-indigo-500" />
                        Loads Shipped by Origin
                    </CardTitle>
                    <CardDescription>
                        Number of loads dispatched from each origin per month
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <BreakdownTable locationHeader="Origin" buckets={buckets} rows={origins} />
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <MapPinIcon className="h-5 w-5 text-emerald-500" />
                        Loads Delivered by Destination
                    </CardTitle>
                    <CardDescription>
                        Number of loads delivered to each destination per month
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <BreakdownTable locationHeader="Destination" buckets={buckets} rows={destinations} />
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <MapPinIcon className="h-5 w-5 text-amber-500" />
                        Top Origin → Destination Routes
                    </CardTitle>
                    <CardDescription>Loads grouped by origin and destination</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Origin</TableHead>
                                    <TableHead>Destination</TableHead>
                                    <TableHead className="text-right">Loads</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {routes.map((r) => (
                                    <TableRow key={`${r.origin}-${r.destination}`}>
                                        <TableCell className="font-medium">{r.origin}</TableCell>
                                        <TableCell>{r.destination}</TableCell>
                                        <TableCell className="text-right font-semibold">{r.loads}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent >
    );
}
