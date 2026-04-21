import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Calendar as CalendarIcon,
    Check,
    Clock,
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
                                            {format(new Date(e.date), "yyyy-MM-dd")}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{e.inspector_name}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                                        {e.start_time?.slice(0, 5)} – {e.end_time?.slice(0, 5)}
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
