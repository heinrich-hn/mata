import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseComments = (raw: any): FollowUpComment[] | null => {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let jobCardsMap: Record<string, any> = {};

            if (entityIds.length > 0) {
                const { data: jobCards } = await supabase
                    .from("job_cards")
                    .select("id, job_number, title, inspection_id, vehicle_id")
                    .in("id", entityIds);

                if (jobCards) {
                    // Fetch vehicles for job cards that have vehicle_id
                    const vehicleIds = [...new Set(jobCards.map((jc) => jc.vehicle_id).filter(Boolean) as string[])];
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let vehiclesMap: Record<string, any> = {};
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
        let result = followUps;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ comments: updatedComments as any })
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
        <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Follow-ups</p>
                                <p className="text-2xl font-semibold">{followUps.length}</p>
                            </div>
                            <ExternalLink className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Pending</p>
                                <p className="text-2xl font-semibold text-yellow-600">{pendingCount}</p>
                            </div>
                            <ListPlus className="h-5 w-5 text-yellow-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Completed</p>
                                <p className="text-2xl font-semibold text-green-600">{completedCount}</p>
                            </div>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search follow-ups, job cards, vehicles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Follow-ups list */}
            {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading follow-ups...</div>
            ) : filteredFollowUps.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ExternalLink className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                            {searchQuery || statusFilter !== "all" ? "No follow-ups match your filters." : "No follow-up questions yet."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filteredFollowUps.map((fu) => {
                        const isExpanded = expandedId === fu.id;
                        const commentCount = fu.comments?.length || 0;

                        return (
                            <Card key={fu.id} className="overflow-hidden">
                                {/* Header: Vehicle + Job Card */}
                                {(fu.job_card?.vehicle || fu.job_card) && (
                                    <div className="px-4 pt-3 pb-2 bg-muted/30 border-b">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {fu.job_card?.vehicle && (
                                                <div className="flex items-center gap-1.5">
                                                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-sm font-semibold">
                                                        {fu.job_card.vehicle.fleet_number && (
                                                            <span className="font-mono text-xs mr-1">[{fu.job_card.vehicle.fleet_number}]</span>
                                                        )}
                                                        {fu.job_card.vehicle.registration_number}
                                                    </span>
                                                    {(fu.job_card.vehicle.make || fu.job_card.vehicle.model) && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {fu.job_card.vehicle.make} {fu.job_card.vehicle.model}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {fu.job_card && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs font-mono">
                                                    Job #{fu.job_card.job_number}
                                                </Badge>
                                                {fu.job_card.inspection && (
                                                    <Badge variant="outline" className="text-xs font-mono bg-indigo-50 text-indigo-700 border-indigo-200">
                                                        Insp #{fu.job_card.inspection.inspection_number}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : fu.id)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium leading-snug ${fu.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                                {fu.title}
                                            </p>
                                            {/* Faults preview */}
                                            {fu.job_card?.faults && fu.job_card.faults.length > 0 && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                    <span className="text-xs text-amber-700">
                                                        {fu.job_card.faults.length} fault{fu.job_card.faults.length > 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${statusColors[fu.status || "pending"] || ""}`}>
                                                    {(fu.status || "pending").replace("_", " ")}
                                                </Badge>
                                                <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${priorityColors[fu.priority || "medium"] || ""}`}>
                                                    {fu.priority || "medium"}
                                                </Badge>
                                                {fu.assigned_to && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Assigned: {fu.assigned_to}
                                                    </span>
                                                )}
                                                {commentCount > 0 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {commentCount} repl{commentCount > 1 ? "ies" : "y"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                                        )}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t px-4 pb-4 space-y-3">
                                        {/* Details */}
                                        <div className="pt-3 space-y-1 text-sm text-muted-foreground">
                                            {fu.description && <p className="text-foreground">{fu.description}</p>}
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                                {fu.job_card && (
                                                    <span>
                                                        Job: <strong className="text-foreground">{fu.job_card.title}</strong>
                                                    </span>
                                                )}
                                                {fu.due_date && <span>Due: {new Date(fu.due_date).toLocaleDateString()}</span>}
                                                <span>By: {fu.created_by}</span>
                                                {fu.created_at && <span>{new Date(fu.created_at).toLocaleDateString()}</span>}
                                            </div>
                                        </div>

                                        {/* Faults */}
                                        {fu.job_card?.faults && fu.job_card.faults.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    Faults ({fu.job_card.faults.length})
                                                </p>
                                                <div className="space-y-1 pl-1">
                                                    {fu.job_card.faults.map((fault) => (
                                                        <div key={fault.id} className="flex items-start gap-2 text-xs border rounded px-2 py-1.5 bg-amber-50/50">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[10px] px-1.5 py-0 shrink-0 ${fault.severity === "critical" ? "bg-red-50 text-red-700 border-red-200" :
                                                                    fault.severity === "major" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                                                                    }`}
                                                            >
                                                                {fault.severity || "unknown"}
                                                            </Badge>
                                                            <span className="text-foreground flex-1">{fault.fault_description}</span>
                                                            {fault.corrective_action_status && (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
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
                                            <div className="space-y-2 pl-3 border-l-2 border-muted">
                                                {fu.comments.map((c, i) => (
                                                    <div key={i} className="text-sm">
                                                        <p>{c.text}</p>
                                                        <span className="text-xs text-muted-foreground">
                                                            {c.author} · {new Date(c.date).toLocaleString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Reply input */}
                                        {replyingTo === fu.id ? (
                                            <div className="space-y-2">
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
                                                        <Send className="h-3.5 w-3.5 mr-1" />
                                                        Reply
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 flex-wrap">
                                                <Button variant="outline" size="sm" onClick={() => setReplyingTo(fu.id)}>
                                                    <ListPlus className="h-3.5 w-3.5 mr-1" />
                                                    Reply
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleStatusToggle(fu)}>
                                                    {fu.status === "completed" ? "Reopen" : "Mark Complete"}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(fu.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
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

export default JobCardFollowUpsTab;
