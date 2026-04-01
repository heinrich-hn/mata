import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

// ============================================================================
// Types & Constants
// ============================================================================
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

const PRIORITY_COLORS: Record<string, string> = {
    urgent: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-blue-50 text-blue-700 border-blue-200",
    low: "bg-gray-50 text-gray-600 border-gray-200",
};

const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-gray-50 text-gray-500 border-gray-200",
};

const STATUS_FILTERS = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Done" },
] as const;

// ============================================================================
// Helper Functions
// ============================================================================
const parseComments = (raw: unknown): FollowUpComment[] | null => {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw as FollowUpComment[];
    return null;
};

const getSeverityColor = (severity: string | null): string => {
    if (severity === "critical") return "bg-red-50 text-red-700 border-red-200";
    if (severity === "major") return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
};

const getVehicleDisplay = (vehicle: FollowUpItem['job_card']['vehicle']) => {
    if (!vehicle) return null;
    // Priority: fleet_number > registration_number
    return vehicle.fleet_number || vehicle.registration_number;
};

// ============================================================================
// Sub-components
// ============================================================================
const SearchBar = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <div className="relative">
        <Input
            placeholder="Search follow-ups…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1 pl-4"
            aria-label="Search follow-ups"
        />
    </div>
);

const StatusFilter = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <div className="flex gap-2">
        {STATUS_FILTERS.map((filter) => (
            <Button
                key={filter.value}
                variant={value === filter.value ? "default" : "outline"}
                size="sm"
                className={cn(
                    "h-9 text-xs touch-target rounded-xl font-semibold",
                    value === filter.value && "shadow-sm"
                )}
                onClick={() => onChange(filter.value)}
            >
                {filter.label}
            </Button>
        ))}
    </div>
);

const EmptyState = ({ hasFilters }: { hasFilters: boolean }) => (
    <Card className="rounded-2xl border border-border/40">
        <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muted to-muted/50 mx-auto mb-4 flex items-center justify-center">
                <span className="text-xl font-bold text-muted-foreground/40">0</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
                {hasFilters ? "No matching follow-ups." : "No follow-up questions yet."}
            </p>
        </CardContent>
    </Card>
);

const FaultItem = ({ fault }: { fault: Fault }) => (
    <div className="flex items-start gap-2 text-xs border border-amber-100 rounded-xl px-3 py-2 bg-amber-50/50">
        <Badge
            variant="outline"
            className={cn(
                "text-[10px] px-1.5 py-0.5 shrink-0 rounded-lg font-semibold",
                getSeverityColor(fault.severity)
            )}
        >
            {fault.severity || "unknown"}
        </Badge>
        <span className="text-foreground flex-1 leading-relaxed">{fault.fault_description}</span>
    </div>
);

const CommentThread = ({ comments }: { comments: FollowUpComment[] }) => (
    <div className="space-y-2 pl-3 border-l-2 border-primary/20">
        {comments.map((comment, idx) => (
            <div key={idx} className="text-sm">
                <p className="leading-relaxed">{comment.text}</p>
                <span className="text-[11px] text-muted-foreground font-medium">
                    {comment.author} · {new Date(comment.date).toLocaleString()}
                </span>
            </div>
        ))}
    </div>
);

