import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FileDown, AlertTriangle, ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { exportRubberAuditPDF, exportRubberAuditExcel, type RubberAuditData } from "@/utils/tyreExport";

// Reuse the EnrichedTyre type from FleetTyreReports
type EnrichedTyre = {
    id: string;
    serial_number: string | null;
    brand: string | null;
    model: string | null;
    size: string | null;
    type: string | null;
    current_tread_depth: number | null;
    initial_tread_depth: number | null;
    km_travelled: number | null;
    condition: string | null;
    pressure_reading: number | null;
    purchase_cost_zar: number | null;
    fleet_number: string;
    fleet_position: string;
    registration_no: string | null;
    current_fleet_position: string | null;
    notes: string | null;
};

interface RubberAuditReportProps {
    tyres: EnrichedTyre[];
    allVehicleFleetNumbers?: string[];
}

const DEFAULT_RECOMMENDATIONS: Record<string, string> = {
    "Stock Holding and Spare Wheels":
        "Establish a minimum stock level for essential spare parts, including wheels, to ensure availability when needed. Implement a regular inventory check to monitor stock levels and reorder parts before they run out. Partner with reliable suppliers to maintain a steady supply of spare wheels and other critical components.",
    "Missing Studs":
        "Conduct a thorough inspection of all vehicles to identify and replace missing studs. Implement a preventive maintenance schedule to regularly check and tighten wheel studs. Train technicians on the importance of proper stud installation and maintenance.",
    "Welded Rims":
        "Replace welded rims with new, undamaged rims to ensure safety and reliability. Implement a policy to prohibit the use of welded rims and ensure all rims meet safety standards. Conduct regular inspections to identify and remove any welded rims from service.",
    "Grease Covers":
        "Ensure all vehicles have properly installed grease covers to protect bearings and other components. Conduct regular maintenance checks to inspect and replace missing or damaged grease covers. Train technicians on the importance of grease covers and proper installation techniques.",
    "Damaged Bearings":
        "Inspect all vehicles for damaged bearings and replace them as needed. Implement a preventive maintenance schedule to regularly check and lubricate bearings. Train technicians on proper bearing maintenance and replacement procedures.",
    "Reporting and Documentation":
        "Maintain detailed records of all inspections, maintenance activities, and replacements. Implement a reporting system to track issues and monitor the effectiveness of corrective actions. Regularly review and update maintenance procedures to address recurring issues and improve fleet reliability.",
};

const WEAR_RANGES: { label: string; min: number; max: number }[] = [
    { label: "0-3mm", min: 0, max: 3 },
    { label: "4-7mm", min: 4, max: 7 },
    { label: "8-10mm", min: 8, max: 10 },
    { label: "11-14mm", min: 11, max: 14 },
    { label: "15mm and above", min: 15, max: Infinity },
];

