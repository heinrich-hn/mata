import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    ListPlus,
    Search,
    Send,
    Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";

interface FollowUpComment {
    text: string;
    author: string;
    date: string;
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
        vehicle?: {
            registration_number: string;
            fleet_number: string | null;
        } | null;
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

const MobileFollowUps = () => {
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

            const entityIds = [...new Set((data || []).map((d) => d.related_entity_id).filter(Boolean))];
            let jobCardsMap: Record<string, { job_number: string; title: string; vehicle?: { registration_number: string; fleet_number: string | null } | null }> = {};

            if (entityIds.length > 0) {
                const { data: jobCards } = await supabase
                    .from("job_cards")
                    .select("id, job_number, title, vehicle:vehicles(registration_number, fleet_number)")
                    .in("id", entityIds);

                if (jobCards) {
                    jobCardsMap = Object.fromEntries(
                        jobCards.map((jc) => [
                            jc.id,
                            {
                                job_number: jc.job_number,
                                title: jc.title,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                vehicle: (jc.vehicle as any) || null,
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
    };

    const statusFilterButtons = [
        { value: "all", label: "All" },
        { value: "pending", label: "Pending" },
        { value: "completed", label: "Done" },
    ];

    return (
        <div className="px-4 py-4 space-y-4">
            {/* Header with count */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold">Follow-ups</h2>
                    <p className="text-xs text-muted-foreground">
                        {pendingCount} pending · {followUps.length} total
                    </p>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {followUps.length}
                </Badge>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search follow-ups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Status filter pills */}
            <div className="flex gap-2">
                {statusFilterButtons.map((sf) => (
                    <Button
                        key={sf.value}
                        variant={statusFilter === sf.value ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setStatusFilter(sf.value)}
                    >
                        {sf.label}
                    </Button>
                ))}
            </div>

            {/* Follow-ups list */}
            {isLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Loading follow-ups...</div>
            ) : filteredFollowUps.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ExternalLink className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                            {searchQuery || statusFilter !== "all" ? "No matching follow-ups." : "No follow-up questions yet."}
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
                                <button
                                    type="button"
                                    className="w-full p-3 text-left active:bg-muted/50 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : fu.id)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                {fu.job_card && (
                                                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                                        #{fu.job_card.job_number}
                                                    </Badge>
                                                )}
                                                {fu.job_card?.vehicle && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                        {fu.job_card.vehicle.fleet_number || fu.job_card.vehicle.registration_number}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className={`text-sm font-medium leading-snug ${fu.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                                {fu.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[fu.status || "pending"] || ""}`}>
                                                    {(fu.status || "pending").replace("_", " ")}
                                                </Badge>
                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[fu.priority || "medium"] || ""}`}>
                                                    {fu.priority || "medium"}
                                                </Badge>
                                                {commentCount > 0 && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {commentCount} repl{commentCount > 1 ? "ies" : "y"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t px-3 pb-3 space-y-2.5">
                                        {/* Details */}
                                        <div className="pt-2 space-y-1 text-sm text-muted-foreground">
                                            {fu.description && <p className="text-foreground">{fu.description}</p>}
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                                                {fu.assigned_to && (
                                                    <span>Assigned: <strong className="text-foreground">{fu.assigned_to}</strong></span>
                                                )}
                                                {fu.due_date && <span>Due: {new Date(fu.due_date).toLocaleDateString()}</span>}
                                                <span>By: {fu.created_by}</span>
                                                {fu.created_at && <span>{new Date(fu.created_at).toLocaleDateString()}</span>}
                                            </div>
                                        </div>

                                        {/* Comments thread */}
                                        {fu.comments && fu.comments.length > 0 && (
                                            <div className="space-y-1.5 pl-2 border-l-2 border-muted">
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
                                                    <Button variant="ghost" size="sm" className="h-8" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                                                        Cancel
                                                    </Button>
                                                    <Button size="sm" className="h-8" onClick={() => handleReply(fu.id)} disabled={!replyText.trim()}>
                                                        <Send className="h-3.5 w-3.5 mr-1" />
                                                        Reply
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-1.5 flex-wrap">
                                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setReplyingTo(fu.id)}>
                                                    <ListPlus className="h-3 w-3 mr-1" />
                                                    Reply
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleStatusToggle(fu)}>
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    {fu.status === "completed" ? "Reopen" : "Complete"}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(fu.id)}
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1" />
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
