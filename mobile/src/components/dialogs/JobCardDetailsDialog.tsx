import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateJobCardPDF, type JobCardExportData } from "@/lib/jobCardExport";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import JobCardGeneralInfo from "../JobCardGeneralInfo";
import JobCardHeader from "../JobCardHeader";
import JobCardLaborTable from "../JobCardLaborTable";
import JobCardNotes from "../JobCardNotes";
import JobCardPartsTable from "../JobCardPartsTable";
import JobCardStats from "../JobCardStats";
import JobCardTasksTable from "../JobCardTasksTable";

interface JobCardDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCard: {
    id: string;
    job_number: string;
    title: string;
    description: string | null;
    vehicle_id: string | null;
    assignee: string | null;
    priority: string;
    due_date: string | null;
    status: string;
    created_at: string;
  } | null;
  onUpdate?: () => void;
}

const JobCardDetailsDialog = ({ open, onOpenChange, jobCard, onUpdate }: JobCardDetailsDialogProps) => {
  const { toast } = useToast();

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", jobCard?.vehicle_id],
    queryFn: async () => {
      if (!jobCard?.vehicle_id) return null;
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", jobCard.vehicle_id)
        .single();
      return data;
    },
    enabled: !!jobCard?.vehicle_id,
  });

  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ["tasks", jobCard?.id],
    queryFn: async () => {
      if (!jobCard?.id) return [];
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("job_card_id", jobCard.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!jobCard?.id,
  });

  const { data: parts = [], refetch: refetchParts } = useQuery({
    queryKey: ["parts", jobCard?.id],
    queryFn: async () => {
      if (!jobCard?.id) return [];
      const { data } = await supabase
        .from("parts_requests")
        .select(`
          *,
          vendors(id, name, email, phone),
          inventory(
            id,
            name,
            part_number,
            quantity,
            unit_price,
            location,
            supplier
          )
        `)
        .eq("job_card_id", jobCard.id)
        .order("created_at", { ascending: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []) as any[];
    },
    enabled: !!jobCard?.id,
  });

  const { data: laborEntries = [], refetch: refetchLabor } = useQuery({
    queryKey: ["labor", jobCard?.id],
    queryFn: async () => {
      if (!jobCard?.id) return [];
      const { data } = await supabase
        .from("labor_entries")
        .select("*")
        .eq("job_card_id", jobCard.id)
        .order("work_date", { ascending: false });
      return data || [];
    },
    enabled: !!jobCard?.id,
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ["notes", jobCard?.id],
    queryFn: async () => {
      if (!jobCard?.id) return [];
      const { data } = await supabase
        .from("job_card_notes")
        .select("*")
        .eq("job_card_id", jobCard.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!jobCard?.id,
  });

  if (!jobCard) return null;

  const handleStatusChange = async (status: string) => {
    const { error } = await supabase
      .from("job_cards")
      .update({ status })
      .eq("id", jobCard.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Status updated successfully",
    });

    if (onUpdate) onUpdate();
  };

  const handleJobCardUpdate = async (updates: Record<string, unknown>) => {
    const { error } = await supabase
      .from("job_cards")
      .update(updates)
      .eq("id", jobCard.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update job card",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Job card updated successfully",
    });

    if (onUpdate) onUpdate();
  };

  const handleTaskUpdate = async (taskId: string, updates: Record<string, unknown>) => {
    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Task updated successfully",
    });

    refetchTasks();
  };

  const handleExportPDF = () => {
    const exportData: JobCardExportData = {
      jobCard: {
        id: jobCard.id,
        job_number: jobCard.job_number,
        title: jobCard.title,
        status: jobCard.status,
        priority: jobCard.priority,
        assignee: jobCard.assignee,
        due_date: jobCard.due_date,
        created_at: jobCard.created_at,
        description: jobCard.description,
      },
      vehicle: vehicle || null,
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title || "",
        status: t.status || "pending",
        priority: t.priority || "medium",
      })),
      laborEntries: laborEntries.map(l => ({
        id: l.id,
        technician_name: l.technician_name,
        description: l.description,
        hours_worked: l.hours_worked,
        hourly_rate: l.hourly_rate,
        total_cost: l.total_cost || 0,
        work_date: l.work_date || new Date().toISOString(),
      })),
      parts: parts.map(p => ({
        id: p.id,
        part_name: p.part_name,
        part_number: p.part_number,
        quantity: p.quantity,
        status: p.status,
        unit_price: p.unit_price,
        total_price: p.total_price,
        is_from_inventory: p.is_from_inventory,
        is_service: p.is_service,
        vendor_id: p.vendor_id,
        vendors: p.vendors,
        inventory: p.inventory,
        document_url: p.document_url,
        document_name: p.document_name,
      })),
    };

    generateJobCardPDF(exportData);
    toast({
      title: "Success",
      description: "Job card PDF exported successfully",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0">
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Job Card Details - {jobCard.job_number}</DialogTitle>
            <DialogDescription>View and manage job card details, tasks, parts, and labor entries</DialogDescription>
          </DialogHeader>
        </VisuallyHidden>
        <ScrollArea className="h-full">
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <JobCardHeader
                jobCard={jobCard}
                onClose={() => onOpenChange(false)}
                onStatusChange={handleStatusChange}
                onPriorityChange={(priority) => handleJobCardUpdate({ priority })}
              />
              <Button onClick={handleExportPDF} size="sm" variant="outline" className="gap-2 w-full sm:w-auto">
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
            </div>

            <JobCardStats
              tasks={tasks}
              laborEntries={laborEntries}
              parts={parts}
            />

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="flex w-full overflow-x-auto h-auto flex-nowrap">
                <TabsTrigger value="overview" className="flex-1 min-w-[70px] text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1 min-w-[55px] text-xs sm:text-sm">Tasks</TabsTrigger>
                <TabsTrigger value="parts" className="flex-1 min-w-[55px] text-xs sm:text-sm">Parts</TabsTrigger>
                <TabsTrigger value="labor" className="flex-1 min-w-[55px] text-xs sm:text-sm">Labor</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1 min-w-[55px] text-xs sm:text-sm">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <JobCardGeneralInfo
                  jobCard={jobCard}
                  vehicle={vehicle}
                  onUpdate={handleJobCardUpdate}
                />
              </TabsContent>

              <TabsContent value="tasks">
                <JobCardTasksTable
                  jobCardId={jobCard.id}
                  tasks={tasks}
                  onTaskUpdate={handleTaskUpdate}
                  onRefresh={refetchTasks}
                />
              </TabsContent>

              <TabsContent value="parts">
                <JobCardPartsTable
                  jobCardId={jobCard.id}
                  parts={parts}
                  onRefresh={refetchParts}
                />
              </TabsContent>

              <TabsContent value="labor">
                <JobCardLaborTable
                  jobCardId={jobCard.id}
                  laborEntries={laborEntries}
                  onRefresh={refetchLabor}
                />
              </TabsContent>

              <TabsContent value="notes">
                <JobCardNotes
                  jobCardId={jobCard.id}
                  notes={notes}
                  onRefresh={refetchNotes}
                />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default JobCardDetailsDialog;