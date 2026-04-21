import CorrectiveActionDialog from "@/components/dialogs/CorrectiveActionDialog";
import { CreateWorkOrderFromInspectionDialog } from "@/components/dialogs/CreateWorkOrderFromInspectionDialog";
import { RootCauseAnalysisDialog } from "@/components/dialogs/RootCauseAnalysisDialog";
import { InspectionActionsMenu } from "@/components/inspections/InspectionActionsMenu";
import { InspectionForm } from "@/components/inspections/InspectionForm";
import { ShareInspectionDialog } from "@/components/inspections/ShareInspectionDialog";
import Layout from "@/components/Layout";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Calendar, Car, CheckCircle2, ClipboardList, FileText, Link2, MapPin, MoreVertical, User, Wrench, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LinkJobCardToInspectionDialog } from "@/components/dialogs/LinkInspectionJobCardDialogs";
import { OutOfCommissionReportDialog } from "@/components/inspections/OutOfCommissionReportDialog";
import { Ban } from "lucide-react";

interface Fault {
  id: string;
  fault_description: string;
  severity: string;
  corrective_action_status: string | null;
  corrective_action_notes: string | null;
}

interface RootCauseAnalysis {
  root_cause: string;
  conducted_by: string;
  responsible_person: string;
  notes: string;
}

interface InspectionData {
  id: string;
  inspection_number: string;
  inspection_date: string;
  inspector_name: string;
  inspection_type: string | null;
  vehicle_registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  odometer_reading: number | null;
  notes: string | null;
  status: string;
  template_id?: string | null;
  root_cause_analysis?: RootCauseAnalysis | null | unknown;
  created_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  digital_signature: string | null;
  initiated_via: string | null;
  vehicle_id: string | null;
  inspector_profile_id: string | null;
  scanned_vehicle_qr: string | null;
  updated_at: string | null;
}

const InspectionDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userName } = useAuth();
  const queryClient = useQueryClient();

  const [showCorrectiveAction, setShowCorrectiveAction] = useState(false);
  const [showRootCauseAnalysis, setShowRootCauseAnalysis] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [showLinkJobCard, setShowLinkJobCard] = useState(false);
  const [showOocReport, setShowOocReport] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Fetch inspection details
  const { data: inspection, isLoading, refetch } = useQuery<InspectionData>({
    queryKey: ["inspection", id],
    queryFn: async () => {
      if (!id) throw new Error("No inspection ID provided");

      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as InspectionData;
    },
    enabled: !!id,
  });

  // Fetch job cards linked to this inspection
  const { data: linkedJobCards = [] } = useQuery({
    queryKey: ["linked-job-cards", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("job_cards")
        .select("id, job_number, title, status, priority")
        .eq("inspection_id", id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch template information separately
  const { data: template, isLoading: isTemplateLoading } = useQuery({
    queryKey: ["inspection_template", inspection?.template_id],
    queryFn: async () => {
      const templateId = inspection?.template_id;
      if (!templateId) return null;

      const { data, error } = await supabase
        .from("inspection_templates")
        .select("id, name, description")
        .eq("id", templateId)
        .single();

      if (error) {
        console.error("Error fetching template:", error);
        return null;
      }
      return data;
    },
    enabled: !!inspection?.template_id,
  });

  // Fetch inspection items
  const { data: inspectionItems = [] } = useQuery({
    queryKey: ["inspection_items_detail", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("inspection_items")
        .select("id, item_name, category, status, notes")
        .eq("inspection_id", id)
        .order("category")
        .order("item_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch faults
  const { data: faults = [] } = useQuery<Fault[]>({
    queryKey: ["inspection_faults", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("inspection_faults")
        .select("id, fault_description, severity, corrective_action_status, corrective_action_notes")
        .eq("inspection_id", id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Calculate if there are any faults that still need corrective action (pending or not yet fixed)
  const hasFaultsNeedingAction = faults.some(
    fault => !fault.corrective_action_status || fault.corrective_action_status === 'pending' || fault.corrective_action_status === 'not_fixed'
  );

  // Action handlers
  const handleView = () => {
    toast({
      title: "Viewing Inspection",
      description: "You are already viewing this inspection",
    });
  };

  const handleShare = () => {
    if (!inspection) return;
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copied",
      description: `Inspection ${inspection.inspection_number} link copied to clipboard`,
    });
  };

  const handleCreateWorkOrder = () => {
    if (!inspection) return;
    setShowCreateWorkOrder(true);
  };

  // Handle corrective action — allow reopening to update any fault status (e.g. not_fixed → fixed)
  const handleCorrectiveAction = () => {
    if (faults.length === 0) {
      toast({
        title: "No Faults Found",
        description: "This inspection has no recorded faults",
      });
      return;
    }

    setShowCorrectiveAction(true);
  };

  const handleRootCauseAnalysis = () => {
    setShowRootCauseAnalysis(true);
  };

  const handleViewPDF = () => {
    if (!inspection) return;
    toast({
      title: "Generating PDF",
      description: `Creating PDF for ${inspection.inspection_number}...`,
    });
  };

  const handleArchive = async () => {
    if (!inspection) return;

    try {
      const { error } = await supabase
        .from("vehicle_inspections")
        .update({ status: "cancelled" })
        .eq("id", inspection.id);

      if (error) throw error;

      toast({
        title: "Archived",
        description: `Inspection ${inspection.inspection_number} has been archived`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to archive inspection",
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (!inspection) return;

    try {
      const { error } = await supabase
        .from("vehicle_inspections")
        .delete()
        .eq("id", inspection.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `Inspection ${inspection.inspection_number} has been deleted`,
      });
      navigate("/inspections");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete inspection",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading inspection details...</p>
        </div>
      </Layout>
    );
  }

  if (!inspection) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Inspection not found</p>
          <Button onClick={() => navigate("/inspections")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inspections
          </Button>
        </div>
      </Layout>
    );
  }

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  // Helper function to format corrective action status for display
  const getCorrectiveActionDisplay = (status: string | null) => {
    switch (status) {
      case "fixed": return "Fixed";
      case "not_fixed": return "Not Fixed";
      case "no_need": return "No Need";
      case "completed": return "Completed";
      case "pending": return "Pending";
      default: return "Pending";
    }
  };

  const getCorrectiveActionColor = (status: string | null) => {
    switch (status) {
      case "fixed":
      case "completed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "no_need":
        return "bg-gray-100 text-gray-600 border-gray-200";
      case "not_fixed":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  const handleInlineFaultAction = async (faultId: string, status: "fixed" | "not_fixed" | "no_need") => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("inspection_faults")
        .update({
          corrective_action_status: status,
          corrective_action_date: new Date().toISOString(),
          corrective_action_by: userName || "Unknown User",
        })
        .eq("id", faultId);

      if (error) throw error;

      // Sync linked vehicle_faults
      const resolvedStatuses = ["fixed", "no_need"];
      if (resolvedStatuses.includes(status)) {
        await supabase
          .from("vehicle_faults")
          .update({
            status: "resolved" as const,
            resolution_notes: `Corrective action: ${status}`,
            resolved_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("inspection_fault_id", faultId);
      } else if (status === "not_fixed") {
        await supabase
          .from("vehicle_faults")
          .update({
            status: "acknowledged" as const,
            updated_at: new Date().toISOString(),
          })
          .eq("inspection_fault_id", faultId);
      }

      // Check if all faults are now resolved
      const { data: allFaults } = await supabase
        .from("inspection_faults")
        .select("corrective_action_status")
        .eq("inspection_id", id);

      const allResolved = (allFaults || []).every(f =>
        ["fixed", "completed", "no_need"].includes(f.corrective_action_status || "")
      );

      await supabase
        .from("vehicle_inspections")
        .update({ fault_resolved: allResolved })
        .eq("id", id);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["inspection_faults", id] });
      queryClient.invalidateQueries({ queryKey: ["inspection", id] });
      queryClient.invalidateQueries({ queryKey: ["inspections-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["open-faults-count"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-faults-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["out-of-commission-reports"] });

      toast({
        title: "Updated",
        description: `Fault marked as ${status.replace("_", " ")}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update fault",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/inspections")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-muted-foreground">{inspection.inspection_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowLinkJobCard(true)}>
              <Link2 className="h-3.5 w-3.5" />
              Link Job Card
            </Button>
            <InspectionActionsMenu
              inspectionId={inspection.id}
              inspectionNumber={inspection.inspection_number}
              onView={handleView}
              onShare={handleShare}
              onSendShare={() => setShowShareDialog(true)}
              onCreateWorkOrder={handleCreateWorkOrder}
              onCorrectiveAction={handleCorrectiveAction}
              onRootCauseAnalysis={handleRootCauseAnalysis}
              onViewPDF={handleViewPDF}
              onArchive={handleArchive}
              onDelete={handleDelete}
              hasFaultsNeedingAction={hasFaultsNeedingAction}
            />
          </div>
        </div>

        {/* Show Inspection Form if status is in_progress */}
        {inspection.status === "in_progress" && (
          <>
            {/* Show template info card while loading or when template is available */}
            {inspection.template_id && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Inspection Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isTemplateLoading ? (
                    <p className="text-sm text-muted-foreground">Loading template...</p>
                  ) : template ? (
                    <div className="space-y-2">
                      <p className="font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">Template not found</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Only show form when template is loaded or if there's no template_id */}
            {(!inspection.template_id || !isTemplateLoading) && (
              <InspectionForm
                inspectionId={inspection.id}
                templateId={inspection.template_id}
                onComplete={() => refetch()}
              />
            )}

            {/* Show loading state while template is loading */}
            {inspection.template_id && isTemplateLoading && (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center">
                    <p className="text-muted-foreground">Loading inspection form...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Show Results if status is completed */}
        {inspection.status === "completed" && (
          <div className="space-y-6">
            {/* Inspection Info */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Inspection Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Date & Time</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(inspection.inspection_date).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Inspector</p>
                      <p className="text-sm text-muted-foreground">{inspection.inspector_name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Inspection Type</p>
                      <p className="text-sm text-muted-foreground">{inspection.inspection_type || "N/A"}</p>
                    </div>
                  </div>

                  {/* Template Information */}
                  {template && (
                    <div className="flex items-start gap-3">
                      <ClipboardList className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Template Used</p>
                        <p className="text-sm text-muted-foreground">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <Badge variant={inspection.status === "completed" ? "default" : "secondary"}>
                        {inspection.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Registration</p>
                      <p className="text-sm text-muted-foreground">{inspection.vehicle_registration}</p>
                    </div>
                  </div>

                  {(inspection.vehicle_make || inspection.vehicle_model) && (
                    <div className="flex items-start gap-3">
                      <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Make & Model</p>
                        <p className="text-sm text-muted-foreground">
                          {inspection.vehicle_make} {inspection.vehicle_model}
                        </p>
                      </div>
                    </div>
                  )}

                  {inspection.odometer_reading && (
                    <div className="flex items-start gap-3">
                      <Car className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Odometer Reading</p>
                        <p className="text-sm text-muted-foreground">
                          {inspection.odometer_reading.toLocaleString()} km
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Linked Job Cards */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Linked Job Cards
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowLinkJobCard(true)}>
                  <Link2 className="h-3.5 w-3.5" />
                  {linkedJobCards.length > 0 ? "Manage" : "Link Job Card"}
                </Button>
              </CardHeader>
              <CardContent>
                {linkedJobCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No job cards linked to this inspection.</p>
                ) : (
                  <div className="space-y-2">
                    {linkedJobCards.map((jc) => (
                      <div
                        key={jc.id}
                        className="flex items-center justify-between p-3 rounded-md border cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => navigate(`/job-cards/${jc.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">#{jc.job_number}</p>
                          <p className="text-xs text-muted-foreground truncate">{jc.title}</p>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant={jc.priority === "high" || jc.priority === "urgent" ? "destructive" : "secondary"} className="text-xs">{jc.priority}</Badge>
                          <Badge variant="outline" className="text-xs">{jc.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {inspection.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inspection.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Inspection Items */}
            {inspectionItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Inspection Items ({inspectionItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(
                      inspectionItems.reduce<Record<string, typeof inspectionItems>>((acc, item) => {
                        const cat = item.category || "General";
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(item);
                        return acc;
                      }, {})
                    ).map(([category, items]) => (
                      <div key={category}>
                        <h4 className="text-sm font-semibold mb-2 capitalize">{category.replace(/_/g, " ")}</h4>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-start justify-between p-3 rounded-lg border-l-4 ${item.status === "fail"
                                ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
                                : item.status === "attention"
                                  ? "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20"
                                  : item.status === "pass"
                                    ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/20"
                                    : "border-l-gray-300 bg-muted/30"
                                }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{item.item_name}</p>
                                {item.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                                )}
                              </div>
                              <Badge
                                variant={
                                  item.status === "fail"
                                    ? "destructive"
                                    : item.status === "attention"
                                      ? "default"
                                      : "secondary"
                                }
                                className={`ml-2 shrink-0 ${item.status === "pass"
                                  ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300"
                                  : item.status === "attention"
                                    ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300"
                                    : ""
                                  }`}
                              >
                                {item.status?.toUpperCase() || "PENDING"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Faults */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Faults ({(() => {
                    const resolvedStatuses = ["fixed", "completed", "no_need"];
                    const openCount = faults.filter(f => !resolvedStatuses.includes(f.corrective_action_status || "")).length;
                    return openCount > 0 ? `${openCount} open / ${faults.length} total` : `${faults.length} total — all resolved`;
                  })()})
                </CardTitle>
                {faults.length > 0 && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowOocReport(true)}>
                    <Ban className="h-3.5 w-3.5" />
                    Out of Commission Report
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {faults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No faults recorded for this inspection</p>
                ) : (
                  <div className="space-y-4">
                    {faults.map((fault) => (
                      <div key={fault.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="font-medium">{fault.fault_description}</p>
                          <Badge variant={getSeverityVariant(fault.severity)}>
                            {fault.severity}
                          </Badge>
                        </div>

                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Corrective Action Status:</p>
                            <Badge
                              variant="outline"
                              className={getCorrectiveActionColor(fault.corrective_action_status)}
                            >
                              {getCorrectiveActionDisplay(fault.corrective_action_status)}
                            </Badge>
                          </div>

                          {/* Inline corrective action dropdown */}
                          {(!fault.corrective_action_status || fault.corrective_action_status === "pending" || fault.corrective_action_status === "not_fixed") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                  <Wrench className="h-3.5 w-3.5" />
                                  Apply Action
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleInlineFaultAction(fault.id, "fixed")}>
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                                  Mark Fixed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleInlineFaultAction(fault.id, "not_fixed")}>
                                  <XCircle className="h-4 w-4 mr-2 text-rose-600" />
                                  Not Fixed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleInlineFaultAction(fault.id, "no_need")}>
                                  <MoreVertical className="h-4 w-4 mr-2 text-gray-500" />
                                  No Need
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        {/* Show notes if they exist */}
                        {fault.corrective_action_notes && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Notes:</p>
                            <p className="text-sm text-muted-foreground">{fault.corrective_action_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Root Cause Analysis */}
            {inspection.root_cause_analysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Root Cause Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Root Cause:</p>
                    <p className="text-sm text-muted-foreground">
                      {(inspection.root_cause_analysis as RootCauseAnalysis)?.root_cause || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Conducted By:</p>
                    <p className="text-sm text-muted-foreground">
                      {(inspection.root_cause_analysis as RootCauseAnalysis)?.conducted_by || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Responsible Person:</p>
                    <p className="text-sm text-muted-foreground">
                      {(inspection.root_cause_analysis as RootCauseAnalysis)?.responsible_person || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Analysis Notes:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {(inspection.root_cause_analysis as RootCauseAnalysis)?.notes || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Corrective Action Dialog - Only render if there are faults */}
      {faults.length > 0 && (
        <CorrectiveActionDialog
          open={showCorrectiveAction}
          onOpenChange={setShowCorrectiveAction}
          faults={faults}
          inspectionId={inspection.id}
          onCompleted={() => {
            refetch();
            setShowCorrectiveAction(false);
          }}
        />
      )}

      {/* Root Cause Analysis Dialog */}
      <RootCauseAnalysisDialog
        open={showRootCauseAnalysis}
        onOpenChange={setShowRootCauseAnalysis}
        inspectionId={inspection.id}
        inspectionNumber={inspection.inspection_number}
        onCompleted={() => {
          refetch();
          setShowRootCauseAnalysis(false);
        }}
      />

      {/* Create Job Card Dialog */}
      <CreateWorkOrderFromInspectionDialog
        open={showCreateWorkOrder}
        onOpenChange={setShowCreateWorkOrder}
        inspectionId={inspection.id}
        inspectionNumber={inspection.inspection_number}
        vehicleRegistration={inspection.vehicle_registration}
        onSuccess={() => {
          toast({
            title: "Job Card Created",
            description: "Job card has been successfully created with all identified faults as tasks",
          });
          refetch();
          setShowCreateWorkOrder(false);
        }}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete inspection{" "}
              <span className="font-semibold">{inspection.inspection_number}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link Job Card Dialog */}
      <LinkJobCardToInspectionDialog
        open={showLinkJobCard}
        onOpenChange={setShowLinkJobCard}
        inspectionId={inspection.id}
        onLinked={() => {
          queryClient.invalidateQueries({ queryKey: ["linked-job-cards", id] });
        }}
      />

      {/* Out of Commission Report Dialog */}
      <OutOfCommissionReportDialog
        open={showOocReport}
        onOpenChange={setShowOocReport}
        inspectionId={inspection.id}
        vehicleId={inspection.vehicle_id}
        vehicleRegistration={inspection.vehicle_registration || ""}
        vehicleMake={inspection.vehicle_make || ""}
        vehicleModel={inspection.vehicle_model || ""}
        odometerReading={inspection.odometer_reading}
        inspectorName={inspection.inspector_name}
        onComplete={() => {
          setShowOocReport(false);
          queryClient.invalidateQueries({ queryKey: ["out-of-commission-reports"] });
          toast({
            title: "Report Submitted",
            description: "Out-of-commission report has been recorded",
          });
        }}
      />

      {/* Share Inspection Dialog */}
      <ShareInspectionDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        inspectionId={inspection.id}
        inspectionNumber={inspection.inspection_number}
      />
    </Layout>
  );
};

export default InspectionDetails;