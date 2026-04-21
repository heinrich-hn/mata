import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Clock, DollarSign, Loader2, User, Users, Wrench } from "lucide-react";
import { useMemo } from "react";

interface WorkerDashboardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobCard: {
        id: string;
        job_number: string;
        title: string;
        assignee: string | null;
        status: string;
    } | null;
}

interface LaborRow {
    id: string;
    technician_name: string;
    description: string | null;
    hours_worked: number;
    hourly_rate: number;
    total_cost: number;
    work_date: string;
}

interface PartRow {
    id: string;
    part_name: string | null;
    quantity: number | null;
    total_price: number | null; // Changed from total_cost to total_price
    requested_by: string | null;
    status: string | null;
}

interface WorkerSummary {
    name: string;
    hours: number;
    cost: number;
    entries: number;
    parts: number;
}

const formatCurrency = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function WorkerDashboardDialog({ open, onOpenChange, jobCard }: WorkerDashboardDialogProps) {
    const { data: labor = [], isLoading: loadingLabor } = useQuery<LaborRow[]>({
        queryKey: ["worker-dashboard-labor", jobCard?.id],
        enabled: open && !!jobCard?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("labor_entries")
                .select("id, technician_name, description, hours_worked, hourly_rate, total_cost, work_date")
                .eq("job_card_id", jobCard!.id)
                .order("work_date", { ascending: false });
            if (error) throw error;
            return (data || []) as LaborRow[];
        },
    });

    const { data: parts = [], isLoading: loadingParts } = useQuery<PartRow[]>({
        queryKey: ["worker-dashboard-parts", jobCard?.id],
        enabled: open && !!jobCard?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("parts_requests")
                .select("id, part_name, quantity, total_price, requested_by, status") // Changed from total_cost to total_price
                .eq("job_card_id", jobCard!.id);
            if (error) throw error;
            return (data || []).map(part => ({
                ...part,
                total_price: part.total_price || null
            })) as PartRow[];
        },
    });

    const workers = useMemo<WorkerSummary[]>(() => {
        const map = new Map<string, WorkerSummary>();

        // Seed with the assignee (so they always appear even with no labor entries yet)
        if (jobCard?.assignee) {
            map.set(jobCard.assignee, {
                name: jobCard.assignee,
                hours: 0,
                cost: 0,
                entries: 0,
                parts: 0,
            });
        }

        for (const l of labor) {
            const key = (l.technician_name || "Unknown").trim();
            const existing = map.get(key) || { name: key, hours: 0, cost: 0, entries: 0, parts: 0 };
            existing.hours += Number(l.hours_worked) || 0;
            existing.cost += Number(l.total_cost) || 0;
            existing.entries += 1;
            map.set(key, existing);
        }

        for (const p of parts) {
            const key = (p.requested_by || "").trim();
            if (!key) continue;
            const existing = map.get(key) || { name: key, hours: 0, cost: 0, entries: 0, parts: 0 };
            existing.parts += 1;
            map.set(key, existing);
        }

        return Array.from(map.values()).sort((a, b) => b.hours - a.hours || b.cost - a.cost);
    }, [labor, parts, jobCard?.assignee]);

    const totals = useMemo(() => {
        const totalHours = labor.reduce((s, l) => s + (Number(l.hours_worked) || 0), 0);
        const totalLaborCost = labor.reduce((s, l) => s + (Number(l.total_cost) || 0), 0);
        const totalPartsCost = parts.reduce((s, p) => s + (Number(p.total_price) || 0), 0); // Changed from total_cost to total_price
        return {
            hours: totalHours,
            laborCost: totalLaborCost,
            partsCost: totalPartsCost,
            grandTotal: totalLaborCost + totalPartsCost,
            partsCount: parts.length,
            workerCount: workers.length,
        };
    }, [labor, parts, workers.length]);

    const isLoading = loadingLabor || loadingParts;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Worker Dashboard {jobCard ? `· ${jobCard.job_number}` : ""}
                    </DialogTitle>
                    <DialogDescription>
                        Workers assigned to this job card with labour hours, costs and parts requested.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading worker data...
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-3 -mr-3">
                        <div className="space-y-5">
                            {/* Summary tiles */}
                            <div className="grid gap-3 sm:grid-cols-4">
                                <SummaryTile icon={<Users className="h-4 w-4" />} label="Workers" value={String(totals.workerCount)} />
                                <SummaryTile icon={<Clock className="h-4 w-4" />} label="Total Hours" value={totals.hours.toFixed(2)} />
                                <SummaryTile icon={<Wrench className="h-4 w-4" />} label="Parts" value={String(totals.partsCount)} />
                                <SummaryTile icon={<DollarSign className="h-4 w-4" />} label="Total Cost" value={formatCurrency(totals.grandTotal)} />
                            </div>

                            {/* Per-worker summary */}
                            <div>
                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                    <User className="h-4 w-4" /> Per-worker breakdown
                                </h3>
                                {workers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                                        No workers assigned and no labour entries logged.
                                    </p>
                                ) : (
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Worker</TableHead>
                                                    <TableHead className="text-right">Entries</TableHead>
                                                    <TableHead className="text-right">Hours</TableHead>
                                                    <TableHead className="text-right">Parts</TableHead>
                                                    <TableHead className="text-right">Labour Cost</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {workers.map((w) => (
                                                    <TableRow key={w.name}>
                                                        <TableCell className="font-medium">
                                                            {w.name}
                                                            {jobCard?.assignee === w.name && (
                                                                <Badge variant="outline" className="ml-2 text-[10px]">Assignee</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">{w.entries}</TableCell>
                                                        <TableCell className="text-right">{w.hours.toFixed(2)}</TableCell>
                                                        <TableCell className="text-right">{w.parts}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(w.cost)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Labour log */}
                            <div>
                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                    <Clock className="h-4 w-4" /> Labour log
                                </h3>
                                {labor.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                                        No labour entries logged for this job card yet.
                                    </p>
                                ) : (
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Technician</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead className="text-right">Hours</TableHead>
                                                    <TableHead className="text-right">Cost</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {labor.map((l) => (
                                                    <TableRow key={l.id}>
                                                        <TableCell className="whitespace-nowrap text-xs">
                                                            {l.work_date ? new Date(l.work_date).toLocaleDateString("en-GB") : "-"}
                                                        </TableCell>
                                                        <TableCell>{l.technician_name || "-"}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                                                            {l.description || "-"}
                                                        </TableCell>
                                                        <TableCell className="text-right">{Number(l.hours_worked).toFixed(2)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(Number(l.total_cost) || 0)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="border rounded-md p-3 bg-muted/30">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {icon}
                {label}
            </div>
            <div className="text-lg font-semibold mt-1">{value}</div>
        </div>
    );
}

export default WorkerDashboardDialog;