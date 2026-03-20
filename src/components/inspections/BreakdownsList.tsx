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
    useDismissBreakdown,
    useFleetBreakdowns,
    useScheduleBreakdownForInspection,
    useUpdateFleetBreakdown,
    type FleetBreakdown,
} from "@/hooks/useFleetBreakdowns";
import { format } from "date-fns";
import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    Clock,
    ClipboardCheck,
    MoreVertical,
    Truck,
    Wrench,
    XCircle,
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

function getStatusConfig(status: string) {
    switch (status) {
        case "pending_review":
            return { icon: <Clock className="h-4 w-4" />, color: "text-amber-500", label: "Pending Review" };
        case "scheduled_for_inspection":
            return { icon: <Calendar className="h-4 w-4" />, color: "text-blue-500", label: "Scheduled" };
        case "inspection_created":
            return { icon: <ClipboardCheck className="h-4 w-4" />, color: "text-indigo-500", label: "Inspection Created" };
        case "resolved":
            return { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500", label: "Resolved" };
        case "dismissed":
            return { icon: <XCircle className="h-4 w-4" />, color: "text-muted-foreground", label: "Dismissed" };
        default:
            return { icon: <Clock className="h-4 w-4" />, color: "text-muted-foreground", label: status };
    }
}

export function BreakdownsList() {
    const { data: breakdowns = [], isLoading } = useFleetBreakdowns();
    const scheduleForInspection = useScheduleBreakdownForInspection();
    const dismissBreakdown = useDismissBreakdown();
    const updateBreakdown = useUpdateFleetBreakdown();
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const filteredBreakdowns = statusFilter === "all"
        ? breakdowns
        : breakdowns.filter((b) => b.status === statusFilter);

    const stats = {
        total: breakdowns.length,
        pendingReview: breakdowns.filter((b) => b.status === "pending_review").length,
        scheduled: breakdowns.filter((b) => b.status === "scheduled_for_inspection").length,
        resolved: breakdowns.filter((b) => b.status === "resolved").length,
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Breakdowns</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-amber-600">{stats.pendingReview}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-blue-600">{stats.scheduled}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold text-green-600">{stats.resolved}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Breakdowns Table */}
            <Card className="shadow-card">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Fleet Breakdowns</CardTitle>
                            <CardDescription>Breakdowns received from Load Planner for inspection scheduling</CardDescription>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending_review">Pending Review</SelectItem>
                                <SelectItem value="scheduled_for_inspection">Scheduled</SelectItem>
                                <SelectItem value="inspection_created">Inspection Created</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="dismissed">Dismissed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center text-muted-foreground py-8">Loading breakdowns...</p>
                    ) : filteredBreakdowns.length === 0 ? (
                        <div className="text-center py-12">
                            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-semibold mb-1">No breakdowns</h3>
                            <p className="text-muted-foreground">
                                {statusFilter === "all"
                                    ? "No breakdowns have been received from Load Planner yet."
                                    : "No breakdowns match the selected filter."}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Source Ref</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Driver</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Severity</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-[60px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredBreakdowns.map((bd) => {
                                        const statusConfig = getStatusConfig(bd.status);
                                        return (
                                            <TableRow key={bd.id}>
                                                <TableCell className="font-mono text-xs">
                                                    {bd.source_breakdown_number ?? "—"}
                                                    {bd.load_number && (
                                                        <div className="text-muted-foreground mt-0.5">
                                                            Load: {bd.load_number}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {format(new Date(bd.breakdown_date), "dd MMM yyyy HH:mm")}
                                                </TableCell>
                                                <TableCell className="text-sm font-medium">
                                                    {bd.vehicle_registration ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {bd.driver_name ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize text-xs">
                                                        {bd.category.replace("_", " ")}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getSeverityVariant(bd.severity)} className="capitalize">
                                                        {bd.severity}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="max-w-[200px]">
                                                    <p className="truncate text-sm" title={bd.description}>
                                                        {bd.description}
                                                    </p>
                                                    {bd.location && (
                                                        <p className="text-xs text-muted-foreground truncate" title={bd.location}>
                                                            @ {bd.location}
                                                        </p>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className={`flex items-center gap-1.5 ${statusConfig.color}`}>
                                                        {statusConfig.icon}
                                                        <span className="text-sm font-medium">{statusConfig.label}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {bd.status === "pending_review" && (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        onClick={() => scheduleForInspection.mutate(bd.id)}
                                                                    >
                                                                        <Calendar className="h-4 w-4 mr-2" />
                                                                        Schedule for Inspection
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() => dismissBreakdown.mutate({ id: bd.id })}
                                                                        className="text-muted-foreground"
                                                                    >
                                                                        <XCircle className="h-4 w-4 mr-2" />
                                                                        Dismiss
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                            {bd.status === "scheduled_for_inspection" && (
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        updateBreakdown.mutate({ id: bd.id, status: "resolved" })
                                                                    }
                                                                >
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Mark Resolved
                                                                </DropdownMenuItem>
                                                            )}
                                                            {(bd.status === "dismissed" || bd.status === "resolved") && (
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        updateBreakdown.mutate({ id: bd.id, status: "pending_review" })
                                                                    }
                                                                >
                                                                    <Clock className="h-4 w-4 mr-2" />
                                                                    Reopen
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
