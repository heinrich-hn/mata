import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Calendar as CalendarIcon,
    Check,
    Clock,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    Pencil,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddOvertimeEntryDialog, {
    type OvertimeEntry,
} from "./AddOvertimeEntryDialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_BADGE: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

const LINK_LABEL: Record<string, string> = {
    job_card: "Job Card",
    breakdown: "Breakdown",
    incident: "Incident",
    other: "Other",
};

type OvertimeRow = OvertimeEntry & {
    job_card?: { id: string; job_number: string | null; title: string | null } | null;
    breakdown?: { id: string; source_breakdown_number: string | null; description: string | null } | null;
    incident?: { id: string; incident_number: string | null; description: string | null } | null;
};

export default function OvertimeApprovalTab() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<OvertimeEntry | null>(null);
    const [toDelete, setToDelete] = useState<OvertimeEntry | null>(null);
    const [toReject, setToReject] = useState<OvertimeEntry | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    const { data: entries = [], isLoading } = useQuery<OvertimeRow[]>({
        queryKey: ["overtime-entries"],
        queryFn: async () => {
            const { data, error } = await sb
                .from("overtime_entries")
                .select(
                    `*,
           job_card:job_card_id(id, job_number, title),
           breakdown:breakdown_id(id, source_breakdown_number, description),
           incident:incident_id(id, incident_number, description)`
                )
                .order("date", { ascending: false })
                .order("start_time", { ascending: false });
            if (error) throw error;
            return (data || []) as unknown as OvertimeRow[];
        },
    });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return entries.filter((e) => {
            if (statusFilter !== "all" && e.status !== statusFilter) return false;
            if (!q) return true;
            return (
                (e.inspector_name || "").toLowerCase().includes(q) ||
                (e.reason || "").toLowerCase().includes(q) ||
                (e.notes || "").toLowerCase().includes(q) ||
                (e.job_card?.job_number || "").toLowerCase().includes(q)
            );
        });
    }, [entries, search, statusFilter]);

    const stats = useMemo(() => {
        const pending = entries.filter((e) => e.status === "pending").length;
        const approved = entries.filter((e) => e.status === "approved").length;
        const rejected = entries.filter((e) => e.status === "rejected").length;
        const totalHours = entries
            .filter((e) => e.status === "approved")
            .reduce((s, e) => s + (Number(e.hours) || 0), 0);
        return { pending, approved, rejected, totalHours };
    }, [entries]);

    const updateStatusMutation = useMutation({
        mutationFn: async ({
            id,
            status,
            rejection_reason,
        }: {
            id: string;
            status: "approved" | "rejected" | "pending";
            rejection_reason?: string;
        }) => {
            const userResp = await supabase.auth.getUser();
            const userId = userResp.data.user?.id ?? null;
            const payload: Record<string, unknown> = { status };
            if (status === "approved" || status === "rejected") {
                payload.approved_by = userId;
                payload.approved_at = new Date().toISOString();
            } else {
                payload.approved_by = null;
                payload.approved_at = null;
            }
            if (status === "rejected") {
                payload.rejection_reason = rejection_reason || null;
            } else {
                payload.rejection_reason = null;
            }
            const { error } = await sb
                .from("overtime_entries")
                .update(payload)
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_d, vars) => {
            toast.success(
                vars.status === "approved"
                    ? "Entry approved"
                    : vars.status === "rejected"
                        ? "Entry rejected"
                        : "Status updated"
            );
            queryClient.invalidateQueries({ queryKey: ["overtime-entries"] });
            setToReject(null);
            setRejectionReason("");
        },
        onError: (err: Error) => toast.error(err.message || "Failed to update"),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await sb
                .from("overtime_entries")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Entry deleted");
            queryClient.invalidateQueries({ queryKey: ["overtime-entries"] });
            setToDelete(null);
        },
        onError: (err: Error) => toast.error(err.message || "Failed to delete"),
    });

    const renderLink = (e: OvertimeRow) => {
        if (e.entry_mode === "monthly") {
            return (
                <Badge variant="outline" className="text-xs">
                    Monthly total
                </Badge>
            );
        }
        if (e.link_type === "job_card" && e.job_card) {
            return (
                <span className="text-xs">
                    <Badge variant="outline" className="mr-1.5">
                        {LINK_LABEL[e.link_type]}
                    </Badge>
                    <span className="font-mono">{e.job_card.job_number || e.job_card.id.slice(0, 8)}</span>
                    {e.job_card.title && (
                        <span className="text-muted-foreground"> — {e.job_card.title}</span>
                    )}
                </span>
            );
        }
        if (e.link_type === "breakdown" && e.breakdown) {
            return (
                <span className="text-xs">
                    <Badge variant="outline" className="mr-1.5">
                        {LINK_LABEL[e.link_type]}
                    </Badge>
                    <span className="font-mono">
                        {e.breakdown.source_breakdown_number || e.breakdown.id.slice(0, 8)}
                    </span>
                    {e.breakdown.description && (
                        <span className="text-muted-foreground"> — {e.breakdown.description}</span>
                    )}
                </span>
            );
        }
        if (e.link_type === "incident" && e.incident) {
            return (
                <span className="text-xs">
                    <Badge variant="outline" className="mr-1.5">
                        {LINK_LABEL[e.link_type]}
                    </Badge>
                    <span className="font-mono">
                        {e.incident.incident_number || e.incident.id.slice(0, 8)}
                    </span>
                    {e.incident.description && (
                        <span className="text-muted-foreground"> — {e.incident.description}</span>
                    )}
                </span>
            );
        }
        return (
            <Badge variant="outline" className="text-xs">
                {LINK_LABEL[e.link_type] || e.link_type}
            </Badge>
        );
    };

    const groupByInspector = (rows: OvertimeRow[]) => {
        const map = new Map<string, { name: string; rows: OvertimeRow[] }>();
        for (const r of rows) {
            const key = r.inspector_id || r.inspector_name || "unknown";
            if (!map.has(key)) {
                map.set(key, { name: r.inspector_name || "Unknown", rows: [] });
            }
            map.get(key)!.rows.push(r);
        }
        return Array.from(map.values())
            .map((g) => {
                const totalHours = g.rows.reduce((s, e) => s + (Number(e.hours) || 0), 0);
                const approvedHours = g.rows
                    .filter((e) => e.status === "approved")
                    .reduce((s, e) => s + (Number(e.hours) || 0), 0);
                const pendingHours = g.rows
                    .filter((e) => e.status === "pending")
                    .reduce((s, e) => s + (Number(e.hours) || 0), 0);
                const rejectedHours = g.rows
                    .filter((e) => e.status === "rejected")
                    .reduce((s, e) => s + (Number(e.hours) || 0), 0);
                return {
                    ...g,
                    rows: [...g.rows].sort((a, b) =>
                        (a.date || "").localeCompare(b.date || "")
                    ),
                    totalHours,
                    approvedHours,
                    pendingHours,
                    rejectedHours,
                    entryCount: g.rows.length,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const formatPeriod = (e: OvertimeRow) =>
        e.entry_mode === "monthly"
            ? format(new Date(`${e.month || e.date.slice(0, 7)}-01`), "MMM yyyy")
            : format(new Date(e.date), "yyyy-MM-dd");

    const formatTime = (e: OvertimeRow) =>
        e.entry_mode === "monthly"
            ? "Monthly total"
            : `${e.start_time?.slice(0, 5) || ""} – ${e.end_time?.slice(0, 5) || ""}`;

    const formatLink = (e: OvertimeRow) => {
        if (e.entry_mode === "monthly") return "Monthly total";
        if (e.link_type === "job_card" && e.job_card) {
            return `Job Card · ${e.job_card.job_number || e.job_card.id.slice(0, 8)}${e.job_card.title ? " — " + e.job_card.title : ""
                }`;
        }
        if (e.link_type === "breakdown" && e.breakdown) {
            return `Breakdown · ${e.breakdown.source_breakdown_number || e.breakdown.id.slice(0, 8)}${e.breakdown.description ? " — " + e.breakdown.description : ""
                }`;
        }
        if (e.link_type === "incident" && e.incident) {
            return `Incident · ${e.incident.incident_number || e.incident.id.slice(0, 8)}${e.incident.description ? " — " + e.incident.description : ""
                }`;
        }
        return LINK_LABEL[e.link_type || ""] || "Other";
    };

    const exportFileBase = () =>
        `overtime-${new Date().toISOString().slice(0, 10)}${statusFilter !== "all" ? "-" + statusFilter : ""
        }`;

    const exportExcel = async () => {
        if (filtered.length === 0) {
            toast.error("Nothing to export");
            return;
        }
        const groups = groupByInspector(filtered);
        const wb = new ExcelJS.Workbook();
        wb.creator = "MATA Fleet";
        wb.created = new Date();

        // ---- Summary sheet ----
        const summary = wb.addWorksheet("Summary", {
            properties: { tabColor: { argb: "FF1E293B" } },
        });
        summary.mergeCells("A1:F1");
        const title = summary.getCell("A1");
        title.value = "Overtime Report";
        title.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
        title.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1E293B" },
        };
        title.alignment = { horizontal: "left", vertical: "middle" };
        summary.getRow(1).height = 28;

        summary.mergeCells("A2:F2");
        const subtitle = summary.getCell("A2");
        subtitle.value = `Generated ${format(new Date(), "yyyy-MM-dd HH:mm")} · Status: ${statusFilter === "all" ? "All" : statusFilter
            } · ${filtered.length} entries`;
        subtitle.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF64748B" } };

        // KPI block
        summary.getCell("A4").value = "Pending entries";
        summary.getCell("B4").value = stats.pending;
        summary.getCell("A5").value = "Approved entries";
        summary.getCell("B5").value = stats.approved;
        summary.getCell("A6").value = "Rejected entries";
        summary.getCell("B6").value = stats.rejected;
        summary.getCell("A7").value = "Approved hours";
        summary.getCell("B7").value = Number(stats.totalHours.toFixed(2));
        ["A4", "A5", "A6", "A7"].forEach((c) => {
            summary.getCell(c).font = { bold: true };
        });

        // Per-inspector summary table
        const headerRow = 9;
        summary.getCell(`A${headerRow}`).value = "Per Inspector Summary";
        summary.getCell(`A${headerRow}`).font = { bold: true, size: 12 };
        summary.mergeCells(`A${headerRow}:F${headerRow}`);

        const tableHeaderRow = headerRow + 1;
        const headers = ["Inspector", "Entries", "Pending hrs", "Approved hrs", "Rejected hrs", "Total hrs"];
        headers.forEach((h, i) => {
            const cell = summary.getCell(tableHeaderRow, i + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF334155" },
            };
            cell.alignment = { horizontal: i === 0 ? "left" : "right", vertical: "middle" };
            cell.border = {
                top: { style: "thin", color: { argb: "FFCBD5E1" } },
                bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            };
        });
        summary.getRow(tableHeaderRow).height = 20;

        groups.forEach((g, idx) => {
            const r = tableHeaderRow + 1 + idx;
            summary.getCell(r, 1).value = g.name;
            summary.getCell(r, 2).value = g.entryCount;
            summary.getCell(r, 3).value = Number(g.pendingHours.toFixed(2));
            summary.getCell(r, 4).value = Number(g.approvedHours.toFixed(2));
            summary.getCell(r, 5).value = Number(g.rejectedHours.toFixed(2));
            summary.getCell(r, 6).value = Number(g.totalHours.toFixed(2));
            for (let c = 1; c <= 6; c++) {
                const cell = summary.getCell(r, c);
                cell.alignment = { horizontal: c === 1 ? "left" : "right" };
                if (idx % 2 === 1) {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF8FAFC" },
                    };
                }
                if (c >= 3) cell.numFmt = "0.00";
            }
        });

        // Totals row
        const totalRow = tableHeaderRow + 1 + groups.length;
        summary.getCell(totalRow, 1).value = "TOTAL";
        summary.getCell(totalRow, 2).value = filtered.length;
        summary.getCell(totalRow, 3).value = Number(
            groups.reduce((s, g) => s + g.pendingHours, 0).toFixed(2)
        );
        summary.getCell(totalRow, 4).value = Number(
            groups.reduce((s, g) => s + g.approvedHours, 0).toFixed(2)
        );
        summary.getCell(totalRow, 5).value = Number(
            groups.reduce((s, g) => s + g.rejectedHours, 0).toFixed(2)
        );
        summary.getCell(totalRow, 6).value = Number(
            groups.reduce((s, g) => s + g.totalHours, 0).toFixed(2)
        );
        for (let c = 1; c <= 6; c++) {
            const cell = summary.getCell(totalRow, c);
            cell.font = { bold: true };
            cell.alignment = { horizontal: c === 1 ? "left" : "right" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE2E8F0" },
            };
            cell.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
            if (c >= 3) cell.numFmt = "0.00";
        }

        summary.columns = [
            { width: 32 },
            { width: 12 },
            { width: 14 },
            { width: 14 },
            { width: 14 },
            { width: 14 },
        ];

        // ---- Per-inspector detail sheets ----
        groups.forEach((g) => {
            const safeName = g.name.replace(/[\\/?*:[\]]/g, "").slice(0, 28) || "Inspector";
            const ws = wb.addWorksheet(safeName);

            ws.mergeCells("A1:G1");
            const t = ws.getCell("A1");
            t.value = g.name;
            t.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
            t.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF1E293B" },
            };
            t.alignment = { horizontal: "left", vertical: "middle" };
            ws.getRow(1).height = 26;

            ws.mergeCells("A2:G2");
            ws.getCell("A2").value = `${g.entryCount} entries · Total ${g.totalHours.toFixed(2)} h · Approved ${g.approvedHours.toFixed(2)} h · Pending ${g.pendingHours.toFixed(2)} h · Rejected ${g.rejectedHours.toFixed(2)} h`;
            ws.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF475569" } };

            const detailHeaders = ["Period", "Time", "Hours", "Linked To", "Status", "Reason", "Notes"];
            detailHeaders.forEach((h, i) => {
                const cell = ws.getCell(4, i + 1);
                cell.value = h;
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF334155" },
                };
                cell.alignment = { horizontal: i === 2 ? "right" : "left", vertical: "middle" };
            });
            ws.getRow(4).height = 18;

            g.rows.forEach((e, idx) => {
                const r = 5 + idx;
                ws.getCell(r, 1).value = formatPeriod(e);
                ws.getCell(r, 2).value = formatTime(e);
                ws.getCell(r, 3).value = Number((Number(e.hours) || 0).toFixed(2));
                ws.getCell(r, 3).numFmt = "0.00";
                ws.getCell(r, 4).value = formatLink(e);
                ws.getCell(r, 5).value = e.status;
                ws.getCell(r, 6).value = e.reason || "";
                ws.getCell(r, 7).value = e.notes || "";
                for (let c = 1; c <= 7; c++) {
                    const cell = ws.getCell(r, c);
                    cell.alignment = {
                        horizontal: c === 3 ? "right" : "left",
                        vertical: "top",
                        wrapText: c >= 6,
                    };
                    if (idx % 2 === 1) {
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFF8FAFC" },
                        };
                    }
                }
                // Status colour
                const statusCell = ws.getCell(r, 5);
                const statusColors: Record<string, string> = {
                    approved: "FF065F46",
                    pending: "FF92400E",
                    rejected: "FF9F1239",
                };
                statusCell.font = { bold: true, color: { argb: statusColors[e.status] || "FF111827" } };
            });

            const totalR = 5 + g.rows.length;
            ws.getCell(totalR, 1).value = "TOTAL";
            ws.getCell(totalR, 3).value = Number(g.totalHours.toFixed(2));
            ws.getCell(totalR, 3).numFmt = "0.00";
            for (let c = 1; c <= 7; c++) {
                const cell = ws.getCell(totalR, c);
                cell.font = { bold: true };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFE2E8F0" },
                };
                cell.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
                cell.alignment = { horizontal: c === 3 ? "right" : "left" };
            }

            ws.columns = [
                { width: 14 },
                { width: 18 },
                { width: 10 },
                { width: 38 },
                { width: 12 },
                { width: 28 },
                { width: 28 },
            ];
        });

        const buf = await wb.xlsx.writeBuffer();
        saveAs(
            new Blob([buf], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            `${exportFileBase()}.xlsx`
        );
        toast.success("Excel export ready");
    };

    const exportPdf = () => {
        if (filtered.length === 0) {
            toast.error("Nothing to export");
            return;
        }
        const groups = groupByInspector(filtered);
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header band
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, pageWidth, 22, "F");
        doc.setTextColor(255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("Overtime Report", 14, 14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
            `Generated ${format(new Date(), "yyyy-MM-dd HH:mm")}  ·  Status: ${statusFilter === "all" ? "All" : statusFilter
            }  ·  ${filtered.length} entries`,
            14,
            19
        );
        doc.setTextColor(0);

        // KPI strip
        const kpis = [
            { label: "Pending", value: String(stats.pending) },
            { label: "Approved", value: String(stats.approved) },
            { label: "Rejected", value: String(stats.rejected) },
            { label: "Approved hrs", value: stats.totalHours.toFixed(2) },
        ];
        const kpiY = 28;
        const kpiW = (pageWidth - 28 - (kpis.length - 1) * 4) / kpis.length;
        kpis.forEach((k, i) => {
            const x = 14 + i * (kpiW + 4);
            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(x, kpiY, kpiW, 16, 2, 2, "FD");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(k.label, x + 4, kpiY + 6);
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(k.value, x + 4, kpiY + 13);
            doc.setFont("helvetica", "normal");
        });

        // Per-inspector summary table
        autoTable(doc, {
            startY: kpiY + 22,
            head: [["Inspector", "Entries", "Pending hrs", "Approved hrs", "Rejected hrs", "Total hrs"]],
            body: groups.map((g) => [
                g.name,
                String(g.entryCount),
                g.pendingHours.toFixed(2),
                g.approvedHours.toFixed(2),
                g.rejectedHours.toFixed(2),
                g.totalHours.toFixed(2),
            ]),
            foot: [
                [
                    "TOTAL",
                    String(filtered.length),
                    groups.reduce((s, g) => s + g.pendingHours, 0).toFixed(2),
                    groups.reduce((s, g) => s + g.approvedHours, 0).toFixed(2),
                    groups.reduce((s, g) => s + g.rejectedHours, 0).toFixed(2),
                    groups.reduce((s, g) => s + g.totalHours, 0).toFixed(2),
                ],
            ],
            styles: { fontSize: 9, cellPadding: 2.5 },
            headStyles: { fillColor: [51, 65, 85], textColor: 255, halign: "left" },
            footStyles: { fillColor: [226, 232, 240], textColor: 15, fontStyle: "bold" },
            columnStyles: {
                0: { cellWidth: "auto" },
                1: { halign: "right", cellWidth: 22 },
                2: { halign: "right", cellWidth: 28 },
                3: { halign: "right", cellWidth: 28 },
                4: { halign: "right", cellWidth: 28 },
                5: { halign: "right", cellWidth: 28 },
            },
            margin: { left: 14, right: 14 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        // Per-inspector detail pages
        groups.forEach((g) => {
            doc.addPage();
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, pageWidth, 18, "F");
            doc.setTextColor(255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(g.name, 14, 11);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(
                `${g.entryCount} entries  ·  Total ${g.totalHours.toFixed(2)} h  ·  Approved ${g.approvedHours.toFixed(2)} h  ·  Pending ${g.pendingHours.toFixed(2)} h  ·  Rejected ${g.rejectedHours.toFixed(2)} h`,
                14,
                16
            );
            doc.setTextColor(0);

            autoTable(doc, {
                startY: 24,
                head: [["Period", "Time", "Hours", "Linked To", "Status", "Reason"]],
                body: g.rows.map((e) => [
                    formatPeriod(e),
                    formatTime(e),
                    (Number(e.hours) || 0).toFixed(2),
                    formatLink(e),
                    e.status,
                    e.reason || "",
                ]),
                foot: [["", "TOTAL", g.totalHours.toFixed(2), "", "", ""]],
                styles: { fontSize: 8.5, cellPadding: 2, valign: "top" },
                headStyles: { fillColor: [51, 65, 85], textColor: 255 },
                footStyles: { fillColor: [226, 232, 240], textColor: 15, fontStyle: "bold" },
                columnStyles: {
                    0: { cellWidth: 26 },
                    1: { cellWidth: 32 },
                    2: { cellWidth: 18, halign: "right" },
                    3: { cellWidth: "auto" },
                    4: { cellWidth: 22 },
                    5: { cellWidth: 60 },
                },
                margin: { left: 14, right: 14 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                didParseCell: (data) => {
                    if (data.section === "body" && data.column.index === 4) {
                        const v = String(data.cell.raw || "");
                        if (v === "approved") data.cell.styles.textColor = [6, 95, 70];
                        else if (v === "pending") data.cell.styles.textColor = [146, 64, 14];
                        else if (v === "rejected") data.cell.styles.textColor = [159, 18, 57];
                        data.cell.styles.fontStyle = "bold";
                    }
                },
            });
        });

        // Footer page numbers
        const pageCount = doc.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
            doc.setPage(p);
            doc.setFontSize(8);
            doc.setTextColor(120);
            doc.text(
                `Page ${p} of ${pageCount}`,
                pageWidth - 14,
                doc.internal.pageSize.getHeight() - 6,
                { align: "right" }
            );
        }

        doc.save(`${exportFileBase()}.pdf`);
        toast.success("PDF export ready");
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <KpiChip dotClass="bg-amber-500" label="Pending" value={stats.pending} />
                <KpiChip dotClass="bg-emerald-500" label="Approved" value={stats.approved} />
                <KpiChip dotClass="bg-rose-500" label="Rejected" value={stats.rejected} />
                <KpiChip dotClass="bg-blue-500" label="Approved hrs" value={stats.totalHours.toFixed(1)} />

                <div className="ml-auto flex items-center gap-2">
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search inspector, reason, JC#…"
                        className="h-9 w-[260px] bg-background"
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-[140px] bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={() => {
                            setEditing(null);
                            setDialogOpen(true);
                        }}
                        className="h-9 shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-1.5" /> Add Overtime
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-9 shadow-sm">
                                <Download className="h-4 w-4 mr-1.5" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => void exportExcel()}>
                                <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                                Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => exportPdf()}>
                                <FileText className="h-4 w-4 mr-2 text-rose-600" />
                                PDF (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Inspector</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                            <TableHead>Linked To</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    Loading overtime entries…
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                                    <Clock className="h-6 w-6 mx-auto mb-2 opacity-60" />
                                    No overtime entries. Click "Add Overtime" to log one.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((e) => (
                                <TableRow key={e.id}>
                                    <TableCell className="whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                            {e.entry_mode === "monthly"
                                                ? format(new Date(`${e.month || e.date.slice(0, 7)}-01`), "MMM yyyy")
                                                : format(new Date(e.date), "yyyy-MM-dd")}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{e.inspector_name}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                                        {e.entry_mode === "monthly"
                                            ? <span className="text-muted-foreground">Monthly total</span>
                                            : <>{e.start_time?.slice(0, 5)} – {e.end_time?.slice(0, 5)}</>}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-semibold">
                                        {Number(e.hours || 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell>{renderLink(e)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                        {e.reason || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`${STATUS_BADGE[e.status]} border-transparent capitalize`}>
                                            {e.status}
                                        </Badge>
                                        {e.status === "rejected" && e.rejection_reason && (
                                            <div className="text-[10px] text-rose-600 mt-1 max-w-[180px] truncate">
                                                {e.rejection_reason}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="inline-flex items-center gap-1">
                                            {e.status !== "approved" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                                    title="Approve"
                                                    onClick={() =>
                                                        updateStatusMutation.mutate({ id: e.id!, status: "approved" })
                                                    }
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {e.status !== "rejected" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                                    title="Reject"
                                                    onClick={() => {
                                                        setToReject(e);
                                                        setRejectionReason(e.rejection_reason || "");
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                title="Edit"
                                                onClick={() => {
                                                    setEditing(e);
                                                    setDialogOpen(true);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                title="Delete"
                                                onClick={() => setToDelete(e)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <AddOvertimeEntryDialog
                open={dialogOpen}
                onOpenChange={(o) => {
                    setDialogOpen(o);
                    if (!o) setEditing(null);
                }}
                entry={editing}
            />

            {/* Reject reason dialog */}
            <AlertDialog open={!!toReject} onOpenChange={(o) => !o && setToReject(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject overtime entry</AlertDialogTitle>
                        <AlertDialogDescription>
                            Optionally provide a reason. The entry stays in the system but is marked
                            rejected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="mt-2"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={updateStatusMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={updateStatusMutation.isPending}
                            className="bg-rose-600 hover:bg-rose-700"
                            onClick={() =>
                                toReject &&
                                updateStatusMutation.mutate({
                                    id: toReject.id!,
                                    status: "rejected",
                                    rejection_reason: rejectionReason,
                                })
                            }
                        >
                            {updateStatusMutation.isPending && (
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            )}
                            Reject
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete confirm */}
            <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete overtime entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the overtime entry for{" "}
                            <strong>{toDelete?.inspector_name}</strong> on{" "}
                            <strong>{toDelete?.date}</strong>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteMutation.isPending}
                            onClick={() => toDelete && deleteMutation.mutate(toDelete.id!)}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function KpiChip({
    dotClass,
    label,
    value,
}: {
    dotClass: string;
    label: string;
    value: number | string;
}) {
    return (
        <div className="flex items-center gap-2 rounded-lg bg-background border px-3 py-1.5 shadow-xs">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-semibold tabular-nums">{value}</span>
        </div>
    );
}
