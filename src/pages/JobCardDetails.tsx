import JobCardCostSummary from "@/components/jobCards/JobCardCostSummary";
import JobCardGeneralInfo from "@/components/jobCards/JobCardGeneralInfo";
import JobCardHeader from "@/components/jobCards/JobCardHeader";
import JobCardLaborTable from "@/components/jobCards/JobCardLaborTable";
import JobCardNotes from "@/components/jobCards/JobCardNotes";
import JobCardPartsTable from "@/components/jobCards/JobCardPartsTable";
import JobCardStats from "@/components/jobCards/JobCardStats";
import JobCardTasksTable from "@/components/jobCards/JobCardTasksTable";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { generateJobCardPDF, type JobCardExportData } from "@/lib/jobCardExport";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

type JobCard = Database["public"]["Tables"]["job_cards"]["Row"];

const JobCardDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobCard, isLoading } = useQuery<JobCard>({
    queryKey: ["job_card", id],
    queryFn: async () => {
      if (!id) throw new Error("No job card ID provided");

      const { data, error } = await supabase
        .from("job_cards")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", jobCard?.vehicle_id],
    queryFn: async () => {
      if (!jobCard?.vehicle_id) return null;

      const { data, error } = await supabase
        .from("vehicles")
        .select("registration_number, make, model, fleet_number")
        .eq("id", jobCard.vehicle_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!jobCard?.vehicle_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["job_card_tasks", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("job_card_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: laborEntries = [] } = useQuery({
    queryKey: ["job_card_labor", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("labor_entries")
        .select("*")
        .eq("job_card_id", id)
        .order("work_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["job_card_parts", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("parts_requests")
        .select(`
          *,
          vendors(id, name, email, phone),
          inventory(
            id,
            part_name,
            part_number,
            quantity_in_stock,
            unit_price,
            location,
            supplier
          )
        `)
        .eq("job_card_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["job_card_notes", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("job_card_notes")
        .select("*")
        .eq("job_card_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["job_card", id] });
    queryClient.invalidateQueries({ queryKey: ["vehicle"] });
    queryClient.invalidateQueries({ queryKey: ["job_card_tasks", id] });
    queryClient.invalidateQueries({ queryKey: ["job_card_labor", id] });
    queryClient.invalidateQueries({ queryKey: ["job_card_parts", id] });
    queryClient.invalidateQueries({ queryKey: ["job_card_notes", id] });
    queryClient.invalidateQueries({ queryKey: ["job-card-cost-summary", id] });
  };

  const handleJobCardUpdate = async (updates: Partial<JobCard>) => {
    if (!id) return;

    const { error } = await supabase
      .from("job_cards")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Job card updated successfully",
      });
      requestGoogleSheetsSync('workshop');
      handleRefresh();
    }
  };

  const handleStatusChange = async (status: string) => {
    await handleJobCardUpdate({ status });
  };

  const handlePriorityChange = async (priority: string) => {
    await handleJobCardUpdate({ priority });
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Database["public"]["Tables"]["tasks"]["Row"]>) => {
    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      handleRefresh();
    }
  };

  const handleExportPDF = () => {
    if (!jobCard) return;

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

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!jobCard) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-screen">
          <p className="text-lg text-muted-foreground mb-4">Job card not found</p>
          <Button onClick={() => navigate("/job-cards")}>Back to Job Cards</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/job-cards")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-muted-foreground">#{jobCard.job_number}</p>
            </div>
          </div>
          <Button onClick={handleExportPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            Export PDF
          </Button>
        </div>

        {/* Job Card Header */}
        <JobCardHeader
          jobCard={jobCard}
          onClose={() => navigate("/job-cards")}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
        />

        {/* Stats */}
        <JobCardStats tasks={tasks} laborEntries={laborEntries} parts={parts} />

        {/* General Info */}
        <JobCardGeneralInfo
          jobCard={jobCard}
          vehicle={vehicle}
          onUpdate={handleJobCardUpdate}
        />

        {/* Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <JobCardTasksTable
              jobCardId={jobCard.id}
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
              onRefresh={handleRefresh}
            />
          </CardContent>
        </Card>

        {/* Labor Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Labor Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <JobCardLaborTable
              jobCardId={jobCard.id}
              laborEntries={laborEntries}
              onRefresh={handleRefresh}
            />
          </CardContent>
        </Card>

        {/* Parts Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Parts & Materials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cost Summary */}
            <JobCardCostSummary jobCardId={jobCard.id} />

            {/* Parts Table */}
            <JobCardPartsTable
              jobCardId={jobCard.id}
              parts={parts}
              onRefresh={handleRefresh}
              fleetNumber={vehicle?.fleet_number}
              jobNumber={jobCard.job_number}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <JobCardNotes
          jobCardId={jobCard.id}
          notes={notes}
          onRefresh={handleRefresh}
        />
      </div>
    </Layout>
  );
};

export default JobCardDetails;