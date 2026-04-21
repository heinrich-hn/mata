import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    ListPlus,
    Search,
    Send,
    Trash2,
    Truck,
} from "lucide-react";
import { useState, useMemo } from "react";

interface FollowUpComment {
    text: string;
    author: string;
    date: string;
}

interface Fault {
    id: string;
    fault_description: string;
    severity: string | null;
    corrective_action_status: string | null;
}

interface FollowUpItem {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    priority: string | null;
    assigned_to: string | null;
    due_date: string | null;
    created_by: string;
    created_at: string | null;
    comments: FollowUpComment[] | null;
    related_entity_id: string | null;
    job_card?: {
        job_number: string;
        title: string;
        inspection_id: string | null;
        vehicle?: {
            registration_number: string;
            fleet_number: string | null;
            make: string | null;
            model: string | null;
        } | null;
        inspection?: {
            inspection_number: string;
            inspection_type: string | null;
        } | null;
        faults?: Fault[];
    } | null;
}

const priorityColors: Record<string, string> = {
    urgent: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-blue-50 text-blue-700 border-blue-200",
    low: "bg-gray-50 text-gray-600 border-gray-200",
};

const statusColors: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-gray-50 text-gray-500 border-gray-200",
};

const parseComments = (raw: unknown): FollowUpComment[] | null => {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw as FollowUpComment[];
    return null;
};

