import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddTyreJobCardDialog from "@/components/dialogs/AddTyreJobCardDialog";
import WorkerDashboardDialog from "@/components/jobCards/WorkerDashboardDialog";
import { supabase } from "@/integrations/supabase/client";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { useQuery } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    Archive as ArchiveIcon,
    Calendar,
    ChevronDown,
    Download,
    Eye,
    FileText,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Share2,
    Trash2,
    Truck,
    User,
    Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    archived_at?: string | null;
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
    onJobCardClick?: (jobCard: TyreJobCard, editMode?: boolean) => void;
}

export default function TyreJobCardsTab({ onJobCardClick }: TyreJobCardsTabProps) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPriority, setSelectedPriority] = useState<string>("all");
    const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
    const [closedActiveFleets, setClosedActiveFleets] = useState<Set<string>>(new Set());
    const [closedCompletedFleets, setClosedCompletedFleets] = useState<Set<string>>(new Set());
    const [closedArchivedFleets, setClosedArchivedFleets] = useState<Set<string>>(new Set());
    const [workerDashboardJob, setWorkerDashboardJob] = useState<TyreJobCard | null>(null);
    const [workerDashboardOpen, setWorkerDashboardOpen] = useState(false);
    const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
    const [jobToArchive, setJobToArchive] = useState<TyreJobCard | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState<TyreJobCard | null>(null);

    // Fetch tyre job cards (linked to tyre inspections)
    const { data: tyreJobCards = [], isLoading, refetch } = useQuery({
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

            // Batch the IN query to avoid Supabase URL-length limits when there are many inspections.
            const BATCH_SIZE = 100;
            const batches: string[][] = [];
            for (let i = 0; i < tyreInspectionIds.length; i += BATCH_SIZE) {
                batches.push(tyreInspectionIds.slice(i, i + BATCH_SIZE));
            }

            const batchResults = await Promise.all(
                batches.map(batch =>
                    supabase
                        .from("job_cards")
                        .select("*")
                        .in("inspection_id", batch)
                        .order("created_at", { ascending: false })
                )
            );

            const firstError = batchResults.find(r => r.error)?.error;
            if (firstError) throw firstError;

            const cards = batchResults.flatMap(r => r.data || []);
            if (cards.length === 0) return [];

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

    // Always start with all fleet sections collapsed when the tab mounts or
    // when the underlying data refreshes. Manual expansions persist only
    // until the next data refresh / tab visit.
    // Use a stable signature (count + id list) as the dep so we don't re-run
    // on every render (the default `= []` would otherwise create a new array
    // reference each render and cause an infinite loop).
    const tyreJobCardsSignature = tyreJobCards.length === 0
        ? ""
        : `${tyreJobCards.length}:${tyreJobCards.map(c => `${c.id}|${c.status}|${c.archived_at ?? ""}`).join(",")}`;

    useEffect(() => {
        const collectFleetKeys = (cards: TyreJobCard[]) => {
            const keys = new Set<string>();
            cards.forEach((c) => keys.add(c.vehicle?.fleet_number || "__no_fleet__"));
            return keys;
        };

        const nonArchived = tyreJobCards.filter((c) => !c.archived_at);
        const archived = tyreJobCards.filter((c) => !!c.archived_at);
        const active = nonArchived.filter((c) => {
            const s = c.status?.toLowerCase();
            return s === "pending" || s === "in_progress" || s === "in progress";
        });
        const completed = nonArchived.filter((c) => c.status?.toLowerCase() === "completed");

        setClosedActiveFleets(collectFleetKeys(active));
        setClosedCompletedFleets(collectFleetKeys(completed));
        setClosedArchivedFleets(collectFleetKeys(archived));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tyreJobCardsSignature]);

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

    // Exclude archived cards from active/completed
    const nonArchived = filteredCards.filter(c => !c.archived_at);
    const archivedCards = filteredCards.filter(c => !!c.archived_at);

    const activeCards = nonArchived.filter(card => {
        const status = card.status?.toLowerCase();
        return status === "pending" || status === "in_progress" || status === "in progress";
    });

    const completedCards = nonArchived.filter(card => card.status?.toLowerCase() === "completed");

    // Action handlers
    const handleView = (card: TyreJobCard) => onJobCardClick?.(card, false);
    const handleUpdate = (card: TyreJobCard) => onJobCardClick?.(card, true);
    const handleWorkerDashboard = (card: TyreJobCard) => {
        setWorkerDashboardJob(card);
        setWorkerDashboardOpen(true);
    };
    const handleShare = (card: TyreJobCard) => {
        navigate(`/job-card/${card.id}?share=1`);
    };
    const handleArchiveClick = (card: TyreJobCard) => {
        setJobToArchive(card);
        setArchiveDialogOpen(true);
    };
    const handleDeleteClick = (card: TyreJobCard) => {
        setJobToDelete(card);
        setDeleteDialogOpen(true);
    };

    const handleArchiveConfirm = async () => {
        if (!jobToArchive) return;
        const isCurrentlyArchived = !!jobToArchive.archived_at;
        try {
            const { error } = await supabase
                .from("job_cards")
                .update({ archived_at: isCurrentlyArchived ? null : new Date().toISOString() } as never)
                .eq("id", jobToArchive.id);
            if (error) throw error;
            toast.success(isCurrentlyArchived
                ? `Job card #${jobToArchive.job_number} restored`
                : `Job card #${jobToArchive.job_number} archived`);
            requestGoogleSheetsSync('workshop');
            refetch();
        } catch (e) {
            console.error(e);
            toast.error("Failed to update archive status");
        } finally {
            setArchiveDialogOpen(false);
            setJobToArchive(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!jobToDelete) return;
        try {
            const { error } = await supabase.from("job_cards").delete().eq("id", jobToDelete.id);
            if (error) throw error;
            toast.success(`Job card #${jobToDelete.job_number} deleted`);
            requestGoogleSheetsSync('workshop');
            refetch();
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete job card");
        } finally {
            setDeleteDialogOpen(false);
            setJobToDelete(null);
        }
    };

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

    const toggleArchivedFleet = (fleet: string) => {
        setClosedArchivedFleets(prev => {
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

    const JobCardTable = ({ cards, isArchived = false }: { cards: TyreJobCard[]; isArchived?: boolean }) => (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="h-9 px-3 py-2 text-xs w-[90px]">Job #</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs">Title</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs">Fleet / Vehicle</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs">Status</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs">Priority</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs">Assignee</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs">Due</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs">Inspection</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-xs w-[60px] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cards.map((card) => (
                        <TableRow
                            key={card.id}
                            className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                            onClick={() => onJobCardClick?.(card, false)}
                        >
                            <TableCell className="px-3 py-2 font-mono text-xs">#{card.job_number}</TableCell>
                            <TableCell className="px-3 py-2 max-w-[260px]">
                                <p className="font-medium text-sm leading-tight truncate">{card.title}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                    Created {new Date(card.created_at).toLocaleDateString()}
                                </p>
                            </TableCell>
                            <TableCell className="px-3 py-2">
                                {card.vehicle ? (
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                                        {card.vehicle.fleet_number && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">{card.vehicle.fleet_number}</Badge>
                                        )}
                                        <span className="text-[10px] text-muted-foreground truncate">{card.vehicle.registration_number}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                )}
                            </TableCell>
                            <TableCell className="px-3 py-2">{getStatusBadge(card.status)}</TableCell>
                            <TableCell className="px-3 py-2">{getPriorityBadge(card.priority)}</TableCell>
                            <TableCell className="px-3 py-2">
                                {card.assignee ? (
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="truncate max-w-[120px]">{card.assignee}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                )}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                                {card.due_date ? (
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span>{new Date(card.due_date).toLocaleDateString()}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                )}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                                {card.inspection ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 leading-none bg-amber-50 text-amber-700 border-amber-200">
                                        <FileText className="h-2.5 w-2.5 mr-1" />
                                        {card.inspection.inspection_number}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground text-[10px]">—</span>
                                )}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Actions</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenuItem onClick={() => handleWorkerDashboard(card)}>
                                            <Users className="h-4 w-4 mr-2" />Worker Dashboard
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleView(card)}>
                                            <Eye className="h-4 w-4 mr-2" />View
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleUpdate(card)}>
                                            <Pencil className="h-4 w-4 mr-2" />Update
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleShare(card)}>
                                            <Share2 className="h-4 w-4 mr-2" />Share
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleArchiveClick(card)}>
                                            <ArchiveIcon className="h-4 w-4 mr-2" />
                                            {isArchived ? "Restore" : "Archive"}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                            onClick={() => handleDeleteClick(card)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />Delete Job Card
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {cards.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
        isArchived = false,
    }: {
        fleetLabel: string;
        cards: TyreJobCard[];
        isOpen: boolean;
        onToggle: () => void;
        statusVariant: "active" | "completed";
        isArchived?: boolean;
    }) => (
        <div className="border border-border/70 rounded-md overflow-hidden bg-background">
            <button
                type="button"
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-150 bg-muted/30 hover:bg-muted/60 border-l-2 ${statusVariant === "active" ? "border-l-foreground/70" : "border-l-border"}`}
                onClick={onToggle}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-none truncate">{fleetLabel}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {cards.length} {cards.length === 1 ? "tyre job card" : "tyre job cards"}
                        </p>
                    </div>
                    <Badge variant="outline" className="ml-1 text-[10px] font-semibold px-1.5 py-0 h-5 leading-none tabular-nums">
                        {cards.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-[11px] hidden sm:inline select-none uppercase tracking-wide">{isOpen ? "Hide" : "Show"}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </button>
            {isOpen && (
                <div className="border-t border-border/60 bg-background">
                    <JobCardTable cards={cards} isArchived={isArchived} />
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
        <div className="space-y-6">
            {/* Refined toolbar: KPI chips + filters + actions */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                    {/* KPI chips */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 shadow-sm">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                            <span className="text-base font-semibold tabular-nums leading-none">{activeCards.length}</span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 shadow-sm">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                            <span className="text-base font-semibold tabular-nums leading-none">{completedCards.length}</span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Completed</span>
                        </div>
                    </div>

                    <div className="hidden sm:block h-5 w-px bg-border/70" />

                    {/* Filters inline */}
                    <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-[280px]">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search tyre job cards..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 pl-8 text-xs bg-background"
                        />
                    </div>

                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                        <SelectTrigger className="h-9 w-[130px] text-xs bg-background">
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
                            <SelectTrigger className="h-9 w-[140px] text-xs bg-background">
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

                    {/* Spacer to push actions right */}
                    <div className="flex-1" />

                    {/* Export + Add buttons */}
                    <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={exportToExcel} className="h-9 gap-1.5 text-xs px-3 bg-background">
                            <Download className="w-3.5 h-3.5" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToPDF} className="h-9 gap-1.5 text-xs px-3 bg-background">
                            <FileText className="w-3.5 h-3.5" />
                            PDF
                        </Button>
                        <Button size="sm" className="h-9 gap-1.5 text-xs px-3.5 shadow-sm" onClick={() => setShowAddDialog(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            New Tyre Job Card
                        </Button>
                    </div>
                </div>
            </div>

            {/* Active Tyre Job Cards */}
            <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    <h2 className="text-base font-semibold tracking-tight text-foreground">Active Tyre Job Cards</h2>
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
                        {activeCards.length}
                    </span>
                </div>
                {activeCards.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
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
            </section>

            {/* Completed Tyre Job Cards */}
            <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    <h2 className="text-base font-semibold tracking-tight text-foreground">Completed Tyre Job Cards</h2>
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
                        {completedCards.length}
                    </span>
                </div>
                {completedCards.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
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
            </section>

            {/* Archived Tyre Job Cards */}
            {archivedCards.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                        <h2 className="text-base font-semibold tracking-tight text-foreground">Archived Tyre Job Cards</h2>
                        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
                            {archivedCards.length}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {Array.from(groupByFleet(archivedCards).entries()).map(([fleetKey, cards]) => (
                            <FleetAccordionSection
                                key={`archived-${fleetKey}`}
                                fleetLabel={fleetKey === "__no_fleet__" ? "Unassigned — No Fleet" : `Fleet ${fleetKey}`}
                                cards={cards}
                                isOpen={!closedArchivedFleets.has(fleetKey)}
                                onToggle={() => toggleArchivedFleet(fleetKey)}
                                statusVariant="completed"
                                isArchived
                            />
                        ))}
                    </div>
                </section>
            )}

            <AddTyreJobCardDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

            <WorkerDashboardDialog
                open={workerDashboardOpen}
                onOpenChange={setWorkerDashboardOpen}
                jobCard={workerDashboardJob ? {
                    id: workerDashboardJob.id,
                    job_number: workerDashboardJob.job_number,
                    title: workerDashboardJob.title,
                    assignee: workerDashboardJob.assignee,
                    status: workerDashboardJob.status,
                } : null}
            />

            <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {jobToArchive?.archived_at ? "Restore tyre job card?" : "Archive tyre job card?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {jobToArchive?.archived_at
                                ? `Job card #${jobToArchive?.job_number} will be moved back into the active lists.`
                                : `Job card #${jobToArchive?.job_number} will be hidden from the active and completed lists. You can restore it from the Archived section.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveConfirm}>
                            {jobToArchive?.archived_at ? "Restore" : "Archive"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete tyre job card?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete job card #{jobToDelete?.job_number}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteConfirm}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