const RubberAuditReport = ({ tyres, allVehicleFleetNumbers = [] }: RubberAuditReportProps) => {
    const [reporterName, setReporterName] = useState("");
    const [reportMonth, setReportMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [recommendations, setRecommendations] = useState<Record<string, string>>(DEFAULT_RECOMMENDATIONS);

    // Total vehicles checked = distinct fleet numbers with tyres
    const vehiclesChecked = useMemo(() => {
        const fleetSet = new Set<string>();
        tyres.forEach((t) => {
            if (t.fleet_number) fleetSet.add(t.fleet_number);
        });
        return Array.from(fleetSet).sort();
    }, [tyres]);

    // Inflation Status Analysis
    const inflationAnalysis = useMemo(() => {
        let underinflation = 0;
        let overinflation = 0;
        let correct = 0;
        let unableToCheck = 0;

        tyres.forEach((t) => {
            if (t.pressure_reading == null) {
                unableToCheck++;
                return;
            }
            // Default recommended pressure: 100 PSI; tolerance ±10%
            const recommended = 100;
            const lower = recommended * 0.9;
            const upper = recommended * 1.1;

            if (t.pressure_reading < lower) {
                underinflation++;
            } else if (t.pressure_reading > upper) {
                overinflation++;
            } else {
                correct++;
            }
        });

        const total = tyres.length;
        return {
            rows: [
                { status: "Underinflation", count: underinflation, percentage: total > 0 ? Math.round((underinflation / total) * 100) : 0 },
                { status: "Overinflation", count: overinflation, percentage: total > 0 ? Math.round((overinflation / total) * 100) : 0 },
                { status: "Correct Inflation", count: correct, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 },
                { status: "Unable to check", count: unableToCheck, percentage: total > 0 ? Math.round((unableToCheck / total) * 100) : 0 },
            ],
            total,
        };
    }, [tyres]);

    // Wear Analysis
    const wearAnalysis = useMemo(() => {
        const total = tyres.length;
        const buckets = WEAR_RANGES.map((range) => {
            const count = tyres.filter((t) => {
                const depth = t.current_tread_depth;
                if (depth == null) return false;
                return depth >= range.min && depth <= range.max;
            }).length;
            return {
                label: range.label,
                count,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0,
            };
        });
        // Tyres with no tread depth data
        const noData = tyres.filter((t) => t.current_tread_depth == null).length;
        if (noData > 0) {
            buckets.push({
                label: "No data",
                count: noData,
                percentage: total > 0 ? Math.round((noData / total) * 100) : 0,
            });
        }
        return { rows: buckets, total };
    }, [tyres]);

    // Tyre Size Analysis
    const sizeAnalysis = useMemo(() => {
        const total = tyres.length;
        const counts: Record<string, number> = {};
        tyres.forEach((t) => {
            const size = t.size || "Unknown";
            counts[size] = (counts[size] || 0) + 1;
        });
        const rows = Object.entries(counts)
            .map(([size, count]) => ({
                size,
                count,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);
        return { rows, total };
    }, [tyres]);

    // Brand Analysis
    const brandAnalysis = useMemo(() => {
        const total = tyres.length;
        const counts: Record<string, number> = {};
        tyres.forEach((t) => {
            const brand = t.brand || "Unknown";
            counts[brand] = (counts[brand] || 0) + 1;
        });
        const rows = Object.entries(counts)
            .map(([brand, count]) => ({
                brand,
                count,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);
        return { rows, total };
    }, [tyres]);

    // Urgent Attention — tyres needing replacement
    const urgentAttention = useMemo(() => {
        const urgent = tyres.filter((t) => {
            const isCriticalCondition = t.condition === "poor" || t.condition === "needs_replacement";
            const isLowTread = t.current_tread_depth != null && t.current_tread_depth <= 3;
            return isCriticalCondition || isLowTread;
        });

        // Group by fleet_number to combine positions
        const grouped: Record<string, {
            fleet_number: string;
            positions: string[];
            size: string;
            tread_depth: number | null;
            count: number;
        }> = {};

        urgent.forEach((t) => {
            const key = `${t.fleet_number}-${t.size || "unknown"}`;
            if (!grouped[key]) {
                grouped[key] = {
                    fleet_number: t.fleet_number,
                    positions: [],
                    size: t.size || "Unknown",
                    tread_depth: t.current_tread_depth,
                    count: 0,
                };
            }
            const pos = t.fleet_position?.split("-")?.[2] || t.fleet_position || "-";
            grouped[key].positions.push(pos);
            grouped[key].count += 1;
            // Keep lowest tread depth
            if (t.current_tread_depth != null) {
                if (grouped[key].tread_depth == null || t.current_tread_depth < grouped[key].tread_depth) {
                    grouped[key].tread_depth = t.current_tread_depth;
                }
            }
        });

        const rows = Object.values(grouped).map((g) => ({
            fleet_number: g.fleet_number,
            position: g.positions.join(" & "),
            size: g.size,
            requirement: "NEW TYRE",
            rtd: g.tread_depth != null ? `${g.tread_depth}MM` : "N/A",
            comment: "REPLACE",
            total: g.count,
        }));

        const totalCount = rows.reduce((sum, r) => sum + r.total, 0);
        return { rows, totalCount };
    }, [tyres]);

    // Fleet on Stands — vehicles with no active tyres
    const fleetOnStands = useMemo(() => {
        const activeFleets = new Set(tyres.map((t) => t.fleet_number));
        const onStands = allVehicleFleetNumbers
            .filter((fn) => !activeFleets.has(fn))
            .map((fn) => ({ fleet_number: fn, tyre_size: "-", tyre_count: 0 }));
        return onStands;
    }, [tyres, allVehicleFleetNumbers]);

    // Build the full audit data object for export
    const buildAuditData = (): RubberAuditData => {
        const monthDate = new Date(reportMonth + "-01");
        const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        return {
            reportTitle: "MATANUSKA TYRE REPORT",
            reportMonth: monthLabel,
            reporterName: reporterName || "N/A",
            totalVehicles: vehiclesChecked.length,
            totalTyres: tyres.length,
            inflationStatus: inflationAnalysis.rows,
            wearAnalysis: wearAnalysis.rows,
            sizeAnalysis: sizeAnalysis.rows,
            brandAnalysis: brandAnalysis.rows,
            vehiclesChecked,
            urgentAttention: urgentAttention.rows,
            urgentTotal: urgentAttention.totalCount,
            fleetOnStands,
            recommendations: Object.entries(recommendations).map(([category, text], i) => ({
                number: i + 1,
                category,
                text,
            })),
        };
    };

    const handleExportPDF = () => {
        exportRubberAuditPDF(buildAuditData());
    };

    const handleExportExcel = async () => {
        await exportRubberAuditExcel(buildAuditData());
    };

    const formatMonthLabel = () => {
        const monthDate = new Date(reportMonth + "-01");
        return monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
    };

    return (
        <div className="space-y-6">
            {/* Report Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                Rubber Audit Survey Report
                            </CardTitle>
                            <CardDescription>
                                Generate a comprehensive tyre audit report for export
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleExportPDF} variant="outline" size="sm">
                                <FileDown className="w-4 h-4 mr-2" />
                                Export PDF
                            </Button>
                            <Button onClick={handleExportExcel} variant="outline" size="sm">
                                <FileDown className="w-4 h-4 mr-2" />
                                Export Excel
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="reportMonth">Report Month</Label>
                            <Input
                                id="reportMonth"
                                type="month"
                                value={reportMonth}
                                onChange={(e) => setReportMonth(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="reporterName">Report By</Label>
                            <Input
                                id="reporterName"
                                placeholder="Enter reporter name"
                                value={reporterName}
                                onChange={(e) => setReporterName(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Total Vehicles Checked</Label>
                            <div className="mt-2 text-2xl font-bold">{vehiclesChecked.length}</div>
                        </div>
                        <div>
                            <Label>Total Tyres Checked</Label>
                            <div className="mt-2 text-2xl font-bold">{tyres.length}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Report Header Preview */}
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-bold">MATANUSKA TYRE REPORT FOR {formatMonthLabel()}</h2>
                        {reporterName && <p className="text-sm text-muted-foreground">Report by: {reporterName}</p>}
                        <p className="text-sm text-muted-foreground">
                            TOTAL # of Vehicles checked = {vehiclesChecked.length} | TOTAL # OF TYRES CHECKED = {tyres.length}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Inflation Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Inflation Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Inflation Status</TableHead>
                                <TableHead className="text-center">Count</TableHead>
                                <TableHead className="text-center">Percentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {inflationAnalysis.rows.map((row) => (
                                <TableRow key={row.status}>
                                    <TableCell>{row.status}</TableCell>
                                    <TableCell className="text-center">{row.count}</TableCell>
                                    <TableCell className="text-center">{row.percentage}%</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-center">{inflationAnalysis.total}</TableCell>
                                <TableCell className="text-center">100%</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Wear Analysis */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Wear Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tread Depth</TableHead>
                                <TableHead className="text-center">Count</TableHead>
                                <TableHead className="text-center">Percentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {wearAnalysis.rows.map((row) => (
                                <TableRow key={row.label}>
                                    <TableCell>{row.label}</TableCell>
                                    <TableCell className="text-center">{row.count}</TableCell>
                                    <TableCell className="text-center">{row.percentage}%</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-center">{wearAnalysis.total}</TableCell>
                                <TableCell className="text-center">100%</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Tyre Size Analysis */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Tyre Size Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tyre Size</TableHead>
                                <TableHead className="text-center">Count</TableHead>
                                <TableHead className="text-center">Percentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sizeAnalysis.rows.map((row) => (
                                <TableRow key={row.size}>
                                    <TableCell>{row.size}</TableCell>
                                    <TableCell className="text-center">{row.count}</TableCell>
                                    <TableCell className="text-center">{row.percentage}%</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-center">{sizeAnalysis.total}</TableCell>
                                <TableCell className="text-center">100%</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Brand Analysis */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Brand Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Brand</TableHead>
                                <TableHead className="text-center">Count</TableHead>
                                <TableHead className="text-center">Percentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {brandAnalysis.rows.map((row) => (
                                <TableRow key={row.brand}>
                                    <TableCell>{row.brand}</TableCell>
                                    <TableCell className="text-center">{row.count}</TableCell>
                                    <TableCell className="text-center">{row.percentage}%</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-center">{brandAnalysis.total}</TableCell>
                                <TableCell className="text-center">100%</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Vehicles Checked */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Vehicles Checked</CardTitle>
                </CardHeader>
                <CardContent>
                    {vehiclesChecked.length === 0 ? (
                        <p className="text-muted-foreground">No vehicles found</p>
                    ) : (
                        <p className="leading-relaxed">
                            {vehiclesChecked.join(", ")}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Urgent Attention */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Urgent Attention – Replacement Required
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {urgentAttention.rows.length === 0 ? (
                        <p className="text-muted-foreground">No tyres require urgent replacement</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fleet Number</TableHead>
                                    <TableHead>Position</TableHead>
                                    <TableHead>Tyre Size</TableHead>
                                    <TableHead>Requirement</TableHead>
                                    <TableHead className="text-center">RTD</TableHead>
                                    <TableHead>Comment</TableHead>
                                    <TableHead className="text-center">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {urgentAttention.rows.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{row.fleet_number}</TableCell>
                                        <TableCell>{row.position}</TableCell>
                                        <TableCell>{row.size}</TableCell>
                                        <TableCell>
                                            <Badge variant="destructive">{row.requirement}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">{row.rtd}</TableCell>
                                        <TableCell>{row.comment}</TableCell>
                                        <TableCell className="text-center font-bold">{row.total}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold border-t-2">
                                    <TableCell colSpan={6}>TOTAL</TableCell>
                                    <TableCell className="text-center">{urgentAttention.totalCount}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Fleet on Stands */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Fleet on Stands</CardTitle>
                    <CardDescription>Vehicles with no tyres currently installed</CardDescription>
                </CardHeader>
                <CardContent>
                    {fleetOnStands.length === 0 ? (
                        <p className="text-muted-foreground">No vehicles currently on stands</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fleet Number</TableHead>
                                    <TableHead>Tyre Size</TableHead>
                                    <TableHead className="text-center">Number of Tyres</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fleetOnStands.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{row.fleet_number}</TableCell>
                                        <TableCell>{row.tyre_size}</TableCell>
                                        <TableCell className="text-center">{row.tyre_count}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold border-t-2">
                                    <TableCell colSpan={2}>TOTAL</TableCell>
                                    <TableCell className="text-center">
                                        {fleetOnStands.reduce((sum, r) => sum + r.tyre_count, 0)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                    <CardDescription>Edit recommendations before exporting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {Object.entries(recommendations).map(([category, text], index) => (
                        <div key={category}>
                            <Label className="font-semibold">
                                {index + 1}. {category}
                            </Label>
                            <Textarea
                                className="mt-1"
                                rows={3}
                                value={text}
                                onChange={(e) =>
                                    setRecommendations((prev) => ({ ...prev, [category]: e.target.value }))
                                }
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};

export default RubberAuditReport;
