import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AddTyreJobCardDialog from "@/components/dialogs/AddTyreJobCardDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    Calendar,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    Download,
    FileText,
    Plus,
    Search,
    Truck,
    User,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface TyreJobCard {
    id: string;
    job_number: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignee: string | null;
    due_date: string | null;
    created_at: string;
    vehicle?: {
        id: string;
        fleet_number: string | null;
        registration_number: string;
    } | null;
    inspection?: {
        id: string;
        inspection_number: string;
        inspection_type: string;
        inspection_date: string;
    } | null;
}

interface TyreJobCardsTabProps {
    onJobCardClick?: (jobCard: TyreJobCard) => void;
}

export default function TyreJobCardsTab({ onJobCardClick }: TyreJobCardsTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPriority, setSelectedPriority] = useState<string>("all");
    const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
    const [closedActiveFleets, setClosedActiveFleets] = useState<Set<string>>(new Set());
    const [closedCompletedFleets, setClosedCompletedFleets] = useState<Set<string>>(new Set());

    // Fetch tyre job cards (linked to tyre inspections)
    const { data: tyreJobCards = [], isLoading } = useQuery({
        queryKey: ["tyre_job_cards"],
        queryFn: async () => {
            // First get all tyre inspection IDs
            const { data: tyreInspections, error: inspError } = await supabase
                .from("vehicle_inspections")
                .select("id")
                .eq("inspection_type", "tyre");

            if (inspError) throw inspError;

            const tyreInspectionIds = (tyreInspections || []).map(i => i.id);
            if (tyreInspectionIds.length === 0) return [];

            // Fetch job cards linked to tyre inspections
            const { data: cards, error: cardsError } = await supabase
                .from("job_cards")
                .select("*")
                .in("inspection_id", tyreInspectionIds)
                .order("created_at", { ascending: false });

            if (cardsError) throw cardsError;
            if (!cards || cards.length === 0) return [];

            // Fetch related data
            const vehicleIds = [...new Set(cards.map(c => c.vehicle_id).filter(Boolean))] as string[];
            const inspectionIds = [...new Set(cards.map(c => c.inspection_id).filter(Boolean))] as string[];

            const [vehiclesRes, inspectionsRes] = await Promise.all([
                vehicleIds.length > 0
                    ? supabase.from("vehicles").select("id, fleet_number, registration_number").in("id", vehicleIds)
                    : { data: [], error: null },
                inspectionIds.length > 0
                    ? supabase.from("vehicle_inspections").select("id, inspection_number, inspection_type, inspection_date").in("id", inspectionIds)
                    : { data: [], error: null },
            ]);

            const vehicleMap = new Map((vehiclesRes.data || []).map(v => [v.id, v]));
            const inspectionMap = new Map((inspectionsRes.data || []).map(i => [i.id, i]));

            return cards.map(card => ({
                ...card,
                vehicle: card.vehicle_id ? vehicleMap.get(card.vehicle_id) || null : null,
                inspection: card.inspection_id ? inspectionMap.get(card.inspection_id) || null : null,
            })) as TyreJobCard[];
        },
    });

    // Get unique assignees
    const assignees = [...new Set(
        tyreJobCards
            .map(card => card.assignee)
            .filter((a): a is string => a !== null && a !== undefined && a !== "")
    )].sort();

    // Apply filters
    const filteredCards = tyreJobCards.filter((card) => {
        if (searchTerm && !card.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !card.job_number.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        if (selectedPriority !== "all" && card.priority !== selectedPriority) return false;
        if (selectedAssignee !== "all" && card.assignee !== selectedAssignee) return false;
        return true;
    });

    const activeCards = filteredCards.filter(card => {
        const status = card.status?.toLowerCase();
        return status === "pending" || status === "in_progress" || status === "in progress";
    });

    const completedCards = filteredCards.filter(card => card.status?.toLowerCase() === "completed");

    // Export to Excel
    const exportToExcel = useCallback(async () => {
        try {
            const wb = new ExcelJS.Workbook();
            wb.creator = "Car Craft Co Fleet Management";
            wb.created = new Date();

            const hFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "1F3864" } };
            const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFF" }, size: 10, name: "Calibri" };
            const hAlign: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "center", wrapText: true };
            const bdr: Partial<ExcelJS.Borders> = {
                top: { style: "thin", color: { argb: "D9D9D9" } },
                bottom: { style: "thin", color: { argb: "D9D9D9" } },
                left: { style: "thin", color: { argb: "D9D9D9" } },
                right: { style: "thin", color: { argb: "D9D9D9" } },
            };
            const zFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F6FC" } };
            const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: "Calibri" };

            const styleHeader = (ws: ExcelJS.Worksheet, rowNum: number) => {
                const r = ws.getRow(rowNum);
                r.eachCell(c => { c.fill = hFill; c.font = hFont; c.alignment = hAlign; c.border = bdr; });
                r.height = 28;
            };

            const autoWidth = (ws: ExcelJS.Worksheet) => {
                ws.columns.forEach(col => {
                    let m = 12;
                    col.eachCell?.({ includeEmpty: false }, c => {
                        const l = c.value ? String(c.value).length + 2 : 0;
                        if (l > m) m = l;
                    });
                    col.width = Math.min(m, 40);
                });
            };

            const ws = wb.addWorksheet("Tyre Job Cards");

            ws.mergeCells("A1:J1");
            const tc = ws.getCell("A1");
            tc.value = "TYRE JOB CARDS REPORT";
            tc.font = { bold: true, size: 16, color: { argb: "1F3864" }, name: "Calibri" };
            ws.getRow(1).height = 32;

            ws.mergeCells("A2:J2");
            const sc = ws.getCell("A2");
            sc.value = `Generated: ${new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" })} \u2022 Car Craft Co Fleet Management`;
            sc.font = { italic: true, size: 9, color: { argb: "666666" }, name: "Calibri" };

            const headers = ["Job #", "Title", "Fleet #", "Registration", "Status", "Priority", "Assignee", "Due Date", "Created", "Inspection #"];
            ws.getRow(4).values = headers;
            styleHeader(ws, 4);

            const allCards = [...activeCards, ...completedCards];
            allCards.forEach((card, i) => {
                const row = ws.getRow(i + 5);
                row.values = [
                    card.job_number,
                    card.title,
                    card.vehicle?.fleet_number || "",
                    card.vehicle?.registration_number || "",
                    card.status,
                    card.priority,
                    card.assignee || "",
                    card.due_date ? new Date(card.due_date).toLocaleDateString("en-ZA") : "",
                    card.created_at ? new Date(card.created_at).toLocaleDateString("en-ZA") : "",
                    card.inspection?.inspection_number || "",
                ];
                row.eachCell(c => { c.border = bdr; c.font = bodyFont; c.alignment = { vertical: "middle" }; });
                if (i % 2 === 1) row.eachCell(c => { c.fill = zFill; });

                const statusCell = row.getCell(5);
                const status = card.status?.toLowerCase();
                if (status === "completed") statusCell.font = { ...bodyFont, color: { argb: "16A34A" }, bold: true };
                else if (status === "in_progress" || status === "in progress") statusCell.font = { ...bodyFont, color: { argb: "2563EB" }, bold: true };
                else if (status === "pending") statusCell.font = { ...bodyFont, color: { argb: "D97706" }, bold: true };

                const prioCell = row.getCell(6);
                if (card.priority === "critical") prioCell.font = { ...bodyFont, color: { argb: "DC2626" }, bold: true };
                else if (card.priority === "high") prioCell.font = { ...bodyFont, color: { argb: "EA580C" }, bold: true };
            });

            ws.autoFilter = { from: "A4", to: `J${allCards.length + 4}` };
            ws.views = [{ state: "frozen", ySplit: 4 }];
            autoWidth(ws);

            // Summary sheet
            const sWs = wb.addWorksheet("Summary");
            sWs.mergeCells("A1:B1");
            sWs.getCell("A1").value = "TYRE JOB CARDS SUMMARY";
            sWs.getCell("A1").font = { bold: true, size: 16, color: { argb: "1F3864" }, name: "Calibri" };
            sWs.getRow(1).height = 32;

            sWs.getRow(3).values = ["Metric", "Count"];
            styleHeader(sWs, 3);

            const summaryRows: [string, number][] = [
                ["Total Tyre Job Cards", allCards.length],
                ["Active (Pending + In Progress)", activeCards.length],
                ["Completed", completedCards.length],
                ["Urgent Priority", allCards.filter(c => c.priority === "urgent").length],
                ["High Priority", allCards.filter(c => c.priority === "high").length],
                ["Medium Priority", allCards.filter(c => c.priority === "medium").length],
                ["Low Priority", allCards.filter(c => c.priority === "low").length],
            ];

            summaryRows.forEach((r, i) => {
                const row = sWs.getRow(4 + i);
                row.values = [r[0], r[1]];
                row.getCell(1).font = { bold: true, size: 10, name: "Calibri" };
                row.getCell(2).font = { size: 10, name: "Calibri" };
                row.eachCell(c => { c.border = bdr; });
                if (i % 2 === 1) row.eachCell(c => { c.fill = zFill; });
            });
            sWs.getColumn(1).width = 30;
            sWs.getColumn(2).width = 15;

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Tyre_Job_Cards_${new Date().toISOString().split("T")[0]}.xlsx`);
            toast.success(`${allCards.length} tyre job cards exported to Excel.`);
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Unable to export tyre job cards.");
        }
    }, [activeCards, completedCards]);

    // Export to PDF
    const exportToPDF = useCallback(() => {
        try {
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const pageWidth = doc.internal.pageSize.getWidth();

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("Tyre Job Cards Report", 14, 18);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const allCards = [...activeCards, ...completedCards];
            doc.text(
                `Generated: ${new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" })} | Total: ${allCards.length} | Active: ${activeCards.length} | Completed: ${completedCards.length}`,
                14, 25
            );

            autoTable(doc, {
                startY: 32,
                head: [["Job #", "Title", "Fleet", "Reg #", "Status", "Priority", "Assignee", "Due Date", "Inspection"]],
                body: allCards.map(card => [
                    card.job_number,
                    card.title.length > 35 ? card.title.substring(0, 35) + "..." : card.title,
                    card.vehicle?.fleet_number || "-",
                    card.vehicle?.registration_number || "-",
                    card.status,
                    card.priority,
                    card.assignee || "-",
                    card.due_date ? new Date(card.due_date).toLocaleDateString("en-ZA") : "-",
                    card.inspection?.inspection_number || "-",
                ]),
                theme: "striped",
                headStyles: { fillColor: [31, 56, 100], fontSize: 8, font: "helvetica" },
                bodyStyles: { fontSize: 7 },
                margin: { left: 14, right: 14 },
                styles: { overflow: "linebreak", cellWidth: "wrap" },
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 50 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 26 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 18 },
                    6: { cellWidth: 28 },
                    7: { cellWidth: 22 },
                    8: { cellWidth: 25 },
                },
            });

            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text(`Page ${i} of ${pageCount} | Car Craft Co Fleet Management`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
            }

            doc.save(`Tyre_Job_Cards_${new Date().toISOString().split("T")[0]}.pdf`);
            toast.success(`${allCards.length} tyre job cards exported as PDF.`);
        } catch (error) {
            console.error("PDF export failed:", error);
            toast.error("Unable to generate PDF.");
        }
    }, [activeCards, completedCards]);

    // Group cards by fleet number
    const groupByFleet = (cards: TyreJobCard[]) => {
        const map = new Map<string, TyreJobCard[]>();
        const sorted = [...cards].sort((a, b) => {
            const aNum = parseInt(a.vehicle?.fleet_number?.match(/\d+/)?.[0] || "999999");
            const bNum = parseInt(b.vehicle?.fleet_number?.match(/\d+/)?.[0] || "999999");
            return aNum - bNum;
        });

        sorted.forEach(card => {
            const key = card.vehicle?.fleet_number || "__no_fleet__";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(card);
        });

        return map;
    };

    const toggleActiveFleet = (fleet: string) => {
        setClosedActiveFleets(prev => {
            const next = new Set(prev);
            if (next.has(fleet)) next.delete(fleet); else next.add(fleet);
            return next;
        });
    };

    const toggleCompletedFleet = (fleet: string) => {
        setClosedCompletedFleets(prev => {
            const next = new Set(prev);
            if (next.has(fleet)) next.delete(fleet); else next.add(fleet);
            return next;
        });
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case "urgent": return <Badge variant="destructive">Urgent</Badge>;
            case "high": return <Badge variant="destructive">High</Badge>;
            case "medium": return <Badge>Medium</Badge>;
            case "low": return <Badge variant="secondary">Low</Badge>;
            default: return <Badge variant="secondary">{priority}</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase();
        switch (s) {
            case "pending": return <Badge variant="secondary">Pending</Badge>;
            case "in_progress": case "in progress": return <Badge className="bg-blue-500">In Progress</Badge>;
            case "completed": return <Badge className="bg-green-500">Completed</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const JobCardTable = ({ cards }: { cards: TyreJobCard[] }) => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Job #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Fleet / Vehicle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Inspection</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cards.map((card) => (
                        <TableRow
                            key={card.id}
                            className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                            onClick={() => onJobCardClick?.(card)}
                        >
                            <TableCell className="font-mono text-sm">#{card.job_number}</TableCell>
                            <TableCell className="max-w-[280px]">
                                <div className="space-y-1">
                                    <p className="font-medium leading-tight truncate">{card.title}</p>
                                    <p className="text-xs text-muted-foreground">Created {new Date(card.created_at).toLocaleDateString()}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                {card.vehicle ? (
                                    <div className="flex items-center gap-2">
                                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            {card.vehicle.fleet_number && (
                                                <Badge variant="outline" className="text-xs w-fit">{card.vehicle.fleet_number}</Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground">{card.vehicle.registration_number}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">—</span>
                                )}
                            </TableCell>
                            <TableCell>{getStatusBadge(card.status)}</TableCell>
                            <TableCell>{getPriorityBadge(card.priority)}</TableCell>
                            <TableCell>
                                {card.assignee ? (
                                    <div className="flex items-center gap-2">
                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-sm">{card.assignee}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">—</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {card.due_date ? (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-sm">{new Date(card.due_date).toLocaleDateString()}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">—</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {card.inspection ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        <FileText className="h-3 w-3 mr-1" />
                                        {card.inspection.inspection_number}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground text-sm">No inspection</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {cards.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No tyre job cards found
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );

    const FleetAccordionSection = ({
        fleetLabel,
        cards,
        isOpen,
        onToggle,
        statusVariant,
    }: {
        fleetLabel: string;
        cards: TyreJobCard[];
        isOpen: boolean;
        onToggle: () => void;
        statusVariant: "active" | "completed";
    }) => (
        <div className="border border-border rounded-xl overflow-hidden transition-shadow duration-200 shadow-sm hover:shadow-md">
            <button
                type="button"
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-150 ${statusVariant === "active"
                    ? "bg-gradient-to-r from-amber-50/80 to-yellow-50/60 hover:from-amber-100/80 hover:to-yellow-100/60 dark:from-amber-950/20 dark:to-yellow-950/20"
                    : "bg-gradient-to-r from-emerald-50/80 to-green-50/60 hover:from-emerald-100/80 hover:to-green-100/60 dark:from-emerald-950/20 dark:to-green-950/20"
                    }`}
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${statusVariant === "active" ? "bg-amber-100 dark:bg-amber-900/50" : "bg-emerald-100 dark:bg-emerald-900/50"
                        }`}>
                        <Truck className={`h-4 w-4 ${statusVariant === "active" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                            }`} />
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-foreground leading-none">{fleetLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {cards.length} {cards.length === 1 ? "tyre job card" : "tyre job cards"}
                        </p>
                    </div>
                    <Badge className={`ml-1 text-xs font-semibold border ${statusVariant === "active"
                        ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400"
                        }`}>
                        {cards.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs hidden sm:inline select-none">{isOpen ? "Collapse" : "Expand"}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </button>
            {isOpen && (
                <div className="border-t border-border/60 bg-background">
                    <JobCardTable cards={cards} />
                </div>
            )}
        </div>
    );

    const [showAddDialog, setShowAddDialog] = useState(false);

    if (isLoading) {
        return (
            <div className="text-center text-muted-foreground py-8">
                Loading tyre job cards...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Compact toolbar: stats + filters + exports in one row */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {/* New Tyre Job Card button */}
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowAddDialog(true)}>
                        <Plus className="w-3.5 h-3.5" />
                        New Tyre Job Card
                    </Button>

                    <div className="hidden sm:block h-4 w-px bg-border" />

                    {/* Inline stats */}
                    <div className="flex items-center gap-1.5 text-sm">
                        <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
                        <span className="font-semibold">{activeCards.length}</span>
                        <span className="text-muted-foreground text-xs">active</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span className="font-semibold">{completedCards.length}</span>
                        <span className="text-muted-foreground text-xs">completed</span>
                    </div>

                    <div className="hidden sm:block h-4 w-px bg-border" />

                    {/* Filters inline */}
                    <div className="relative flex-1 min-w-0 sm:min-w-[180px] sm:max-w-[260px]">
                        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-8 pl-7 text-xs"
                        />
                    </div>

                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>

                    {assignees.length > 0 && (
                        <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                            <SelectTrigger className="h-8 w-[130px] text-xs">
                                <SelectValue placeholder="Assignee" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Assignees</SelectItem>
                                {assignees.map((assignee) => (
                                    <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Spacer to push exports right */}
                    <div className="flex-1" />

                    {/* Export buttons */}
                    <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8 gap-1 text-xs px-2.5">
                            <Download className="w-3 h-3" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToPDF} className="h-8 gap-1 text-xs px-2.5">
                            <FileText className="w-3 h-3" />
                            PDF
                        </Button>
                    </div>
                </div>
            </div>

            {/* Active Tyre Job Cards */}
            <Card>
                <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm font-semibold">Active Tyre Job Cards</CardTitle>
                        <Badge className="bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 font-semibold text-[11px] px-1.5 py-0">
                            {activeCards.length}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                    {activeCards.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No active tyre job cards</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Array.from(groupByFleet(activeCards).entries()).map(([fleetKey, cards]) => (
                                <FleetAccordionSection
                                    key={`active-${fleetKey}`}
                                    fleetLabel={fleetKey === "__no_fleet__" ? "Unassigned — No Fleet" : `Fleet ${fleetKey}`}
                                    cards={cards}
                                    isOpen={!closedActiveFleets.has(fleetKey)}
                                    onToggle={() => toggleActiveFleet(fleetKey)}
                                    statusVariant="active"
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Completed Tyre Job Cards */}
            <Card>
                <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <CardTitle className="text-sm font-semibold">Completed Tyre Job Cards</CardTitle>
                        <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 font-semibold text-[11px] px-1.5 py-0">
                            {completedCards.length}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                    {completedCards.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No completed tyre job cards</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Array.from(groupByFleet(completedCards).entries()).map(([fleetKey, cards]) => (
                                <FleetAccordionSection
                                    key={`completed-${fleetKey}`}
                                    fleetLabel={fleetKey === "__no_fleet__" ? "Unassigned — No Fleet" : `Fleet ${fleetKey}`}
                                    cards={cards}
                                    isOpen={!closedCompletedFleets.has(fleetKey)}
                                    onToggle={() => toggleCompletedFleet(fleetKey)}
                                    statusVariant="completed"
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddTyreJobCardDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
        </div>
    );
}
