import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Clock, DollarSign, Loader2, Users, Wrench } from "lucide-react";
import { useMemo } from "react";

interface WorkerDashboardSheetProps {
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
    total_cost: number | null;
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

export default function WorkerDashboardSheet({ open, onOpenChange, jobCard }: WorkerDashboardSheetProps) {
    const { data: labor = [], isLoading: loadingLabor } = useQuery<LaborRow[]>({
        queryKey: ["mobile-worker-dashboard-labor", jobCard?.id],
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
        queryKey: ["mobile-worker-dashboard-parts", jobCard?.id],
        enabled: open && !!jobCard?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("parts_requests")
                .select("id, part_name, quantity, total_cost, requested_by, status")
                .eq("job_card_id", jobCard!.id);
            if (error) throw error;
            return (data || []) as PartRow[];
        },
    });

    const workers = useMemo<WorkerSummary[]>(() => {
        const map = new Map<string, WorkerSummary>();
        if (jobCard?.assignee) {
            map.set(jobCard.assignee, { name: jobCard.assignee, hours: 0, cost: 0, entries: 0, parts: 0 });
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
        const totalPartsCost = parts.reduce((s, p) => s + (Number(p.total_cost) || 0), 0);
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
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[90vh] flex flex-col px-0 rounded-t-2xl">
                <SheetHeader className="px-4 pb-2 text-left">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4 text-amber-500" />
                        Worker Dashboard {jobCard ? `· #${jobCard.job_number}` : ""}
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                        Workers, hours, parts and costs for this job card.
                    </SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                    </div>
                ) : (
                    <ScrollArea className="flex-1 px-4 pb-4">
                        <div className="space-y-4">
                            {/* Mobile-first stacked summary tiles */}
                            <div className="grid grid-cols-2 gap-2">
                                <Tile icon={<Users className="h-4 w-4" />} label="Workers" value={String(totals.workerCount)} accent="text-amber-600" />
                                <Tile icon={<Clock className="h-4 w-4" />} label="Hours" value={totals.hours.toFixed(1)} accent="text-blue-600" />
                                <Tile icon={<Wrench className="h-4 w-4" />} label="Parts" value={String(totals.partsCount)} accent="text-purple-600" />
                                <Tile icon={<DollarSign className="h-4 w-4" />} label="Total" value={formatCurrency(totals.grandTotal)} accent="text-emerald-600" />
                            </div>

                            <Separator />

                            {/* Per-worker cards */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                    Per-worker breakdown
                                </h3>
                                {workers.length === 0 ? (
                                    <Card className="rounded-2xl border-border/40">
                                        <CardContent className="p-4 text-sm text-center text-muted-foreground">
                                            No workers assigned and no labour entries logged.
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="space-y-2">
                                        {workers.map((w) => (
                                            <Card key={w.name} className="rounded-2xl border border-border/40 shadow-sm">
                                                <CardContent className="p-3">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="font-semibold text-sm">
                                                            {w.name}
                                                            {jobCard?.assignee === w.name && (
                                                                <Badge variant="outline" className="ml-2 text-[9px] py-0 px-1.5">Assignee</Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-bold text-emerald-600">
                                                            {formatCurrency(w.cost)}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                        <Stat label="Entries" value={String(w.entries)} />
                                                        <Stat label="Hours" value={w.hours.toFixed(1)} />
                                                        <Stat label="Parts" value={String(w.parts)} />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Labour log */}
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                    Labour log
                                </h3>
                                {labor.length === 0 ? (
                                    <Card className="rounded-2xl border-border/40">
                                        <CardContent className="p-4 text-sm text-center text-muted-foreground">
                                            No labour entries logged yet.
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="space-y-2">
                                        {labor.map((l) => (
                                            <Card key={l.id} className="rounded-2xl border border-border/40 shadow-sm">
                                                <CardContent className="p-3">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <span className="text-xs font-mono text-muted-foreground">
                                                            {l.work_date ? new Date(l.work_date).toLocaleDateString("en-GB") : "-"}
                                                        </span>
                                                        <span className="text-xs font-bold text-emerald-600">
                                                            {formatCurrency(Number(l.total_cost) || 0)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-semibold mb-1 truncate">{l.technician_name || "-"}</p>
                                                    {l.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{l.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                                        <span><Clock className="h-3 w-3 inline mr-1" />{Number(l.hours_worked).toFixed(2)} hrs</span>
                                                        <span>R {Number(l.hourly_rate).toFixed(2)}/hr</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                )}
            </SheetContent>
        </Sheet>
    );
}

function Tile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
    return (
        <div className="border border-border/40 rounded-2xl p-3 bg-muted/20">
            <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${accent}`}>
                {icon}
                {label}
            </div>
            <div className="text-base font-bold mt-1 truncate">{value}</div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-center bg-muted/30 rounded-lg py-1.5">
            <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{label}</div>
            <div className="font-bold text-sm">{value}</div>
        </div>
    );
}