// ============================================================================
// Main Component
// ============================================================================
const MobileFollowUps = () => {
    const { userName } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Fetch follow-ups
    const { data: followUps = [], isLoading, error } = useQuery<FollowUpItem[]>({
        queryKey: ["all_job_card_followups"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("action_items")
                .select("id, title, description, status, priority, assigned_to, due_date, created_by, created_at, comments, related_entity_id")
                .eq("related_entity_type", "job_card")
                .eq("category", "external_follow_up")
                .order("created_at", { ascending: false });

            if (error) throw error;

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

                    // Fetch inspections
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

                    // Fetch faults
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
        staleTime: 30000,
        gcTime: 300000,
    });

    // Filtered follow-ups
    const filteredFollowUps = useMemo(() => {
        let result = followUps;

        if (statusFilter !== "all") {
            result = result.filter((f) => f.status === statusFilter);
        }

        if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter(
                (f) =>
                    f.title.toLowerCase().includes(q) ||
                    f.description?.toLowerCase().includes(q) ||
                    f.assigned_to?.toLowerCase().includes(q) ||
                    f.job_card?.job_number.toLowerCase().includes(q) ||
                    f.job_card?.title.toLowerCase().includes(q) ||
                    getVehicleDisplay(f.job_card?.vehicle)?.toLowerCase().includes(q)
            );
        }

        return result;
    }, [followUps, statusFilter, debouncedSearch]);

    const _pendingCount = followUps.filter((f) => f.status === "pending").length;
    const hasFilters = searchQuery !== "" || statusFilter !== "all";

    // Handlers
    const handleReply = useCallback(async (followUpId: string) => {
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
            .update({ comments: JSON.parse(JSON.stringify(updatedComments)) })
            .eq("id", followUpId);

        if (error) {
            toast({ title: "Error", description: "Failed to add reply", variant: "destructive" });
            return;
        }

        toast({ title: "Reply added" });
        setReplyText("");
        setReplyingTo(null);
        queryClient.invalidateQueries({ queryKey: ["all_job_card_followups"] });
    }, [replyText, followUps, userName, toast, queryClient]);

    const handleStatusToggle = useCallback(async (followUp: FollowUpItem) => {
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
    }, [toast, queryClient]);

    const handleDelete = useCallback(async (followUpId: string) => {
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
    }, [toast, queryClient]);

    const toggleExpand = useCallback((id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    }, []);

    const startReply = useCallback((id: string) => {
        setReplyingTo(id);
        setReplyText("");
    }, []);

    const cancelReply = useCallback(() => {
        setReplyingTo(null);
        setReplyText("");
    }, []);

    // Error state
    if (error) {
        return (
            <div className="px-4 py-8">
                <Card className="rounded-2xl border border-border/40">
                    <CardContent className="py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 mx-auto mb-3 flex items-center justify-center">
                            <span className="text-rose-600 font-bold text-lg">!</span>
                        </div>
                        <p className="text-sm text-destructive font-semibold">Failed to load follow-ups</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {error instanceof Error ? error.message : "Please try again"}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="px-4 py-4 space-y-4 pb-safe-bottom">
            {/* Search and Filters */}
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />

            {/* Follow-ups list */}
            {isLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    Loading follow-ups...
                </div>
            ) : filteredFollowUps.length === 0 ? (
                <EmptyState hasFilters={hasFilters} />
            ) : (
                <div className="space-y-2">
                    {filteredFollowUps.map((fu) => {
                        const isExpanded = expandedId === fu.id;
                        const commentCount = fu.comments?.length || 0;
                        const isCompleted = fu.status === "completed";
                        const vehicleDisplay = getVehicleDisplay(fu.job_card?.vehicle);
                        const hasVehicle = !!vehicleDisplay;
                        const hasJobCard = !!fu.job_card;
                        const hasInspection = !!fu.job_card?.inspection;

                        return (
                            <Card key={fu.id} className="overflow-hidden rounded-2xl border border-border/40 shadow-sm active:scale-[0.98] transition-transform">
                                {/* Card Header: Vehicle + Job Card */}
                                {(hasVehicle || hasJobCard) && (
                                    <div className="px-4 pt-3 pb-2 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/30">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {hasVehicle && (
                                                <span className="text-sm font-bold text-foreground tracking-tight">
                                                    {vehicleDisplay}
                                                    {fu.job_card?.vehicle?.registration_number && fu.job_card.vehicle.fleet_number && (
                                                        <span className="text-[10px] text-muted-foreground font-normal ml-1.5">
                                                            {fu.job_card.vehicle.registration_number}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {(fu.job_card?.vehicle?.make || fu.job_card?.vehicle?.model) && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    {fu.job_card.vehicle.make} {fu.job_card.vehicle.model}
                                                </span>
                                            )}
                                        </div>
                                        {hasJobCard && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-semibold text-blue-700">
                                                    Job #{fu.job_card!.job_number}
                                                </span>
                                                {hasInspection && (
                                                    <span className="text-[10px] text-indigo-600 font-medium">
                                                        · Insp #{fu.job_card!.inspection!.inspection_number}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="w-full p-4 text-left active:bg-muted/30 transition-colors touch-target"
                                    onClick={() => toggleExpand(fu.id)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            {/* Title */}
                                            <p className={cn(
                                                "text-sm font-medium leading-snug",
                                                isCompleted && "line-through text-muted-foreground"
                                            )}>
                                                {fu.title}
                                            </p>

                                            {/* Faults preview */}
                                            {fu.job_card?.faults && fu.job_card.faults.length > 0 && (
                                                <div className="mt-1.5">
                                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                                        {fu.job_card.faults.length} fault{fu.job_card.faults.length > 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Status badges */}
                                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-lg font-semibold",
                                                        STATUS_COLORS[fu.status || "pending"]
                                                    )}
                                                >
                                                    {(fu.status || "pending").replace("_", " ")}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-lg font-semibold",
                                                        PRIORITY_COLORS[fu.priority || "medium"]
                                                    )}
                                                >
                                                    {fu.priority || "medium"}
                                                </Badge>
                                                {commentCount > 0 && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {commentCount} repl{commentCount > 1 ? "ies" : "y"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground mt-1 font-medium shrink-0">
                                            {isExpanded ? "Less" : "More"}
                                        </span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-border/30 px-4 pb-4 space-y-3">
                                        {/* Details */}
                                        <div className="pt-3 space-y-1.5 text-sm text-muted-foreground">
                                            {fu.description && <p className="text-foreground">{fu.description}</p>}
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                                {fu.assigned_to && (
                                                    <span>Assigned: <strong className="text-foreground">{fu.assigned_to}</strong></span>
                                                )}
                                                {fu.due_date && <span>Due: {new Date(fu.due_date).toLocaleDateString()}</span>}
                                                <span>By: {fu.created_by}</span>
                                                {fu.created_at && <span>{new Date(fu.created_at).toLocaleDateString()}</span>}
                                            </div>
                                        </div>

                                        {/* Faults */}
                                        {fu.job_card?.faults && fu.job_card.faults.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                                                    Faults ({fu.job_card.faults.length})
                                                </p>
                                                <div className="space-y-1.5">
                                                    {fu.job_card.faults.map((fault) => (
                                                        <FaultItem key={fault.id} fault={fault} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Comments thread */}
                                        {fu.comments && fu.comments.length > 0 && (
                                            <CommentThread comments={fu.comments} />
                                        )}

                                        {/* Reply input */}
                                        {replyingTo === fu.id ? (
                                            <div className="space-y-2">
                                                <Textarea
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder="Write a reply..."
                                                    rows={2}
                                                    className="text-sm rounded-xl"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" className="h-8 rounded-lg font-medium" onClick={cancelReply}>
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 rounded-lg font-semibold"
                                                        onClick={() => handleReply(fu.id)}
                                                        disabled={!replyText.trim()}
                                                    >
                                                        Send Reply
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 flex-wrap pt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 text-xs touch-target rounded-xl font-semibold"
                                                    onClick={() => startReply(fu.id)}
                                                >
                                                    Reply
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 text-xs touch-target rounded-xl font-semibold"
                                                    onClick={() => handleStatusToggle(fu)}
                                                >
                                                    {isCompleted ? "Reopen" : "Complete"}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 text-xs text-destructive hover:text-destructive touch-target rounded-xl font-semibold"
                                                    onClick={() => handleDelete(fu.id)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        )}
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

export default MobileFollowUps;