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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, ClipboardList, FileText, Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LinkInspectionToJobCardDialog } from "@/components/dialogs/LinkInspectionJobCardDialogs";

type JobCard = Database["public"]["Tables"]["job_cards"]["Row"];

const JobCardDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showLinkInspection, setShowLinkInspection] = useState(false);

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
            name,
            part_number,
            quantity,
            unit_price,
            location,
            supplier
          )
        `)
        .eq("job_card_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
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

  const { data: inspection } = useQuery({
    queryKey: ["vehicle_inspection", jobCard?.inspection_id],
    queryFn: async () => {
      if (!jobCard?.inspection_id) return null;

      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("inspection_number, inspection_type, inspection_date, inspector_name, notes")
        .eq("id", jobCard.inspection_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!jobCard?.inspection_id,
  });

  const { data: inspectionItems = [] } = useQuery({
    queryKey: ["inspection_items_for_export", jobCard?.inspection_id],
    queryFn: async () => {
      if (!jobCard?.inspection_id) return [];

      const { data, error } = await supabase
        .from("inspection_items")
        .select("item_name, status, notes")
        .eq("inspection_id", jobCard.inspection_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!jobCard?.inspection_id,
  });

  const { data: inspectionFaults = [] } = useQuery({
    queryKey: ["inspection_faults_for_export", jobCard?.inspection_id],
    queryFn: async () => {
      if (!jobCard?.inspection_id) return [];

      const { data, error } = await supabase
        .from("inspection_faults")
        .select("fault_description, severity, corrective_action_status, corrective_action_notes")
        .eq("inspection_id", jobCard.inspection_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!jobCard?.inspection_id,
  });

  const { data: oocReport } = useQuery({
    queryKey: ["ooc_report_for_export", jobCard?.inspection_id],
    queryFn: async () => {
      if (!jobCard?.inspection_id) return null;

      const { data, error } = await supabase
        .from("out_of_commission_reports")
        .select("vehicle_id_or_license, make_model, year, odometer_hour_meter, location, reason_out_of_commission, immediate_plan, parts_required, additional_notes_safety_concerns, mechanic_name, report_date, report_time, sign_off_date")
        .eq("inspection_id", jobCard.inspection_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!jobCard?.inspection_id,
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
      notes: notes.map(n => ({
        id: n.id,
        note: n.note,
        created_by: n.created_by,
        created_at: n.created_at,
      })),
      inspection: inspection ? {
        inspection_number: inspection.inspection_number,
        inspection_type: inspection.inspection_type,
        inspection_date: inspection.inspection_date,
        inspector_name: inspection.inspector_name,
        notes: inspection.notes,
        items: inspectionItems.map(item => ({
          item_name: item.item_name,
          status: item.status,
          notes: item.notes,
        })),
        faults: inspectionFaults.map(f => ({
          fault_description: f.fault_description,
          severity: f.severity,
          corrective_action_status: f.corrective_action_status,
          corrective_action_notes: f.corrective_action_notes,
        })),
        oocReport: oocReport ? {
          vehicle_id_or_license: oocReport.vehicle_id_or_license,
          make_model: oocReport.make_model,
          year: oocReport.year,
          odometer_hour_meter: oocReport.odometer_hour_meter,
          location: oocReport.location,
          reason_out_of_commission: oocReport.reason_out_of_commission,
          immediate_plan: Array.isArray(oocReport.immediate_plan) ? oocReport.immediate_plan as string[] : null,
          parts_required: Array.isArray(oocReport.parts_required)
            ? (oocReport.parts_required as Array<{ partNameNumber: string; quantity: string; onHand: string; orderNeededBy: string }>)
            : null,
          additional_notes_safety_concerns: oocReport.additional_notes_safety_concerns,
          mechanic_name: oocReport.mechanic_name,
          report_date: oocReport.report_date,
          report_time: oocReport.report_time,
          sign_off_date: oocReport.sign_off_date,
        } : null,
      } : null,
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
          defaultCollapsed
        />

        {/* Linked Inspection */}
        <Collapsible defaultOpen={false}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Linked Inspection
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); setShowLinkInspection(true); }}>
                  <Link2 className="h-3.5 w-3.5" />
                  {jobCard.inspection_id ? "Change" : "Link Inspection"}
                </Button>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {inspection ? (
                  <div
                    className="flex items-center justify-between p-3 rounded-md border cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => navigate(`/inspections/${jobCard.inspection_id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium">{inspection.inspection_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {inspection.inspection_type} • {new Date(inspection.inspection_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">View</Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No inspection linked. Click &quot;Link Inspection&quot; to associate one.</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Tasks */}
        <Collapsible defaultOpen={false}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  Tasks
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <JobCardTasksTable
                  jobCardId={jobCard.id}
                  tasks={tasks}
                  onTaskUpdate={handleTaskUpdate}
                  onRefresh={handleRefresh}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Labor Entries */}
        <Collapsible defaultOpen={false}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  Labor Entries
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <JobCardLaborTable
                  jobCardId={jobCard.id}
                  laborEntries={laborEntries}
                  onRefresh={handleRefresh}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Parts Requests */}
        <Collapsible defaultOpen={false}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  Parts &amp; Materials
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Notes */}
        <JobCardNotes
          jobCardId={jobCard.id}
          notes={notes}
          onRefresh={handleRefresh}
          defaultCollapsed
        />
      </div>

      <LinkInspectionToJobCardDialog
        open={showLinkInspection}
        onOpenChange={setShowLinkInspection}
        jobCardId={jobCard.id}
        currentInspectionId={jobCard.inspection_id}
        vehicleId={jobCard.vehicle_id}
        onLinked={() => {
          setShowLinkInspection(false);
          handleRefresh();
        }}
      />
    </Layout>
  );
};

export default JobCardDetails;