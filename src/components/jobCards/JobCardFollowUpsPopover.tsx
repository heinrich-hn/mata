import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, ListPlus, Send, Trash2 } from "lucide-react";
import { useState } from "react";

interface FollowUp {
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
}

interface FollowUpComment {
    text: string;
    author: string;
    date: string;
}

interface JobCardFollowUpsPopoverProps {
    jobCardId: string;
    jobNumber: string;
    followUpCount: number;
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

const JobCardFollowUpsPopover = ({ jobCardId, jobNumber, followUpCount }: JobCardFollowUpsPopoverProps) => {
    const { userName } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);

    const { data: followUps = [], isLoading } = useQuery<FollowUp[]>({
        queryKey: ["job_card_followups", jobCardId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("action_items")
                .select("id, title, description, status, priority, assigned_to, due_date, created_by, created_at, comments")
                .eq("related_entity_type", "job_card")
                .eq("related_entity_id", jobCardId)
                .eq("category", "external_follow_up")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (data || []).map((item) => ({
                ...item,
                comments: parseComments(item.comments),
            })) as FollowUp[];
        },
        enabled: open,
    });

    const parseComments = (raw: unknown): FollowUpComment[] | null => {
        if (!raw) return null;
        if (Array.isArray(raw)) return raw as FollowUpComment[];
        return null;
    };

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
        queryClient.invalidateQueries({ queryKey: ["job_card_followups", jobCardId] });
    };

    const handleDeleteFollowUp = async (followUpId: string) => {
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
        queryClient.invalidateQueries({ queryKey: ["job_card_followups", jobCardId] });
        queryClient.invalidateQueries({ queryKey: ["job_cards_with_vehicles"] });
    };

    const handleStatusToggle = async (followUp: FollowUp) => {
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
        queryClient.invalidateQueries({ queryKey: ["job_card_followups", jobCardId] });
        queryClient.invalidateQueries({ queryKey: ["job_cards_with_vehicles"] });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex"
                >
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {followUpCount} Follow-up{followUpCount > 1 ? "s" : ""}
                    </Badge>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-96 p-0"
                align="start"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-3 border-b flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Follow-ups — #{jobNumber}</h4>
                </div>

                <ScrollArea className="max-h-[400px]">
                    <div className="p-3 space-y-2">
                        {isLoading ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                        ) : followUps.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No follow-ups.</p>
                        ) : (
                            followUps.map((fu) => {
                                const isExpanded = expandedId === fu.id;
                                const commentCount = fu.comments?.length || 0;

                                return (
                                    <div key={fu.id} className="border rounded-lg overflow-hidden">
                                        <button
                                            type="button"
                                            className="w-full p-2.5 text-left hover:bg-muted/50 transition-colors"
                                            onClick={() => setExpandedId(isExpanded ? null : fu.id)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium leading-snug truncate ${fu.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
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
                                                {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t px-2.5 pb-2.5 space-y-2">
                                                {/* Details */}
                                                <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                                                    {fu.description && <p className="text-foreground text-sm">{fu.description}</p>}
                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                        {fu.assigned_to && <span>Assigned: <strong className="text-foreground">{fu.assigned_to}</strong></span>}
                                                        {fu.due_date && <span>Due: {new Date(fu.due_date).toLocaleDateString()}</span>}
                                                        <span>By: {fu.created_by}</span>
                                                        {fu.created_at && <span>{new Date(fu.created_at).toLocaleDateString()}</span>}
                                                    </div>
                                                </div>

                                                {/* Replies / comments thread */}
                                                {fu.comments && fu.comments.length > 0 && (
                                                    <div className="space-y-1.5 pl-2 border-l-2 border-muted">
                                                        {fu.comments.map((c, i) => (
                                                            <div key={i} className="text-xs">
                                                                <p className="text-sm">{c.text}</p>
                                                                <span className="text-muted-foreground">
                                                                    {c.author} · {new Date(c.date).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Reply input */}
                                                {replyingTo === fu.id ? (
                                                    <div className="space-y-1.5">
                                                        <Textarea
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder="Write a reply..."
                                                            rows={2}
                                                            className="text-sm"
                                                        />
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="sm" className="h-7" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                                                                Cancel
                                                            </Button>
                                                            <Button size="sm" className="h-7" onClick={() => handleReply(fu.id)} disabled={!replyText.trim()}>
                                                                <Send className="h-3.5 w-3.5 mr-1" />
                                                                Reply
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1.5">
                                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReplyingTo(fu.id)}>
                                                            <ListPlus className="h-3 w-3 mr-1" />
                                                            Reply
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleStatusToggle(fu)}
                                                        >
                                                            {fu.status === "completed" ? "Reopen" : "Mark Complete"}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs text-destructive hover:text-destructive"
                                                            onClick={() => handleDeleteFollowUp(fu.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

export default JobCardFollowUpsPopover;
