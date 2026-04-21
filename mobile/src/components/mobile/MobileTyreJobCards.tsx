import JobCardDetailsDialog from "@/components/dialogs/JobCardDetailsDialog";
import WorkerDashboardSheet from "@/components/WorkerDashboardSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
    Archive as ArchiveIcon,
    ChevronDown,
    CircleDot,
    Eye,
    MoreVertical,
    Pencil,
    Share2,
    Trash2,
    Users,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";

// ============================================================================
// Types & Constants
// ============================================================================
interface TyreJobCard {
    id: string;
    job_number: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignee: string | null;
    due_date: string | null;
    vehicle_id: string | null;
    inspection_id: string | null;
    created_at: string;
    updated_at: string;
    archived_at?: string | null;
    [key: string]: unknown;
    vehicle?: {
        id: string;
        fleet_number: string | null;
        registration_number: string;
    } | null;
    inspection?: {
        id: string;
        inspection_number: string;
        inspection_type: string | null;
        inspection_date: string | null;
    } | null;
}

interface PriorityFilter {
    value: string;
    label: string;
    color: string;
}

const PRIORITY_FILTERS: PriorityFilter[] = [
    { value: "all", label: "All", color: "bg-muted text-muted-foreground" },
    { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" },
    { value: "high", label: "High", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
    { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" },
    { value: "low", label: "Low", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300" },
];

const STATUS_CONFIG = {
    pending: {
        variant: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
        dot: "bg-amber-500",
    },
    in_progress: {
        variant: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700",
        dot: "bg-blue-500",
    },
    completed: {
        variant: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700",
        dot: "bg-emerald-500",
    },
    on_hold: {
        variant: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700",
        dot: "bg-orange-500",
    },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

// ============================================================================
// Sub-components
// ============================================================================
const StatusBadge = ({ status }: { status: string }) => {
    const normalizedStatus = status?.toLowerCase().replace(" ", "_") as StatusKey;
    const config = STATUS_CONFIG[normalizedStatus] || {
        variant: "bg-muted text-muted-foreground border-border dark:bg-muted/50",
        dot: "bg-muted-foreground",
    };

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                config.variant
            )}
        >
            <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
            <span className="capitalize">{status?.replace("_", " ")}</span>
        </div>
    );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
    const normalizedPriority = priority?.toLowerCase();
    const filter = PRIORITY_FILTERS.find(f => f.value === normalizedPriority);

    return (
        <Badge
            variant="outline"
            className={cn(
                "text-[10px] px-2 py-0.5 font-semibold rounded-lg",
                filter?.color || "bg-muted text-muted-foreground"
            )}
        >
            {priority}
        </Badge>
    );
};

const JobCardSkeleton = () => (
    <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1">
                    <Skeleton className="h-3 w-24 mb-2 rounded-lg" />
                    <Skeleton className="h-4 w-40 rounded-lg" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-3">
                <Skeleton className="h-3 w-20 rounded-lg" />
                <Skeleton className="h-3 w-24 rounded-lg" />
                <Skeleton className="h-3 w-16 rounded-lg" />
            </div>
        </CardContent>
    </Card>
);

const EmptyState = ({ title, message }: { title: string; message: string }) => (
    <div className="text-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 mx-auto mb-5 flex items-center justify-center">
            <CircleDot className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <h3 className="font-bold text-base mb-1.5 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
    </div>
);

const PRIORITY_BORDER_COLORS = {
    urgent: "border-l-rose-500",
    high: "border-l-amber-500",
    medium: "border-l-blue-500",
    low: "border-l-gray-400",
} as const;

const TyreJobCardItem = ({
    card,
    onClick,
    onMenu,
}: {
    card: TyreJobCard;
    onClick: (card: TyreJobCard) => void;
    onMenu: (card: TyreJobCard) => void;
}) => {
    const borderClass = PRIORITY_BORDER_COLORS[card.priority?.toLowerCase() as keyof typeof PRIORITY_BORDER_COLORS] || "border-l-gray-400";

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(card);
            }
        },
        [onClick, card]
    );

    return (
        <Card
            className={cn(
                "active:scale-[0.98] transition-all cursor-pointer rounded-2xl shadow-sm hover:shadow-md border border-border/40 border-l-4 touch-target",
                borderClass
            )}
            onClick={() => onClick(card)}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">#{card.job_number}</span>
                            <PriorityBadge priority={card.priority} />
                        </div>
                        <p className="text-sm font-bold truncate">{card.title}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <StatusBadge status={card.status} />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 -mr-1.5 touch-target"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMenu(card);
                            }}
                            aria-label="Tyre job card actions"
                        >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {card.vehicle && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/60 font-medium truncate max-w-[140px]">
                            {card.vehicle.fleet_number || card.vehicle.registration_number}
                        </span>
                    )}
                    {card.assignee && <span className="truncate max-w-[120px]">{card.assignee}</span>}
                    {card.due_date && (
                        <span>
                            {new Date(card.due_date).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                            })}
                        </span>
                    )}
                    {card.inspection && (
                        <span className="font-mono text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-1.5 py-0.5 rounded">
                            {card.inspection.inspection_number}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// ============================================================================
// Main Component
// ============================================================================
const MobileTyreJobCards = () => {
    const { toast } = useToast();
    const [selectedJob, setSelectedJob] = useState<TyreJobCard | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [viewInitialEditMode, setViewInitialEditMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPriority, setSelectedPriority] = useState<string>("all");
    const [showFilters, setShowFilters] = useState(false);
    // Action menu state
    const [actionsCard, setActionsCard] = useState<TyreJobCard | null>(null);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [workerJob, setWorkerJob] = useState<TyreJobCard | null>(null);
    const [workerOpen, setWorkerOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [jobToArchive, setJobToArchive] = useState<TyreJobCard | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState<TyreJobCard | null>(null);

    // Fetch tyre job cards (linked to tyre inspections)
    const {
        data: tyreJobCards = [],
        refetch,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["tyre_job_cards_mobile"],
        queryFn: async () => {
            // Get tyre inspection IDs
            const { data: tyreInspections, error: inspError } = await supabase
                .from("vehicle_inspections")
                .select("id")
                .eq("inspection_type", "tyre");

            if (inspError) throw inspError;

            const tyreInspectionIds = (tyreInspections || []).map((i) => i.id);
            if (tyreInspectionIds.length === 0) return [];

            // Fetch job cards linked to tyre inspections
            const { data: cards, error: cardsError } = await supabase
                .from("job_cards")
                .select("*")
                .in("inspection_id", tyreInspectionIds)
                .order("created_at", { ascending: false });

            if (cardsError) throw cardsError;
            if (!cards || cards.length === 0) return [] as TyreJobCard[];

            const vehicleIds = [...new Set(cards.map((c) => c.vehicle_id).filter(Boolean))] as string[];
            const inspectionIds = [...new Set(cards.map((c) => c.inspection_id).filter(Boolean))] as string[];

            const [vehiclesResult, inspectionsResult] = await Promise.all([
                vehicleIds.length > 0
                    ? supabase.from("vehicles").select("id, fleet_number, registration_number").in("id", vehicleIds)
                    : { data: [], error: null },
                inspectionIds.length > 0
                    ? supabase
                        .from("vehicle_inspections")
                        .select("id, inspection_number, inspection_type, inspection_date")
                        .in("id", inspectionIds)
                    : { data: [], error: null },
            ]);

            const vehicleMap = new Map((vehiclesResult.data || []).map((v) => [v.id, v]));
            const inspectionMap = new Map((inspectionsResult.data || []).map((i) => [i.id, i]));

            return cards.map((card) => ({
                ...card,
                vehicle: card.vehicle_id ? vehicleMap.get(card.vehicle_id) || null : null,
                inspection: card.inspection_id ? inspectionMap.get(card.inspection_id) || null : null,
            })) as TyreJobCard[];
        },
        staleTime: 30000,
        gcTime: 300000,
    });

    // Memoized filtered cards
    const filteredCards = useMemo(() => {
        if (!searchTerm && selectedPriority === "all") return tyreJobCards;

        return tyreJobCards.filter((card) => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesSearch =
                    card.title?.toLowerCase().includes(term) ||
                    card.job_number?.toLowerCase().includes(term) ||
                    card.vehicle?.fleet_number?.toLowerCase().includes(term) ||
                    card.vehicle?.registration_number?.toLowerCase().includes(term) ||
                    card.assignee?.toLowerCase().includes(term);
                if (!matchesSearch) return false;
            }
            if (selectedPriority !== "all" && card.priority?.toLowerCase() !== selectedPriority.toLowerCase()) return false;
            return true;
        });
    }, [tyreJobCards, searchTerm, selectedPriority]);

    const nonArchivedCards = useMemo(() => filteredCards.filter((c) => !c.archived_at), [filteredCards]);
    const archivedCards = useMemo(() => filteredCards.filter((c) => !!c.archived_at), [filteredCards]);

    const activeCards = useMemo(
        () =>
            nonArchivedCards.filter((c) => {
                const status = c.status?.toLowerCase().replace(" ", "_");
                return status === "pending" || status === "in_progress";
            }),
        [nonArchivedCards]
    );

    const completedCards = useMemo(
        () => nonArchivedCards.filter((c) => c.status?.toLowerCase() === "completed"),
        [nonArchivedCards]
    );

    // Category sort helpers
    const categoryOrder: Record<string, number> = useMemo(() => ({ H: 0, F: 1, L: 2, T: 3 }), []);
    const getFleetSuffix = useCallback((fn: string) => {
        const match = fn.match(/[A-Z]$/i);
        return match ? match[0].toUpperCase() : "";
    }, []);

    const groupJobCards = useCallback(
        (cards: TyreJobCard[]) => {
            const groups = new Map<string, { vehicle: TyreJobCard["vehicle"]; cards: TyreJobCard[] }>();
            for (const card of cards) {
                const key = card.vehicle_id || "unknown";
                if (!groups.has(key)) groups.set(key, { vehicle: card.vehicle, cards: [] });
                groups.get(key)!.cards.push(card);
            }
            return Array.from(groups.values()).sort((a, b) => {
                const fa = a.vehicle?.fleet_number || "";
                const fb = b.vehicle?.fleet_number || "";
                const catA = categoryOrder[getFleetSuffix(fa)] ?? 99;
                const catB = categoryOrder[getFleetSuffix(fb)] ?? 99;
                if (catA !== catB) return catA - catB;
                return fa.localeCompare(fb, undefined, { numeric: true });
            });
        },
        [categoryOrder, getFleetSuffix]
    );

    const groupedActive = useMemo(() => groupJobCards(activeCards), [groupJobCards, activeCards]);
    const groupedCompleted = useMemo(() => groupJobCards(completedCards), [groupJobCards, completedCards]);
    const groupedArchived = useMemo(() => groupJobCards(archivedCards), [groupJobCards, archivedCards]);

    const handleJobClick = useCallback((job: TyreJobCard) => {
        setSelectedJob(job);
        setViewInitialEditMode(false);
        setDialogOpen(true);
    }, []);

    const openActions = useCallback((card: TyreJobCard) => {
        setActionsCard(card);
        setActionsOpen(true);
    }, []);

    const closeActionsAnd = useCallback((fn: () => void) => {
        setActionsOpen(false);
        setTimeout(fn, 150);
    }, []);

    const handleView = () => {
        if (!actionsCard) return;
        const card = actionsCard;
        closeActionsAnd(() => {
            setSelectedJob(card);
            setViewInitialEditMode(false);
            setDialogOpen(true);
        });
    };

    const handleUpdate = () => {
        if (!actionsCard) return;
        const card = actionsCard;
        closeActionsAnd(() => {
            setSelectedJob(card);
            setViewInitialEditMode(true);
            setDialogOpen(true);
        });
    };

    const handleWorkerDashboard = () => {
        if (!actionsCard) return;
        const card = actionsCard;
        closeActionsAnd(() => {
            setWorkerJob(card);
            setWorkerOpen(true);
        });
    };

    const handleShare = async () => {
        if (!actionsCard) return;
        const card = actionsCard;
        const shareText = `Tyre Job Card #${card.job_number}\n${card.title}\nStatus: ${card.status}\nPriority: ${card.priority}${card.assignee ? `\nAssignee: ${card.assignee}` : ""}${card.due_date ? `\nDue: ${new Date(card.due_date).toLocaleDateString("en-GB")}` : ""}`;
        closeActionsAnd(async () => {
            const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> };
            if (nav.share) {
                try {
                    await nav.share({ title: `Tyre Job Card #${card.job_number}`, text: shareText });
                } catch {
                    // user cancelled
                }
            } else if (navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(shareText);
                    toast({ title: "Copied to clipboard", description: "Tyre job card summary copied." });
                } catch {
                    toast({ title: "Sharing not available", variant: "destructive" });
                }
            }
        });
    };

    const handleArchiveOpen = () => {
        if (!actionsCard) return;
        const card = actionsCard;
        closeActionsAnd(() => {
            setJobToArchive(card);
            setArchiveOpen(true);
        });
    };

    const handleDeleteOpen = () => {
        if (!actionsCard) return;
        const card = actionsCard;
        closeActionsAnd(() => {
            setJobToDelete(card);
            setDeleteOpen(true);
        });
    };

    const handleArchiveConfirm = async () => {
        if (!jobToArchive) return;
        const isArchived = !!jobToArchive.archived_at;
        try {
            const { error } = await supabase
                .from("job_cards")
                .update({ archived_at: isArchived ? null : new Date().toISOString() } as never)
                .eq("id", jobToArchive.id);
            if (error) throw error;
            toast({
                title: isArchived ? "Restored" : "Archived",
                description: `Tyre job card #${jobToArchive.job_number} ${isArchived ? "restored" : "archived"}.`,
            });
            refetch();
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to update archive status", variant: "destructive" });
        } finally {
            setArchiveOpen(false);
            setJobToArchive(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!jobToDelete) return;
        try {
            const { error } = await supabase.from("job_cards").delete().eq("id", jobToDelete.id);
            if (error) throw error;
            toast({ title: "Deleted", description: `Tyre job card #${jobToDelete.job_number} deleted.` });
            refetch();
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to delete tyre job card", variant: "destructive" });
        } finally {
            setDeleteOpen(false);
            setJobToDelete(null);
        }
    };

    const handleClearSearch = useCallback(() => setSearchTerm(""), []);

    if (error) {
        return (
            <div className="flex items-center justify-center p-4">
                <Card className="max-w-sm w-full rounded-2xl border border-border/40">
                    <CardContent className="p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-destructive/10 mx-auto mb-4 flex items-center justify-center">
                            <span className="text-destructive font-bold text-lg">!</span>
                        </div>
                        <h3 className="font-bold mb-2 text-foreground text-base">Failed to load tyre job cards</h3>
                        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                            {error instanceof Error ? error.message : "Please try again later"}
                        </p>
                        <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-purple-600" />
                <h2 className="font-bold text-base">Tyre Job Cards</h2>
                <Badge variant="secondary" className="text-[10px] px-1.5 font-bold">
                    {tyreJobCards.length}
                </Badge>
            </div>

            {/* Search & Filters */}
            <div className="space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            placeholder="Search tyre jobs, vehicles…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-11 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary pl-4 pr-10 text-foreground placeholder:text-muted-foreground"
                            aria-label="Search tyre job cards"
                        />
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleClearSearch}
                                aria-label="Clear search"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                    <Button
                        variant={showFilters ? "default" : "outline"}
                        size="sm"
                        className={cn(
                            "h-11 px-4 flex-shrink-0 rounded-xl touch-target font-semibold text-xs",
                            showFilters && "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                        onClick={() => setShowFilters(!showFilters)}
                        aria-label="Toggle filters"
                    >
                        Filter
                    </Button>
                </div>

                {showFilters && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {PRIORITY_FILTERS.map((filter) => (
                            <Button
                                key={filter.value}
                                variant={selectedPriority === filter.value ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                    "text-xs h-9 px-4 flex-shrink-0 rounded-xl transition-all touch-target font-semibold",
                                    selectedPriority === filter.value
                                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                                        : "hover:bg-muted text-foreground"
                                )}
                                onClick={() => setSelectedPriority(filter.value)}
                            >
                                {filter.label}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 rounded-2xl bg-muted/50 p-1">
                    <TabsTrigger
                        value="active"
                        className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target text-foreground data-[state=active]:text-primary"
                    >
                        Active
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 font-bold bg-muted text-muted-foreground">
                            {activeCards.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                        value="completed"
                        className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target text-foreground data-[state=active]:text-primary"
                    >
                        Done
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 font-bold bg-muted text-muted-foreground">
                            {completedCards.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                        value="archived"
                        className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target text-foreground data-[state=active]:text-primary"
                    >
                        Archive
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 font-bold bg-muted text-muted-foreground">
                            {archivedCards.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-3 space-y-3">
                    {isLoading ? (
                        <div className="space-y-2">
                            <JobCardSkeleton />
                            <JobCardSkeleton />
                            <JobCardSkeleton />
                        </div>
                    ) : activeCards.length === 0 ? (
                        <EmptyState
                            title="No active tyre jobs"
                            message={
                                searchTerm || selectedPriority !== "all"
                                    ? "Try adjusting your filters"
                                    : "Tyre job cards from tyre inspections will appear here"
                            }
                        />
                    ) : (
                        groupedActive.map((group) => {
                            const label = group.vehicle
                                ? `${group.vehicle.fleet_number || ""} ${group.vehicle.registration_number ? `(${group.vehicle.registration_number})` : ""}`.trim()
                                : "No Vehicle";
                            return (
                                <Collapsible key={group.vehicle?.id || "unknown"}>
                                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors group">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-bold truncate">{label}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 rounded-lg">
                                                {group.cards.length}
                                            </Badge>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-2 mt-2">
                                        {group.cards.map((card) => (
                                            <TyreJobCardItem key={card.id} card={card} onClick={handleJobClick} onMenu={openActions} />
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        })
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-3 space-y-3">
                    {completedCards.length === 0 ? (
                        <EmptyState title="No completed tyre jobs" message="Completed tyre job cards will appear here" />
                    ) : (
                        groupedCompleted.map((group) => {
                            const label = group.vehicle
                                ? `${group.vehicle.fleet_number || ""} ${group.vehicle.registration_number ? `(${group.vehicle.registration_number})` : ""}`.trim()
                                : "No Vehicle";
                            return (
                                <Collapsible key={group.vehicle?.id || "unknown"}>
                                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors group">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-bold truncate">{label}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 rounded-lg">
                                                {group.cards.length}
                                            </Badge>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-2 mt-2">
                                        {group.cards.map((card) => (
                                            <TyreJobCardItem key={card.id} card={card} onClick={handleJobClick} onMenu={openActions} />
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        })
                    )}
                </TabsContent>

                <TabsContent value="archived" className="mt-3 space-y-3">
                    {archivedCards.length === 0 ? (
                        <EmptyState title="No archived tyre jobs" message="Archived tyre job cards will appear here" />
                    ) : (
                        groupedArchived.map((group) => {
                            const label = group.vehicle
                                ? `${group.vehicle.fleet_number || ""} ${group.vehicle.registration_number ? `(${group.vehicle.registration_number})` : ""}`.trim()
                                : "No Vehicle";
                            return (
                                <Collapsible key={group.vehicle?.id || "unknown"}>
                                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted transition-colors group">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <ArchiveIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="text-sm font-bold truncate">{label}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 rounded-lg">
                                                {group.cards.length}
                                            </Badge>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-2 mt-2">
                                        {group.cards.map((card) => (
                                            <TyreJobCardItem key={card.id} card={card} onClick={handleJobClick} onMenu={openActions} />
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        })
                    )}
                </TabsContent>
            </Tabs>

            {/* Details Dialog */}
            <JobCardDetailsDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                jobCard={selectedJob}
                onUpdate={refetch}
                initialEditMode={viewInitialEditMode}
            />

            {/* Actions Sheet */}
            <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-safe-bottom">
                    <SheetHeader className="px-4 pb-3 text-left">
                        <SheetTitle className="text-sm font-bold truncate">
                            {actionsCard ? `#${actionsCard.job_number} · ${actionsCard.title}` : "Actions"}
                        </SheetTitle>
                    </SheetHeader>
                    <div className="divide-y divide-border">
                        <ActionRow icon={<Users className="h-5 w-5 text-amber-500" />} label="Worker Dashboard" onClick={handleWorkerDashboard} />
                        <ActionRow icon={<Eye className="h-5 w-5 text-blue-500" />} label="View" onClick={handleView} />
                        <ActionRow icon={<Pencil className="h-5 w-5 text-emerald-500" />} label="Update" onClick={handleUpdate} />
                        <ActionRow icon={<Share2 className="h-5 w-5 text-indigo-500" />} label="Share" onClick={handleShare} />
                        <ActionRow
                            icon={<ArchiveIcon className="h-5 w-5 text-muted-foreground" />}
                            label={actionsCard?.archived_at ? "Restore" : "Archive"}
                            onClick={handleArchiveOpen}
                        />
                        <ActionRow icon={<Trash2 className="h-5 w-5 text-destructive" />} label="Delete Job Card" onClick={handleDeleteOpen} destructive />
                    </div>
                </SheetContent>
            </Sheet>

            <WorkerDashboardSheet
                open={workerOpen}
                onOpenChange={setWorkerOpen}
                jobCard={workerJob ? {
                    id: workerJob.id,
                    job_number: workerJob.job_number,
                    title: workerJob.title,
                    assignee: workerJob.assignee,
                    status: workerJob.status,
                } : null}
            />

            <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                <AlertDialogContent className="max-w-[90vw] rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {jobToArchive?.archived_at ? "Restore tyre job card?" : "Archive tyre job card?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {jobToArchive?.archived_at
                                ? `Tyre job card #${jobToArchive?.job_number} will return to active lists.`
                                : `Tyre job card #${jobToArchive?.job_number} will be hidden. You can restore it from the Archive tab.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveConfirm}>
                            {jobToArchive?.archived_at ? "Restore" : "Archive"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent className="max-w-[90vw] rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete tyre job card?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes job card #{jobToDelete?.job_number}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteConfirm}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

function ActionRow({
    icon,
    label,
    onClick,
    destructive,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    destructive?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 w-full px-4 py-4 text-left active:bg-muted/60 transition-colors touch-target",
                destructive && "text-destructive"
            )}
        >
            <span className="shrink-0">{icon}</span>
            <span className="text-sm font-semibold">{label}</span>
        </button>
    );
}

export default MobileTyreJobCards;
