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
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Plus,
  Search,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";

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
}

const priorityFilters: PriorityFilter[] = [
  { value: "all", label: "All", color: "bg-gray-100 text-gray-700" },
  { value: "urgent", label: "Urgent", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "low", label: "Low", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

const JobCardSkeleton = () => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    on_hold: "bg-orange-50 text-orange-700 border-orange-200",
  };

  const icons: Record<string, React.ElementType> = {
    pending: Clock,
    in_progress: Clock,
    completed: CheckCircle2,
    on_hold: XCircle,
  };

  const normalizedStatus = status?.toLowerCase().replace(" ", "_") || "pending";
  const Icon = icons[normalizedStatus] || Clock;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
        variants[normalizedStatus] || "bg-gray-50 text-gray-700 border-gray-200"
      )}
    >
      <Icon className="w-3 h-3" />
      <span className="capitalize">{status?.replace("_", " ")}</span>
    </div>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const variants: Record<string, string> = {
    urgent: "bg-rose-100 text-rose-700 border-rose-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-blue-100 text-blue-700 border-blue-200",
    low: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0.5 font-medium",
        variants[priority.toLowerCase()] || "bg-gray-100 text-gray-700"
      )}
    >
      {priority}
    </Badge>
  );
};

const MobileJobCards = () => {
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: jobCards = [], refetch, isLoading } = useQuery({
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
  });

  const filteredCards = jobCards.filter((card) => {
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
    
    if (selectedPriority !== "all" && card.priority?.toLowerCase() !== selectedPriority.toLowerCase()) {
      return false;
    }
    
    return true;
  });

  const activeCards = filteredCards.filter(c => {
    const status = c.status?.toLowerCase().replace(" ", "_");
    return status === "pending" || status === "in_progress";
  });

  const completedCards = filteredCards.filter(c => 
    c.status?.toLowerCase() === "completed"
  );

  const handleJobClick = (job: JobCard) => {
    setSelectedJob(job);
    setDialogOpen(true);
  };

  const JobCardItem = ({ card }: { card: JobCard }) => (
    <Card
      className="active:scale-[0.98] transition-transform cursor-pointer border-0 shadow-sm border-l-4"
      style={{
        borderLeftColor: 
          card.priority?.toLowerCase() === "urgent" ? "#f43f5e"
          : card.priority?.toLowerCase() === "high" ? "#f97316"
          : card.priority?.toLowerCase() === "medium" ? "#3b82f6"
          : "#9ca3af",
      }}
      onClick={() => handleJobClick(card)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                #{card.job_number}
              </span>
              <StatusBadge status={card.status} />
            </div>
            <p className="font-semibold text-sm leading-snug line-clamp-2">{card.title}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-muted-foreground">
          {card.vehicle && (
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              <span className="font-medium">
                {card.vehicle.fleet_number || card.vehicle.registration_number}
              </span>
            </span>
          )}
          {card.assignee && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {card.assignee}
            </span>
          )}
          {card.due_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(card.due_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {card.inspection && (
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {card.inspection.inspection_number}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <PriorityBadge priority={card.priority} />
          
          {card.partsSummary && card.partsSummary.count > 0 && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-muted/50">
              {card.partsSummary.count} part{card.partsSummary.count > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Job Cards
            </h1>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              <span className="font-mono">{jobCards.length}</span> total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-amber-600 font-medium">{activeCards.length} active</span>
            {" · "}
            <span className="text-emerald-600 font-medium">{completedCards.length} completed</span>
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by number, vehicle, assignee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-11 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                  onClick={() => setSearchTerm("")}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="icon"
              className={cn(
                "h-11 w-11 flex-shrink-0 rounded-xl",
                showFilters && "bg-primary text-primary-foreground"
              )}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {priorityFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={selectedPriority === filter.value ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "text-xs h-9 px-4 flex-shrink-0 rounded-lg transition-all",
                    selectedPriority === filter.value 
                      ? "bg-primary text-primary-foreground"
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
          <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-muted/50 p-1">
            <TabsTrigger 
              value="active" 
              className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Active
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                {activeCards.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Completed
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                {completedCards.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-3 space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </div>
            ) : activeCards.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <ClipboardList className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No active jobs</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || selectedPriority !== "all" 
                    ? "Try adjusting your filters" 
                    : "Create your first job card to get started"}
                </p>
                {!searchTerm && selectedPriority === "all" && (
                  <Button onClick={() => setShowAddDialog(true)} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    New Job Card
                  </Button>
                )}
              </div>
            ) : (
              activeCards.map((card) => <JobCardItem key={card.id} card={card} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-3 space-y-2">
            {completedCards.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No completed jobs</h3>
                <p className="text-sm text-muted-foreground">
                  Completed job cards will appear here
                </p>
              </div>
            ) : (
              completedCards.map((card) => <JobCardItem key={card.id} card={card} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* FAB - New Job Card */}
      <Button
        className="fixed bottom-6 right-4 h-14 w-14 rounded-2xl shadow-lg active:scale-95 transition-transform z-20"
        onClick={() => setShowAddDialog(true)}
      >
        <Plus className="h-6 w-6" />
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
          if (!open) refetch();
        }}
      />
    </div>
  );
};

export default MobileJobCards;