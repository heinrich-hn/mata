import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { LinkInspectionToJobCardDialog } from "@/components/dialogs/LinkInspectionJobCardDialogs";
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
  const [showLinkInspection, setShowLinkInspection] = useState(false);

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

  // Fetch linked inspection
  const { data: linkedInspection } = useQuery({
    queryKey: ["job_card_inspection", jobCard?.id],
    queryFn: async () => {
      if (!jobCard?.id) return null;
      const { data: jc } = await supabase
        .from("job_cards")
        .select("inspection_id")
        .eq("id", jobCard.id)
        .single();
      if (!jc?.inspection_id) return null;
      const { data } = await supabase
        .from("vehicle_inspections")
        .select("id, inspection_number, inspection_date, status")
        .eq("id", jc.inspection_id)
        .single();
      return data;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-[95vw] h-full sm:h-[95vh] p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Job Card Details - {jobCard.job_number}</DialogTitle>
            <DialogDescription>View and manage job card details, tasks, parts, and labor entries</DialogDescription>
          </DialogHeader>
        </VisuallyHidden>
        <ScrollArea className="h-full">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-safe">
            <JobCardHeader
              jobCard={jobCard}
              onClose={() => onOpenChange(false)}
              onStatusChange={handleStatusChange}
              onPriorityChange={(priority) => handleJobCardUpdate({ priority })}
            />

            <JobCardStats
              tasks={tasks}
              laborEntries={laborEntries}
              parts={parts}
            />

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid grid-cols-5 w-full h-12 sm:h-10 p-1 gap-1">
                <TabsTrigger value="overview" className="text-xs sm:text-sm px-1 py-2 h-full data-[state=active]:shadow-sm">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs sm:text-sm px-1 py-2 h-full data-[state=active]:shadow-sm">
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="parts" className="text-xs sm:text-sm px-1 py-2 h-full data-[state=active]:shadow-sm">
                  Parts
                </TabsTrigger>
                <TabsTrigger value="labor" className="text-xs sm:text-sm px-1 py-2 h-full data-[state=active]:shadow-sm">
                  Labor
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs sm:text-sm px-1 py-2 h-full data-[state=active]:shadow-sm">
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <JobCardGeneralInfo
                  jobCard={jobCard}
                  vehicle={vehicle}
                  onUpdate={handleJobCardUpdate}
                />

                {/* Linked Inspection */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-blue-500" />
                        <h3 className="font-semibold text-sm">Linked Inspection</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setShowLinkInspection(true)}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        {linkedInspection ? "Change" : "Link"}
                      </Button>
                    </div>
                    {linkedInspection ? (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium">{linkedInspection.inspection_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(linkedInspection.inspection_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No linked inspection
                      </p>
                    )}
                  </CardContent>
                </Card>
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

      <LinkInspectionToJobCardDialog
        open={showLinkInspection}
        onOpenChange={setShowLinkInspection}
        jobCardId={jobCard.id}
        currentInspectionId={linkedInspection?.id ?? null}
        onLinked={() => {
          if (onUpdate) onUpdate();
        }}
      />
    </Dialog>
  );
};

export default JobCardDetailsDialog;