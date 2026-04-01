import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Search, Unlink, X } from "lucide-react";
import { useState } from "react";

// ─── Link Inspection to Job Card ────────────────────────────────────────────

interface LinkInspectionToJobCardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobCardId: string;
    currentInspectionId: string | null;
    onLinked: () => void;
}

export function LinkInspectionToJobCardDialog({
    open,
    onOpenChange,
    jobCardId,
    currentInspectionId,
    onLinked,
}: LinkInspectionToJobCardDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");

    const { data: inspections = [], isLoading } = useQuery({
        queryKey: ["inspections-search", search],
        queryFn: async () => {
            let query = supabase
                .from("vehicle_inspections")
                .select("id, inspection_number, inspection_date, inspection_type, vehicle_registration, inspector_name, status")
                .order("inspection_date", { ascending: false })
                .limit(20);

            if (search.trim()) {
                query = query.or(
                    `inspection_number.ilike.%${search}%,vehicle_registration.ilike.%${search}%,inspector_name.ilike.%${search}%`
                );
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        enabled: open,
    });

    const linkMutation = useMutation({
        mutationFn: async (inspectionId: string | null) => {
            const { error } = await supabase
                .from("job_cards")
                .update({ inspection_id: inspectionId })
                .eq("id", jobCardId);
            if (error) throw error;
        },
        onSuccess: (_, inspectionId) => {
            toast({
                title: inspectionId ? "Inspection Linked" : "Inspection Unlinked",
                description: inspectionId
                    ? "Inspection has been linked to this job card."
                    : "Inspection has been unlinked from this job card.",
            });
            queryClient.invalidateQueries({ queryKey: ["job_card", jobCardId] });
            queryClient.invalidateQueries({ queryKey: ["vehicle_inspection"] });
            onLinked();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update link",
                variant: "destructive",
            });
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Link Inspection to Job Card
                    </DialogTitle>
                    <DialogDescription>
                        Search for an existing inspection to link to this job card.
                    </DialogDescription>
                </DialogHeader>

                {/* Unlink current */}
                {currentInspectionId && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="self-start gap-2"
                        onClick={() => linkMutation.mutate(null)}
                        disabled={linkMutation.isPending}
                    >
                        <Unlink className="h-3.5 w-3.5" />
                        Unlink Current Inspection
                    </Button>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by number, registration, inspector..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[40vh]">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : inspections.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No inspections found</p>
                    ) : (
                        inspections.map((insp) => (
                            <button
                                key={insp.id}
                                disabled={linkMutation.isPending}
                                className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${insp.id === currentInspectionId
                                        ? "border-primary bg-primary/5"
                                        : "border-transparent hover:bg-accent"
                                    }`}
                                onClick={() => linkMutation.mutate(insp.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{insp.inspection_number}</span>
                                    <Badge variant={insp.status === "completed" ? "default" : "secondary"} className="text-xs">
                                        {insp.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    <span>{insp.vehicle_registration}</span>
                                    <span>•</span>
                                    <span>{new Date(insp.inspection_date).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{insp.inspector_name}</span>
                                </div>
                                {insp.id === currentInspectionId && (
                                    <Badge variant="outline" className="mt-1 text-xs">Currently linked</Badge>
                                )}
                            </button>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Link Job Card to Inspection ────────────────────────────────────────────

interface LinkJobCardToInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionId: string;
    onLinked: () => void;
}

export function LinkJobCardToInspectionDialog({
    open,
    onOpenChange,
    inspectionId,
    onLinked,
}: LinkJobCardToInspectionDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");

    // Fetch job cards already linked to this inspection
    const { data: linkedJobCards = [] } = useQuery({
        queryKey: ["linked-job-cards", inspectionId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("job_cards")
                .select("id, job_number, title, status, priority")
                .eq("inspection_id", inspectionId);
            if (error) throw error;
            return data || [];
        },
        enabled: open,
    });

    // Search for unlinked job cards
    const { data: jobCards = [], isLoading } = useQuery({
        queryKey: ["job-cards-search", search],
        queryFn: async () => {
            let query = supabase
                .from("job_cards")
                .select("id, job_number, title, status, priority, vehicle_id, inspection_id")
                .order("created_at", { ascending: false })
                .limit(20);

            if (search.trim()) {
                query = query.or(
                    `job_number.ilike.%${search}%,title.ilike.%${search}%,assignee.ilike.%${search}%`
                );
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        enabled: open,
    });

    const linkMutation = useMutation({
        mutationFn: async ({ jobCardId, link }: { jobCardId: string; link: boolean }) => {
            const { error } = await supabase
                .from("job_cards")
                .update({ inspection_id: link ? inspectionId : null })
                .eq("id", jobCardId);
            if (error) throw error;
        },
        onSuccess: (_, { link }) => {
            toast({
                title: link ? "Job Card Linked" : "Job Card Unlinked",
                description: link
                    ? "Job card has been linked to this inspection."
                    : "Job card has been unlinked from this inspection.",
            });
            queryClient.invalidateQueries({ queryKey: ["linked-job-cards", inspectionId] });
            queryClient.invalidateQueries({ queryKey: ["job-cards-search"] });
            onLinked();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update link",
                variant: "destructive",
            });
        },
    });

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high": case "urgent": return "destructive";
            case "medium": return "default";
            default: return "secondary";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Link Job Card to Inspection
                    </DialogTitle>
                    <DialogDescription>
                        Search for an existing job card to link, or unlink an existing one.
                    </DialogDescription>
                </DialogHeader>

                {/* Currently linked */}
                {linkedJobCards.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currently Linked</p>
                        {linkedJobCards.map((jc) => (
                            <div key={jc.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-primary/30 bg-primary/5">
                                <div>
                                    <span className="text-sm font-medium">#{jc.job_number}</span>
                                    <span className="text-sm text-muted-foreground ml-2">{jc.title}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => linkMutation.mutate({ jobCardId: jc.id, link: false })}
                                    disabled={linkMutation.isPending}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by job number, title, assignee..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[40vh]">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : jobCards.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No job cards found</p>
                    ) : (
                        jobCards.map((jc) => {
                            const isLinkedHere = jc.inspection_id === inspectionId;
                            const isLinkedElsewhere = jc.inspection_id && jc.inspection_id !== inspectionId;
                            return (
                                <button
                                    key={jc.id}
                                    disabled={linkMutation.isPending || !!isLinkedElsewhere}
                                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${isLinkedHere
                                            ? "border-primary bg-primary/5"
                                            : isLinkedElsewhere
                                                ? "border-transparent opacity-50 cursor-not-allowed"
                                                : "border-transparent hover:bg-accent"
                                        }`}
                                    onClick={() => {
                                        if (isLinkedHere) {
                                            linkMutation.mutate({ jobCardId: jc.id, link: false });
                                        } else {
                                            linkMutation.mutate({ jobCardId: jc.id, link: true });
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">#{jc.job_number}</span>
                                        <div className="flex gap-1">
                                            <Badge variant={getPriorityColor(jc.priority)} className="text-xs">{jc.priority}</Badge>
                                            <Badge variant="outline" className="text-xs">{jc.status}</Badge>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{jc.title}</p>
                                    {isLinkedHere && (
                                        <Badge variant="outline" className="mt-1 text-xs">Linked — click to unlink</Badge>
                                    )}
                                    {isLinkedElsewhere && (
                                        <Badge variant="secondary" className="mt-1 text-xs">Linked to another inspection</Badge>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
