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
import { ArrowDownTrayIcon, ChartBarIcon, MapPinIcon } from "@heroicons/react/24/outline";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    aggregate,
    buildBuckets,
    buildRoutes,
    filterLoads,
    exportOriginDestinationToExcel,
    exportOriginDestinationToPdf,
    type LocationBreakdown,
    type TimeRange,
} from "@/lib/exportOriginDestinationReport";
import type { Load } from "@/hooks/useTrips";

interface OriginDestinationTabProps {
    loads: Load[];
    timeRange: TimeRange;
}

// Locations to chart, by role.
const ORIGIN_SERIES = ["BV", "CBC"] as const;
const DESTINATION_SERIES = ["Rezende Depot", "Bulawayo Depot", "Chitanda - Harare"] as const;

// Bar colours per series.
const SERIES_COLORS: Record<string, string> = {
    BV: "#6366f1",
    CBC: "#8b5cf6",
    "Rezende Depot": "#22c55e",
    "Bulawayo Depot": "#0ea5e9",
    "Chitanda - Harare": "#f97316",
};

const normalize = (value: string) => value.trim().toLowerCase();

/** Return the per-bucket counts for a named location, or zeros if absent. */
function countsFor(rows: LocationBreakdown[], name: string, bucketCount: number): number[] {
    const match = rows.find((r) => normalize(r.location) === normalize(name));
    return match ? match.counts : new Array(bucketCount).fill(0);
}

export function OriginDestinationTab({
    loads,
    timeRange,
}: OriginDestinationTabProps) {
    const { chartData, routes } = useMemo(() => {
        const data = filterLoads(loads, timeRange);
        const bks = buildBuckets(timeRange, "monthly");
        const origins = aggregate(data, bks, "origin");
        const destinations = aggregate(data, bks, "destination");

        const series: Record<string, number[]> = {};
        for (const name of ORIGIN_SERIES) series[name] = countsFor(origins, name, bks.length);
        for (const name of DESTINATION_SERIES)
            series[name] = countsFor(destinations, name, bks.length);

        const rows = bks.map((b, i) => {
            const row: Record<string, string | number> = { month: b.label };
            for (const name of [...ORIGIN_SERIES, ...DESTINATION_SERIES]) {
                row[name] = series[name][i];
            }
            return row;
        });

        // Only routes shipped from BV or CBC.
        const filteredRoutes = buildRoutes(data).filter((r) =>
            ORIGIN_SERIES.some((o) => normalize(o) === normalize(r.origin)),
        );

        return { chartData: rows, routes: filteredRoutes };
    }, [loads, timeRange]);

    return (
        <TabsContent value="origin-destination" className="space-y-6">
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={() => exportOriginDestinationToExcel(loads, "all", "monthly")}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                    <ArrowDownTrayIcon className="h-4 w-4 text-emerald-600" />
                    Export Excel
                </button>
                <button
                    type="button"
                    onClick={() => exportOriginDestinationToPdf(loads, "all", "monthly")}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                    <ArrowDownTrayIcon className="h-4 w-4 text-rose-600" />
                    Export PDF
                </button>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <ChartBarIcon className="h-5 w-5 text-indigo-500" />
                        Loads by Origin &amp; Destination
                    </CardTitle>
                    <CardDescription>
                        Monthly loads from origins BV and CBC, and to destinations Rezende Depot and
                        Bulawayo Depot
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} vertical={false} />
                                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                                <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: "0.5rem",
                                        border: "1px solid #e5e7eb",
                                    }}
                                />
                                <Legend />
                                {[...ORIGIN_SERIES, ...DESTINATION_SERIES].map((name) => (
                                    <Bar
                                        key={name}
                                        dataKey={name}
                                        fill={SERIES_COLORS[name]}
                                        radius={[4, 4, 0, 0]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <MapPinIcon className="h-5 w-5 text-amber-500" />
                        Top Origin → Destination Routes
                    </CardTitle>
                    <CardDescription>Loads shipped from BV and CBC, by destination</CardDescription>
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
                                {routes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                            No loads from BV or CBC in selected period
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    routes.map((r) => (
                                        <TableRow key={`${r.origin}-${r.destination}`}>
                                            <TableCell className="font-medium">{r.origin}</TableCell>
                                            <TableCell>{r.destination}</TableCell>
                                            <TableCell className="text-right font-semibold">{r.loads}</TableCell>
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
