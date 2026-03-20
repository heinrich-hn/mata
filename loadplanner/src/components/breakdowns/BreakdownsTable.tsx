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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    useBreakdowns,
    useDeleteBreakdown,
    useSendBreakdownToMainApp,
    useUpdateBreakdown,
} from "@/hooks/useBreakdowns";
import {
    BREAKDOWN_STATUSES,
    type Breakdown,
    type BreakdownStatus,
} from "@/types/breakdown";
import { format } from "date-fns";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    MoreHorizontal,
    Send,
    Trash2,
    Truck,
    Wrench,
} from "lucide-react";
import { useState } from "react";

function getSeverityVariant(severity: string): "default" | "destructive" | "secondary" {
    switch (severity) {
        case "critical":
        case "high":
            return "destructive";
        case "medium":
            return "default";
        default:
            return "secondary";
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case "reported":
            return <AlertTriangle className="h-4 w-4 text-destructive" />;
        case "assistance_dispatched":
            return <Truck className="h-4 w-4 text-blue-500" />;
        case "under_repair":
            return <Wrench className="h-4 w-4 text-amber-500" />;
        case "resolved":
            return <CheckCircle className="h-4 w-4 text-green-500" />;
        case "towed":
            return <Truck className="h-4 w-4 text-orange-500" />;
        default:
            return <Clock className="h-4 w-4" />;
    }
}

function getStatusLabel(status: string): string {
    return BREAKDOWN_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function BreakdownsTable() {
    const { data: breakdowns = [], isLoading } = useBreakdowns();
    const updateBreakdown = useUpdateBreakdown();
    const deleteBreakdown = useDeleteBreakdown();
    const sendToMainApp = useSendBreakdownToMainApp();

    const [deleteTarget, setDeleteTarget] = useState<Breakdown | null>(null);
    const [sendTarget, setSendTarget] = useState<Breakdown | null>(null);

    const handleStatusChange = (breakdown: Breakdown, status: BreakdownStatus) => {
        updateBreakdown.mutate({
            id: breakdown.id,
            status,
            ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
        });
    };

    const handleConfirmDelete = () => {
        if (!deleteTarget) return;
        deleteBreakdown.mutate(deleteTarget.id, {
            onSettled: () => setDeleteTarget(null),
        });
    };

    const handleConfirmSend = () => {
        if (!sendTarget) return;
        sendToMainApp.mutate(sendTarget, {
            onSettled: () => setSendTarget(null),
        });
    };

    const stats = {
        total: breakdowns.length,
        reported: breakdowns.filter((b) => b.status === "reported").length,
        inProgress: breakdowns.filter((b) =>
            ["assistance_dispatched", "under_repair", "towed"].includes(b.status)
        ).length,
        resolved: breakdowns.filter((b) => b.status === "resolved").length,
    };

    return (
        <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Breakdowns</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Reported</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{stats.reported}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                        <Wrench className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{stats.inProgress}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{stats.resolved}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Breakdowns Table */}
            <Card className="shadow-card">
                <CardHeader>
                    <CardTitle>Breakdowns</CardTitle>
                    <CardDescription>All reported vehicle breakdowns from trips</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center text-muted-foreground py-8">Loading breakdowns...</p>
                    ) : breakdowns.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No breakdowns reported yet.</p>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Breakdown #</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Load</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Severity</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Sent</TableHead>
                                        <TableHead className="w-[80px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {breakdowns.map((bd) => (
                                        <TableRow key={bd.id}>
                                            <TableCell className="font-mono text-sm font-medium">
                                                {bd.breakdown_number}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {format(new Date(bd.breakdown_date), "dd MMM yyyy HH:mm")}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {bd.fleet_vehicle?.vehicle_id ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {bd.load?.load_id ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {bd.category.replace("_", " ")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getSeverityVariant(bd.severity)} className="capitalize">
                                                    {bd.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={bd.status}
                                                    onValueChange={(v) => handleStatusChange(bd, v as BreakdownStatus)}
                                                >
                                                    <SelectTrigger className="h-8 w-[160px]">
                                                        <div className="flex items-center gap-1.5">
                                                            {getStatusIcon(bd.status)}
                                                            <SelectValue />
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {BREAKDOWN_STATUSES.map((s) => (
                                                            <SelectItem key={s.value} value={s.value}>
                                                                <div className="flex items-center gap-1.5">
                                                                    {getStatusIcon(s.value)}
                                                                    {s.label}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                {bd.sent_to_main_app ? (
                                                    <Badge variant="secondary" className="text-green-600">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        Sent
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        Not sent
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {!bd.sent_to_main_app && (
                                                            <DropdownMenuItem onClick={() => setSendTarget(bd)}>
                                                                <Send className="h-4 w-4 mr-2" />
                                                                Send to Workshop
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setDeleteTarget(bd)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Breakdown</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete breakdown{" "}
                            <span className="font-semibold">{deleteTarget?.breakdown_number}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {deleteBreakdown.isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Send to Main App Confirmation */}
            <AlertDialog open={!!sendTarget} onOpenChange={(o) => !o && setSendTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Send to Workshop</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will send breakdown{" "}
                            <span className="font-semibold">{sendTarget?.breakdown_number}</span>{" "}
                            to the main app workshop for inspection scheduling. Continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSend}>
                            {sendToMainApp.isPending ? "Sending..." : "Send to Workshop"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
