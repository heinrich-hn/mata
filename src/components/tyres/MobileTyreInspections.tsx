import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Eye,
    FileText,
    Search,
    Smartphone,
} from "lucide-react";
import { useMemo, useState } from "react";
import { generateTyreInspectionPDF } from "@/lib/tyreInspectionPdfExport";

interface MobileInspection {
    id: string;
    inspection_number: string;
    inspection_date: string;
    vehicle_id: string | null;
    vehicle_registration: string | null;
    inspector_name: string | null;
    odometer_reading: number | null;
    has_fault: boolean | null;
    status: string | null;
    notes: string | null;
    completed_at: string | null;
    initiated_via: string | null;
}

interface InspectionItem {
    id: string;
    inspection_id: string;
    item_name: string;
    category: string;
    status: string;
    notes: string | null;
}

const MobileTyreInspections = () => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [sortField, setSortField] = useState<"date" | "vehicle">("date");
    const [sortAsc, setSortAsc] = useState(false);
    const [detailInspection, setDetailInspection] = useState<MobileInspection | null>(null);

    // Fetch all mobile tyre inspections
    const { data: inspections = [], isLoading } = useQuery<MobileInspection[]>({
        queryKey: ["mobile-tyre-inspections-dashboard"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vehicle_inspections")
                .select(
                    "id, inspection_number, inspection_date, vehicle_id, vehicle_registration, inspector_name, odometer_reading, has_fault, status, notes, completed_at, initiated_via"
                )
                .eq("inspection_type", "tyre")
                .order("inspection_date", { ascending: false })
                .limit(200);

            if (error) throw error;
            return data || [];
        },
        refetchInterval: 30000,
    });

    // Fetch vehicles for lookup
    const { data: vehicles = [] } = useQuery({
        queryKey: ["vehicles-lookup-mobile-inspections"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vehicles")
                .select("id, fleet_number, registration_number");
            if (error) throw error;
            return data || [];
        },
    });

    const vehicleMap = useMemo(
        () => new Map(vehicles.map((v) => [v.id, v])),
        [vehicles]
    );

    // Fetch inspection items for detail view
    const { data: detailItems = [] } = useQuery<InspectionItem[]>({
        queryKey: ["inspection-items-detail", detailInspection?.id],
        queryFn: async () => {
            if (!detailInspection) return [];
            const { data, error } = await supabase
                .from("inspection_items")
                .select("id, inspection_id, item_name, category, status, notes")
                .eq("inspection_id", detailInspection.id)
                .eq("category", "tyre");
            if (error) throw error;
            return data || [];
        },
        enabled: !!detailInspection,
    });

    // Filter and sort
    const filteredInspections = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const result = inspections.filter((insp) => {
            if (statusFilter === "faults" && !insp.has_fault) return false;
            if (statusFilter === "passed" && insp.has_fault) return false;
            if (!term) return true;
            const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;
            return (
                insp.inspection_number?.toLowerCase().includes(term) ||
                insp.vehicle_registration?.toLowerCase().includes(term) ||
                insp.inspector_name?.toLowerCase().includes(term) ||
                vehicle?.fleet_number?.toLowerCase().includes(term) ||
                vehicle?.registration_number?.toLowerCase().includes(term)
            );
        });

        result.sort((a, b) => {
            if (sortField === "date") {
                const cmp = new Date(a.inspection_date).getTime() - new Date(b.inspection_date).getTime();
                return sortAsc ? cmp : -cmp;
            }
            const aReg = a.vehicle_registration || "";
            const bReg = b.vehicle_registration || "";
            const cmp = aReg.localeCompare(bReg);
            return sortAsc ? cmp : -cmp;
        });

        return result;
    }, [inspections, searchTerm, statusFilter, sortField, sortAsc, vehicleMap]);

    const faultCount = inspections.filter((i) => i.has_fault).length;
    const passedCount = inspections.filter((i) => !i.has_fault).length;

    const handleSort = (field: "date" | "vehicle") => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const SortIcon = ({ field }: { field: "date" | "vehicle" }) => {
        if (sortField !== field) return null;
        return sortAsc ? (
            <ChevronUp className="h-3 w-3 inline ml-1" />
        ) : (
            <ChevronDown className="h-3 w-3 inline ml-1" />
        );
    };

    const handleExportPDF = async (insp: MobileInspection) => {
        try {
            const { data: items } = await supabase
                .from("inspection_items")
                .select("item_name, category, status, notes")
                .eq("inspection_id", insp.id)
                .eq("category", "tyre");

            const vehicle = insp.vehicle_id ? vehicleMap.get(insp.vehicle_id) : null;

            const positions = (items || []).map((item) => {
                const notesParts: Record<string, string> = {};
                (item.notes || "").split(" | ").forEach((part) => {
                    const [key, ...rest] = part.split(": ");
                    if (key && rest.length) notesParts[key.trim()] = rest.join(": ").trim();
                });

                const posLabel = item.item_name?.replace("Tyre - ", "") || "-";
                const posCode = posLabel.split(" - ")[0]?.trim() || posLabel;

                return {
                    position: posCode,
                    positionLabel: posLabel,
                    brand: notesParts["Brand"] || "",
                    size: notesParts["Size"] || "",
                    dotCode: notesParts["DOT"] || notesParts["Serial"] || "",
                    treadDepth: notesParts["Tread"]?.replace("mm", "").trim() || "",
                    pressure: notesParts["Pressure"]?.replace(" PSI", "") || "",
                    condition: notesParts["Condition"] || "",
                    wearPattern: notesParts["Wear"] || "",
                    kmTravelled: notesParts["KM"] ? parseInt(notesParts["KM"]) : null,
                    installationKm: null,
                    purchaseCost: null,
                    initialTreadDepth: notesParts["InitialTread"]
                        ? parseFloat(notesParts["InitialTread"])
                        : null,
                    treadWorn: null,
                    wearRate: null,
                    costPerMm: null,
                    notes: item.notes || "",
                };
            });

            // Sort positions
            const positionOrder = (code: string): number => {
                if (code === "SP" || code === "SPARE") return 9999;
                const match = code.match(/^V?(\d+)/i);
                return match ? parseInt(match[1], 10) : 5000;
            };
            positions.sort((a, b) => positionOrder(a.position) - positionOrder(b.position));

            generateTyreInspectionPDF({
                inspectionNumber: insp.inspection_number,
                inspectionDate: insp.inspection_date,
                vehicleRegistration:
                    insp.vehicle_registration || vehicle?.registration_number || "-",
                fleetNumber: vehicle?.fleet_number || null,
                inspectorName: insp.inspector_name || "-",
                odometerReading: insp.odometer_reading,
                status: insp.status || "completed",
                hasFault: insp.has_fault || false,
                positions,
            });

            toast({
                title: "PDF exported",
                description: "Mobile tyre inspection report downloaded",
            });
        } catch {
            toast({
                title: "Error",
                description: "Failed to export PDF",
                variant: "destructive",
            });
        }
    };

    // Parse notes for detail dialog
    const parseNotes = (notes: string | null) => {
        const parts: Record<string, string> = {};
        (notes || "").split(" | ").forEach((part) => {
            const [key, ...rest] = part.split(": ");
            if (key && rest.length) parts[key.trim()] = rest.join(": ").trim();
        });
        return parts;
    };

    return (
        <Card className="shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
                            <Smartphone className="h-6 w-6 text-blue-600" />
                            Mobile Tyre Inspections
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground mt-1">
                            Tyre inspections completed via the mobile app
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className="text-sm px-3 py-1.5 border-emerald-300 text-emerald-700"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            {passedCount} Passed
                        </Badge>
                        <Badge
                            variant="outline"
                            className="text-sm px-3 py-1.5 border-red-300 text-red-700"
                        >
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            {faultCount} Faults
                        </Badge>
                        <Badge className="text-sm px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg rounded-full">
                            {inspections.length} Total
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by vehicle, inspector, or number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="passed">Passed</SelectItem>
                            <SelectItem value="faults">Faults Only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Loading inspections...
                    </div>
                ) : filteredInspections.length === 0 ? (
                    <div className="text-center py-12">
                        <Smartphone className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="font-semibold text-muted-foreground">
                            No mobile tyre inspections found
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Inspections recorded on the mobile app will appear here
                        </p>
                    </div>
                ) : (
                    <div className="border rounded-xl overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead
                                        className="cursor-pointer select-none"
                                        onClick={() => handleSort("date")}
                                    >
                                        Date
                                        <SortIcon field="date" />
                                    </TableHead>
                                    <TableHead>Inspection #</TableHead>
                                    <TableHead
                                        className="cursor-pointer select-none"
                                        onClick={() => handleSort("vehicle")}
                                    >
                                        Vehicle
                                        <SortIcon field="vehicle" />
                                    </TableHead>
                                    <TableHead>Fleet</TableHead>
                                    <TableHead>Inspector</TableHead>
                                    <TableHead className="text-right">Odometer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInspections.map((insp) => {
                                    const vehicle = insp.vehicle_id
                                        ? vehicleMap.get(insp.vehicle_id)
                                        : null;
                                    return (
                                        <TableRow key={insp.id} className="hover:bg-muted/30">
                                            <TableCell className="text-sm">
                                                {format(
                                                    new Date(insp.inspection_date),
                                                    "dd MMM yyyy"
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {insp.inspection_number}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {vehicle?.registration_number ||
                                                    insp.vehicle_registration ||
                                                    "-"}
                                            </TableCell>
                                            <TableCell>
                                                {vehicle?.fleet_number ? (
                                                    <Badge variant="outline" className="text-xs">
                                                        {vehicle.fleet_number}
                                                    </Badge>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {insp.inspector_name || "-"}
                                            </TableCell>
                                            <TableCell className="text-right text-sm tabular-nums">
                                                {insp.odometer_reading
                                                    ? insp.odometer_reading.toLocaleString()
                                                    : "-"}
                                            </TableCell>
                                            <TableCell>
                                                {insp.has_fault ? (
                                                    <Badge
                                                        variant="destructive"
                                                        className="text-xs px-2 py-0.5"
                                                    >
                                                        Fault
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 border-emerald-200">
                                                        Passed
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => setDetailInspection(insp)}
                                                        title="View details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => handleExportPDF(insp)}
                                                        title="Export PDF"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            {/* Detail Dialog */}
            <Dialog
                open={!!detailInspection}
                onOpenChange={(open) => !open && setDetailInspection(null)}
            >
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-blue-600" />
                            {detailInspection?.inspection_number}
                        </DialogTitle>
                        <DialogDescription>
                            {detailInspection &&
                                format(
                                    new Date(detailInspection.inspection_date),
                                    "dd MMMM yyyy"
                                )}{" "}
                            &middot; {detailInspection?.inspector_name || "Unknown inspector"}
                            {detailInspection?.vehicle_registration &&
                                ` · ${detailInspection.vehicle_registration}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-muted/40 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground">Vehicle</p>
                                <p className="font-semibold text-sm">
                                    {detailInspection?.vehicle_registration || "-"}
                                </p>
                            </div>
                            <div className="bg-muted/40 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground">Fleet</p>
                                <p className="font-semibold text-sm">
                                    {detailInspection?.vehicle_id
                                        ? vehicleMap.get(detailInspection.vehicle_id)?.fleet_number ||
                                        "-"
                                        : "-"}
                                </p>
                            </div>
                            <div className="bg-muted/40 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground">Odometer</p>
                                <p className="font-semibold text-sm">
                                    {detailInspection?.odometer_reading
                                        ? `${detailInspection.odometer_reading.toLocaleString()} km`
                                        : "-"}
                                </p>
                            </div>
                            <div className="bg-muted/40 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground">Result</p>
                                <p className="font-semibold text-sm">
                                    {detailInspection?.has_fault ? (
                                        <span className="text-red-600">Faults Found</span>
                                    ) : (
                                        <span className="text-emerald-600">Passed</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Tyre Details Table */}
                        {detailItems.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Position</TableHead>
                                            <TableHead>Brand</TableHead>
                                            <TableHead>Size</TableHead>
                                            <TableHead>Tread</TableHead>
                                            <TableHead>Pressure</TableHead>
                                            <TableHead>Condition</TableHead>
                                            <TableHead>Wear Pattern</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detailItems
                                            .sort((a, b) => {
                                                const posA = a.item_name?.replace("Tyre - ", "").split(" - ")[0] || "";
                                                const posB = b.item_name?.replace("Tyre - ", "").split(" - ")[0] || "";
                                                const orderA = posA === "SP" ? 9999 : parseInt(posA.replace(/\D/g, "") || "5000");
                                                const orderB = posB === "SP" ? 9999 : parseInt(posB.replace(/\D/g, "") || "5000");
                                                return orderA - orderB;
                                            })
                                            .map((item) => {
                                                const parts = parseNotes(item.notes);
                                                const posLabel =
                                                    item.item_name?.replace("Tyre - ", "") || "-";
                                                return (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="font-medium text-sm">
                                                            {posLabel}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {parts["Brand"] || "-"}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {parts["Size"] || "-"}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {parts["Tread"] || "-"}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {parts["Pressure"] || "-"}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {parts["Condition"] || "-"}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {parts["Wear"] || "-"}
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.status === "fail" ? (
                                                                <Badge
                                                                    variant="destructive"
                                                                    className="text-xs"
                                                                >
                                                                    Fail
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                                                                    Pass
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

export default MobileTyreInspections;
