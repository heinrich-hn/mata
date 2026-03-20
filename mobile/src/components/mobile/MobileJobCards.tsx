import JobCardDetailsDialog from "@/components/dialogs/JobCardDetailsDialog";
import AddJobCardDialog from "@/components/dialogs/AddJobCardDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";

// ============================================================================
// Types & Constants
// ============================================================================
interface JobCard {
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
  partsSummary?: {
    count: number;
    latestIrNumber: string | null;
    latestPartName: string | null;
  };
}

interface PriorityFilter {
  value: string;
  label: string;
  color: string;
  borderColor: string;
}

const PRIORITY_FILTERS: PriorityFilter[] = [
  { value: "all", label: "All", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100", borderColor: "border-gray-300 dark:border-gray-600" },
  { value: "urgent", label: "Urgent", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200", borderColor: "border-rose-300 dark:border-rose-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200", borderColor: "border-orange-300 dark:border-orange-700" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200", borderColor: "border-blue-300 dark:border-blue-700" },
  { value: "low", label: "Low", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100", borderColor: "border-gray-300 dark:border-gray-600" },
];

const STATUS_CONFIG = {
  pending: {
    variant: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  in_progress: {
    variant: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700",
    dot: "bg-blue-500",
  },
  completed: {
    variant: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
  on_hold: {
    variant: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700",
    dot: "bg-orange-500",
  },
} as const;

const PRIORITY_COLORS = {
  urgent: "#f43f5e",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#9ca3af",
} as const;

const PRIORITY_BG = {
  urgent: "bg-gradient-to-r from-rose-50 to-transparent dark:from-rose-950/30 dark:to-transparent",
  high: "bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/30 dark:to-transparent",
  medium: "bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/30 dark:to-transparent",
  low: "bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-900/30 dark:to-transparent",
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

// ============================================================================
// Sub-components
// ============================================================================
const StatusBadge = ({ status }: { status: string }) => {
  const normalizedStatus = status?.toLowerCase().replace(" ", "_") as StatusKey;
  const config = STATUS_CONFIG[normalizedStatus] || {
    variant: "bg-gray-50 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600",
    dot: "bg-gray-500",
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
        filter?.color || "bg-gray-100 text-gray-700"
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

const EmptyState = ({
  title,
  message,
  action,
  showAction = true
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
  showAction?: boolean;
}) => (
  <div className="text-center py-16 px-6">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 mx-auto mb-5 flex items-center justify-center">
      <span className="text-2xl font-bold text-muted-foreground/40">0</span>
    </div>
    <h3 className="font-bold text-base mb-1.5">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed mb-5">{message}</p>
    {showAction && action}
  </div>
);

const JobCardItem = ({
  card,
  onClick
}: {
  card: JobCard;
  onClick: (card: JobCard) => void;
}) => {
  const borderColor = PRIORITY_COLORS[card.priority?.toLowerCase() as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.low;
  const bgClass = PRIORITY_BG[card.priority?.toLowerCase() as keyof typeof PRIORITY_BG] || "";

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(card);
    }
  }, [onClick, card]);

  return (
    <Card
      className={cn(
        "active:scale-[0.98] transition-all cursor-pointer border border-border/40 shadow-sm hover:shadow-md border-l-4 touch-target rounded-2xl overflow-hidden",
        bgClass
      )}
      style={{ borderLeftColor: borderColor }}
      onClick={() => onClick(card)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-muted-foreground font-semibold bg-muted/60 px-1.5 py-0.5 rounded">
                #{card.job_number}
              </span>
              <StatusBadge status={card.status} />
            </div>
            <p className="font-bold text-sm leading-snug line-clamp-2">{card.title}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-xs text-muted-foreground">
          {card.vehicle && (
            <span className="font-semibold text-foreground bg-muted/50 px-2 py-0.5 rounded-md">
              {card.vehicle.fleet_number || card.vehicle.registration_number}
            </span>
          )}
          {card.assignee && (
            <span className="truncate max-w-[120px]">{card.assignee}</span>
          )}
          {card.due_date && (
            <span className="tabular-nums">
              {new Date(card.due_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {card.inspection && (
            <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-1.5 py-0.5 rounded">
              {card.inspection.inspection_number}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
          <PriorityBadge priority={card.priority} />

          {card.partsSummary && card.partsSummary.count > 0 && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-muted/50 rounded-lg font-semibold">
              {card.partsSummary.count} part{card.partsSummary.count > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================
const MobileJobCards = () => {
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch job cards with related data
  const {
    data: jobCards = [],
    refetch,
    isLoading,
    error
  } = useQuery({
    queryKey: ["job_cards_mobile"],
    queryFn: async () => {
      const { data: baseJobCards, error } = await supabase
        .from("job_cards")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const cards = baseJobCards || [];
      if (cards.length === 0) return [] as JobCard[];

      const vehicleIds = [...new Set(cards.map(c => c.vehicle_id).filter(Boolean))] as string[];
      const inspectionIds = [...new Set(cards.map(c => c.inspection_id).filter(Boolean))] as string[];
      const jobCardIds = cards.map(c => c.id);

      const [vehiclesResult, inspectionsResult, partsResult] = await Promise.all([
        vehicleIds.length > 0
          ? supabase.from("vehicles").select("id, fleet_number, registration_number").in("id", vehicleIds)
          : { data: [], error: null },
        inspectionIds.length > 0
          ? supabase.from("vehicle_inspections").select("id, inspection_number, inspection_type, inspection_date").in("id", inspectionIds)
          : { data: [], error: null },
        jobCardIds.length > 0
          ? supabase.from("parts_requests").select("job_card_id, part_name, ir_number, created_at, ordered_at").in("job_card_id", jobCardIds)
          : { data: [], error: null },
      ]);

      const vehicleMap = new Map((vehiclesResult.data || []).map(v => [v.id, v]));
      const inspectionMap = new Map((inspectionsResult.data || []).map(i => [i.id, i]));

      const partsSummaryMap = new Map<string, { count: number; latestIrNumber: string | null; latestPartName: string | null }>();
      for (const part of (partsResult.data || []) as { job_card_id: string | null; part_name: string | null; ir_number: string | null; created_at: string; ordered_at: string | null }[]) {
        if (!part.job_card_id) continue;
        const existing = partsSummaryMap.get(part.job_card_id) || { count: 0, latestIrNumber: null, latestPartName: null };
        existing.count += 1;
        if (part.ir_number) existing.latestIrNumber = part.ir_number;
        if (part.part_name) existing.latestPartName = part.part_name;
        partsSummaryMap.set(part.job_card_id, existing);
      }

      return cards.map(card => ({
        ...card,
        vehicle: card.vehicle_id ? vehicleMap.get(card.vehicle_id) || null : null,
        inspection: card.inspection_id ? inspectionMap.get(card.inspection_id) || null : null,
        partsSummary: partsSummaryMap.get(card.id) || { count: 0, latestIrNumber: null, latestPartName: null },
      })) as JobCard[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Memoized filtered cards
  const filteredCards = useMemo(() => {
    if (!debouncedSearchTerm && selectedPriority === "all") return jobCards;

    return jobCards.filter((card) => {
      // Search filter
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        const matchesSearch =
          card.title?.toLowerCase().includes(term) ||
          card.job_number?.toLowerCase().includes(term) ||
          card.vehicle?.fleet_number?.toLowerCase().includes(term) ||
          card.vehicle?.registration_number?.toLowerCase().includes(term) ||
          card.assignee?.toLowerCase().includes(term);

        if (!matchesSearch) return false;
      }

      // Priority filter
      if (selectedPriority !== "all") {
        const cardPriority = card.priority?.toLowerCase();
        if (cardPriority !== selectedPriority.toLowerCase()) return false;
      }

      return true;
    });
  }, [jobCards, debouncedSearchTerm, selectedPriority]);

  // Memoized grouped cards
  const activeCards = useMemo(
    () => filteredCards.filter(c => {
      const status = c.status?.toLowerCase().replace(" ", "_");
      return status === "pending" || status === "in_progress";
    }),
    [filteredCards]
  );

  const completedCards = useMemo(
    () => filteredCards.filter(c => c.status?.toLowerCase() === "completed"),
    [filteredCards]
  );

  // Handlers
  const handleJobClick = useCallback((job: JobCard) => {
    setSelectedJob(job);
    setDialogOpen(true);
  }, []);

  const handleClearSearch = useCallback(() => setSearchTerm(""), []);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full rounded-2xl border border-border/40">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 mx-auto mb-4 flex items-center justify-center">
              <span className="text-rose-600 font-bold text-lg">!</span>
            </div>
            <h3 className="font-bold mb-2 text-base">Failed to load job cards</h3>
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
    <div className="px-4 py-4 space-y-4 pb-safe-bottom">
      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Search jobs, vehicles, assignees…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1 pl-4 pr-10"
              aria-label="Search job cards"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 rounded-lg text-xs text-muted-foreground"
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
              showFilters && "bg-primary text-primary-foreground"
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
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted"
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
        <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger
            value="active"
            className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            Active
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 font-bold">
              {activeCards.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            className="text-xs font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm touch-target"
          >
            Completed
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 font-bold">
              {completedCards.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-3 space-y-2.5">
          {isLoading ? (
            <div className="space-y-2.5">
              <JobCardSkeleton />
              <JobCardSkeleton />
              <JobCardSkeleton />
            </div>
          ) : activeCards.length === 0 ? (
            <EmptyState
              title="No active jobs"
              message={searchTerm || selectedPriority !== "all"
                ? "Try adjusting your filters"
                : "Create your first job card to get started"}
              action={
                !searchTerm && selectedPriority === "all" ? (
                  <Button onClick={() => setShowAddDialog(true)} className="rounded-xl font-semibold">
                    + New Job Card
                  </Button>
                ) : undefined
              }
              showAction={!searchTerm && selectedPriority === "all"}
            />
          ) : (
            activeCards.map((card) => (
              <JobCardItem key={card.id} card={card} onClick={handleJobClick} />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-3 space-y-2.5">
          {completedCards.length === 0 ? (
            <EmptyState
              title="No completed jobs"
              message="Completed job cards will appear here"
              showAction={false}
            />
          ) : (
            completedCards.map((card) => (
              <JobCardItem key={card.id} card={card} onClick={handleJobClick} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* FAB - New Job Card */}
      <Button
        className="fixed bottom-6 right-4 h-14 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform z-20 touch-target px-5 font-bold text-sm"
        onClick={() => setShowAddDialog(true)}
        aria-label="New job card"
      >
        + New
      </Button>

      {/* Dialogs */}
      <JobCardDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobCard={selectedJob}
        onUpdate={refetch}
      />

      <AddJobCardDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            refetch();
          }
        }}
      />
    </div>
  );
};

export default MobileJobCards;