const JobCardFollowUpsTab = () => {
    const { userName } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const { data: followUps = [], isLoading } = useQuery<FollowUpItem[]>({
        queryKey: ["all_job_card_followups"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("action_items")
                .select("id, title, description, status, priority, assigned_to, due_date, created_by, created_at, comments, related_entity_id")
                .eq("related_entity_type", "job_card")
                .eq("category", "external_follow_up")
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Fetch job card info for each follow-up
            const entityIds = [...new Set((data || []).map((d) => d.related_entity_id).filter(Boolean))];
            let jobCardsMap: Record<string, Record<string, unknown>> = {};

            if (entityIds.length > 0) {
                const { data: jobCards } = await supabase
                    .from("job_cards")
                    .select("id, job_number, title, inspection_id, vehicle_id")
                    .in("id", entityIds);

                if (jobCards) {
                    // Fetch vehicles for job cards that have vehicle_id
                    const vehicleIds = [...new Set(jobCards.map((jc) => jc.vehicle_id).filter(Boolean) as string[])];
                    let vehiclesMap: Record<string, Record<string, unknown>> = {};
                    if (vehicleIds.length > 0) {
                        const { data: vehicles } = await supabase
                            .from("vehicles")
                            .select("id, registration_number, fleet_number, make, model")
                            .in("id", vehicleIds);
                        if (vehicles) {
                            vehiclesMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
                        }
                    }

                    // Fetch inspections for job cards that have inspection_id
                    const inspectionIds = jobCards.map((jc) => jc.inspection_id).filter(Boolean) as string[];
                    let inspectionsMap: Record<string, { inspection_number: string; inspection_type: string | null }> = {};

                    if (inspectionIds.length > 0) {
                        const { data: inspections } = await supabase
                            .from("vehicle_inspections")
                            .select("id, inspection_number, inspection_type")
                            .in("id", inspectionIds);
                        if (inspections) {
                            inspectionsMap = Object.fromEntries(
                                inspections.map((ins) => [ins.id, { inspection_number: ins.inspection_number, inspection_type: ins.inspection_type }])
                            );
                        }
                    }

                    // Fetch faults linked to these job cards
                    const { data: faults } = await supabase
                        .from("inspection_faults")
                        .select("id, fault_description, severity, corrective_action_status, job_card_id")
                        .in("job_card_id", entityIds);

                    const faultsByJobCard: Record<string, Fault[]> = {};
                    if (faults) {
                        for (const f of faults) {
                            if (f.job_card_id) {
                                if (!faultsByJobCard[f.job_card_id]) faultsByJobCard[f.job_card_id] = [];
                                faultsByJobCard[f.job_card_id].push(f);
                            }
                        }
                    }

                    jobCardsMap = Object.fromEntries(
                        jobCards.map((jc) => [
                            jc.id,
                            {
                                job_number: jc.job_number,
                                title: jc.title,
                                inspection_id: jc.inspection_id,
                                vehicle: jc.vehicle_id ? vehiclesMap[jc.vehicle_id] || null : null,
                                inspection: jc.inspection_id ? inspectionsMap[jc.inspection_id] || null : null,
                                faults: faultsByJobCard[jc.id] || [],
                            },
                        ])
                    );
                }
            }

            return (data || []).map((item) => ({
                ...item,
                comments: parseComments(item.comments),
                job_card: item.related_entity_id ? jobCardsMap[item.related_entity_id] || null : null,
            })) as FollowUpItem[];
        },
    });

    const filteredFollowUps = useMemo(() => {
        // Hide completed follow-ups from the list (record is still preserved on the job card)
        let result = followUps.filter((f) => f.status !== "completed");
        if (statusFilter !== "all") {
            result = result.filter((f) => f.status === statusFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (f) =>
                    f.title.toLowerCase().includes(q) ||
                    f.description?.toLowerCase().includes(q) ||
                    f.assigned_to?.toLowerCase().includes(q) ||
                    f.job_card?.job_number.toLowerCase().includes(q) ||
                    f.job_card?.title.toLowerCase().includes(q) ||
                    f.job_card?.vehicle?.registration_number.toLowerCase().includes(q)
            );
        }
        return result;
    }, [followUps, statusFilter, searchQuery]);

    const pendingCount = followUps.filter((f) => f.status === "pending").length;
    const completedCount = followUps.filter((f) => f.status === "completed").length;

    const handleReply = async (followUpId: string) => {
        if (!replyText.trim()) return;

        const item = followUps.find((f) => f.id === followUpId);
        if (!item) return;

        const existingComments: FollowUpComment[] = item.comments || [];
        const newComment: FollowUpComment = {
            text: replyText.trim(),
            author: userName || "Unknown User",
            date: new Date().toISOString(),
        };

        const updatedComments = [...existingComments, newComment];

        const { error } = await supabase
            .from("action_items")
            .update({ comments: updatedComments as unknown as Json[] })
            .eq("id", followUpId);

        if (error) {
            toast({ title: "Error", description: "Failed to add reply", variant: "destructive" });
            return;
        }

        toast({ title: "Reply added" });
        setReplyText("");
        setReplyingTo(null);
        queryClient.invalidateQueries({ queryKey: ["all_job_card_followups"] });
    };

    const handleStatusToggle = async (followUp: FollowUpItem) => {
        const newStatus = followUp.status === "completed" ? "pending" : "completed";
        const updates: Record<string, unknown> = {
            status: newStatus,
            completed_date: newStatus === "completed" ? new Date().toISOString() : null,
        };

        const { error } = await supabase
            .from("action_items")
            .update(updates)
            .eq("id", followUp.id);

        if (error) {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
            return;
        }

        toast({ title: newStatus === "completed" ? "Marked complete" : "Reopened" });
        queryClient.invalidateQueries({ queryKey: ["all_job_card_followups"] });
        queryClient.invalidateQueries({ queryKey: ["job_cards_with_vehicles"] });
    };

    const handleDelete = async (followUpId: string) => {
        const { error } = await supabase
            .from("action_items")
            .delete()
            .eq("id", followUpId);

        if (error) {
            toast({ title: "Error", description: "Failed to delete follow-up", variant: "destructive" });
            return;
        }

        toast({ title: "Follow-up deleted" });
        setExpandedId(null);
        queryClient.invalidateQueries({ queryKey: ["all_job_card_followups"] });
        queryClient.invalidateQueries({ queryKey: ["job_cards_with_vehicles"] });
    };

    return (
        <div className="space-y-6">
            {/* Refined toolbar: KPI chips + filters */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                    {/* KPI chips */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 shadow-sm">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                            <span className="text-base font-semibold tabular-nums leading-none">{followUps.length}</span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 shadow-sm">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                            <span className="text-base font-semibold tabular-nums leading-none">{pendingCount}</span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pending</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 shadow-sm">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                            <span className="text-base font-semibold tabular-nums leading-none">{completedCount}</span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Completed</span>
                        </div>
                    </div>

                    <div className="hidden sm:block h-5 w-px bg-border/70" />

                    {/* Filters inline */}
                    <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-[280px]">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search follow-ups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 pl-8 text-xs bg-background"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-[130px] text-xs bg-background">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Open</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Follow-ups list */}
            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading follow-ups...</div>
            ) : filteredFollowUps.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <ExternalLink className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                        <p className="text-base text-muted-foreground">
                            {searchQuery || statusFilter !== "all" ? "No follow-ups match your filters." : "No follow-up questions yet."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredFollowUps.map((fu) => {
                        const isExpanded = expandedId === fu.id;
                        const commentCount = fu.comments?.length || 0;
                        const statusKey = fu.status || "pending";
                        const priorityKey = fu.priority || "medium";

                        return (
                            <Card key={fu.id} className="overflow-hidden border shadow-sm">
                                {/* Vehicle & Job Card Header */}
                                {(fu.job_card?.vehicle || fu.job_card) && (
                                    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/40 border-b flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-3">
                                            {fu.job_card?.vehicle && (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700">
                                                        <Truck className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold leading-tight">
                                                            {fu.job_card.vehicle.fleet_number
                                                                ? <>{fu.job_card.vehicle.fleet_number} <span className="text-muted-foreground font-normal">-</span> {fu.job_card.vehicle.registration_number}</>
                                                                : fu.job_card.vehicle.registration_number
                                                            }
                                                        </p>
                                                        {(fu.job_card.vehicle.make || fu.job_card.vehicle.model) && (
                                                            <p className="text-xs text-muted-foreground leading-tight">
                                                                {fu.job_card.vehicle.make} {fu.job_card.vehicle.model}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {fu.job_card && (
                                                <Badge variant="secondary" className="text-xs font-mono font-medium">
                                                    Job #{fu.job_card.job_number}
                                                </Badge>
                                            )}
                                            {fu.job_card?.inspection && (
                                                <Badge variant="secondary" className="text-xs font-mono font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                    Insp #{fu.job_card.inspection.inspection_number}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Main clickable row */}
                                <button
                                    type="button"
                                    className="w-full px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : fu.id)}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <p className={`text-sm font-semibold leading-normal ${fu.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                                {fu.title}
                                            </p>
                                            {fu.job_card?.faults && fu.job_card.faults.length > 0 && (
                                                <div className="flex items-center gap-1.5">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                    <span className="text-xs font-medium text-amber-600">
                                                        {fu.job_card.faults.length} fault{fu.job_card.faults.length > 1 ? "s" : ""} linked
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={`text-xs px-2 py-0.5 font-medium capitalize ${statusColors[statusKey]}`}>
                                                    {statusKey.replace("_", " ")}
                                                </Badge>
                                                <Badge variant="outline" className={`text-xs px-2 py-0.5 font-medium capitalize ${priorityColors[priorityKey]}`}>
                                                    {priorityKey}
                                                </Badge>
                                                {fu.assigned_to && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Assigned to <span className="font-medium text-foreground">{fu.assigned_to}</span>
                                                    </span>
                                                )}
                                                {commentCount > 0 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        · {commentCount} {commentCount > 1 ? "replies" : "reply"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0 mt-0.5">
                                            {isExpanded ? (
                                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="border-t bg-muted/10">
                                        {/* Description & metadata */}
                                        <div className="px-5 py-4 space-y-3">
                                            {fu.description && (
                                                <p className="text-sm text-foreground leading-relaxed">{fu.description}</p>
                                            )}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {fu.job_card && (
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Title</p>
                                                        <p className="text-sm font-medium mt-0.5">{fu.job_card.title}</p>
                                                    </div>
                                                )}
                                                {fu.due_date && (
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</p>
                                                        <p className="text-sm font-medium mt-0.5">{new Date(fu.due_date).toLocaleDateString()}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created By</p>
                                                    <p className="text-sm font-medium mt-0.5">{fu.created_by}</p>
                                                </div>
                                                {fu.created_at && (
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</p>
                                                        <p className="text-sm font-medium mt-0.5">{new Date(fu.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Faults section */}
                                        {fu.job_card?.faults && fu.job_card.faults.length > 0 && (
                                            <div className="px-5 py-4 border-t">
                                                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-3">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    Linked Faults ({fu.job_card.faults.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {fu.job_card.faults.map((fault) => (
                                                        <div key={fault.id} className="flex items-start gap-3 text-sm rounded-lg border px-3 py-2.5 bg-amber-50/60 dark:bg-amber-950/20">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs px-2 py-0.5 shrink-0 font-medium capitalize ${fault.severity === "critical" ? "bg-red-100 text-red-700 border-red-300" :
                                                                    fault.severity === "major" ? "bg-orange-100 text-orange-700 border-orange-300" :
                                                                        "bg-yellow-100 text-yellow-700 border-yellow-300"
                                                                    }`}
                                                            >
                                                                {fault.severity || "unknown"}
                                                            </Badge>
                                                            <span className="text-sm text-foreground flex-1 leading-snug">{fault.fault_description}</span>
                                                            {fault.corrective_action_status && (
                                                                <Badge variant="outline" className="text-xs px-2 py-0.5 shrink-0 font-medium capitalize">
                                                                    {fault.corrective_action_status.replace("_", " ")}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Comments thread */}
                                        {fu.comments && fu.comments.length > 0 && (
                                            <div className="px-5 py-4 border-t">
                                                <h4 className="text-sm font-semibold mb-3">Replies ({fu.comments.length})</h4>
                                                <div className="space-y-3 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                                                    {fu.comments.map((c, i) => (
                                                        <div key={i} className="space-y-1">
                                                            <p className="text-sm leading-relaxed text-foreground">{c.text}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                <span className="font-medium">{c.author}</span> · {new Date(c.date).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="px-5 py-3 border-t bg-muted/20 flex items-center gap-2 flex-wrap">
                                            {replyingTo === fu.id ? (
                                                <div className="w-full space-y-3">
                                                    <Textarea
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        placeholder="Write a reply..."
                                                        rows={2}
                                                        className="text-sm"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                                                            Cancel
                                                        </Button>
                                                        <Button size="sm" onClick={() => handleReply(fu.id)} disabled={!replyText.trim()}>
                                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                                            Reply
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => setReplyingTo(fu.id)}>
                                                        <ListPlus className="h-4 w-4 mr-1.5" />
                                                        Reply
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => handleStatusToggle(fu)}>
                                                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                                        {fu.status === "completed" ? "Reopen" : "Mark Complete"}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(fu.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1.5" />
                                                        Delete
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default JobCardFollowUpsTab;
