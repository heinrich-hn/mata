import CorrectiveActionDialog from "@/components/dialogs/CorrectiveActionDialog";
import { CreateWorkOrderFromInspectionDialog } from "@/components/dialogs/CreateWorkOrderFromInspectionDialog";
import { LinkJobCardToInspectionDialog } from "@/components/dialogs/LinkInspectionJobCardDialogs";
import { RootCauseAnalysisDialog } from "@/components/dialogs/RootCauseAnalysisDialog";
import { InspectionActionsMenu } from "@/components/inspections/InspectionActionsMenu";
import { InspectionForm } from "@/components/inspections/InspectionForm";
import { OutOfCommissionReportDialog } from "@/components/inspections/OutOfCommissionReportDialog";
import { ShareInspectionDialog } from "@/components/inspections/ShareInspectionDialog";
import Layout from "@/components/MobilePageLayout";
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
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  MoreVertical,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";

// Add Skeleton component if it doesn't exist, or create a simple one
const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("animate-pulse rounded-md bg-muted", className)}
    {...props}
  />
);

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

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  className?: string;
}

const InfoRow = ({ icon: Icon, label, value, className }: InfoRowProps) => (
  <div className={cn("flex items-start gap-3 py-2", className)}>
    <div className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-medium mt-0.5 break-words">{value || "N/A"}</p>
    </div>
  </div>
);

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const variants: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const icons: Record<string, React.ElementType> = {
    completed: CheckCircle2,
    in_progress: Clock,
    cancelled: XCircle,
  };

  const Icon = icons[status] || CheckCircle2;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        variants[status] || "bg-gray-50 text-gray-700 border-gray-200"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="capitalize">{status.replace("_", " ")}</span>
    </div>
  );
};

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
  const {
    data: inspection,
    isLoading,
    refetch,
  } = useQuery<InspectionData>({
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

  // Fetch linked job cards
  const { data: linkedJobCards = [] } = useQuery({
    queryKey: ["linked_job_cards", id],
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

  // Fetch template information
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

  // Fetch inspection items
  const { data: inspectionItems = [] } = useQuery({
    queryKey: ["inspection_items_detail", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("inspection_items")
        .select("id, item_name, category, status, notes")
        .eq("inspection_id", id)
        .order("item_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const handleShare = () => {
    if (!inspection) return;
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: `Inspection ${inspection.inspection_number} link copied to clipboard`,
    });
  };

  const handleCorrectiveAction = () => {
    if (faults.length === 0) {
      toast({
        title: "No faults found",
        description: "This inspection has no recorded faults",
      });
      return;
    }
    setShowCorrectiveAction(true);
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
      navigate("/");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete inspection",
        variant: "destructive",
      });
    }
  };

  const getSeverityVariant = (severity: string): "default" | "destructive" | "secondary" => {
    switch (severity) {
      case "critical":
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

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

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </Layout>
    );
  }

  if (!inspection) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Inspection not found</h2>
          <p className="text-sm text-muted-foreground mb-6">
            The inspection you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inspections
          </Button>
        </div>
      </Layout>
    );
  }

  const isTyreInspection = (inspection.inspection_type || "").toLowerCase() === "tyre";
  const showInProgressForm = inspection.status === "in_progress" && !isTyreInspection;
  const showCompletedDetails = inspection.status === "completed" || isTyreInspection;

  return (
    <Layout>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full shrink-0"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">
                {isTyreInspection ? "Tyre Inspection Details" : "Inspection Details"}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {inspection.inspection_number}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full shrink-0"
              onClick={() => setShowLinkJobCard(true)}
            >
              <Link2 className="h-5 w-5" />
            </Button>

            <InspectionActionsMenu
              inspectionId={inspection.id}
              inspectionNumber={inspection.inspection_number}
              onView={() => { }}
              onShare={handleShare}
              onSendShare={() => setShowShareDialog(true)}
              onCreateWorkOrder={() => setShowCreateWorkOrder(true)}
              onCorrectiveAction={handleCorrectiveAction}
              onRootCauseAnalysis={() => setShowRootCauseAnalysis(true)}
              onViewPDF={() => { }}
              onArchive={handleArchive}
              onDelete={() => setShowDeleteAlert(true)}
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <StatusBadge status={inspection.status} />
          <p className="text-xs text-muted-foreground">
            {new Date(inspection.inspection_date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        {/* In Progress State */}
        {showInProgressForm && (
          <div className="space-y-4">
            {inspection.template_id && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  {isTemplateLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : template ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Template
                      </p>
                      <p className="font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {(!inspection.template_id || !isTemplateLoading) && (
              <InspectionForm
                inspectionId={inspection.id}
                templateId={inspection.template_id}
                onComplete={() => refetch()}
              />
            )}
          </div>
        )}

        {/* Completed State */}
        {showCompletedDetails && (
          <div className="space-y-4">
            {/* Key Information Cards */}
            <div className="grid gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 divide-y">
                  <InfoRow icon={User} label="Inspector" value={inspection.inspector_name} />
                  <InfoRow
                    icon={Calendar}
                    label="Date & Time"
                    value={new Date(inspection.inspection_date).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  />
                  <InfoRow
                    icon={FileText}
                    label="Inspection Type"
                    value={isTyreInspection ? "Tyre Inspection" : inspection.inspection_type || "Standard Inspection"}
                  />
                  {template && (
                    <InfoRow icon={FileText} label="Template" value={template.name} />
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 divide-y">
                  <InfoRow
                    icon={Car}
                    label="Vehicle"
                    value={
                      inspection.vehicle_registration ||
                      `${inspection.vehicle_make || ""} ${inspection.vehicle_model || ""}`.trim() ||
                      "Not specified"
                    }
                  />
                  {inspection.odometer_reading && (
                    <InfoRow
                      icon={Car}
                      label="Odometer"
                      value={`${inspection.odometer_reading.toLocaleString()} km`}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Notes */}
            {inspection.notes && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Notes
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{inspection.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Faults */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold">
                      Faults ({(() => {
                        const resolvedStatuses = ["fixed", "completed", "no_need"];
                        const openCount = faults.filter(f => !resolvedStatuses.includes(f.corrective_action_status || "")).length;
                        return openCount > 0 ? `${openCount} open / ${faults.length} total` : `${faults.length} total — all resolved`;
                      })()})
                    </h3>
                  </div>
                  {faults.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-destructive"
                      onClick={() => setShowOocReport(true)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      OOC Report
                    </Button>
                  )}
                </div>

                {faults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No faults recorded
                  </p>
                ) : (
                  <div className="space-y-3">
                    {faults.map((fault) => (
                      <div key={fault.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium flex-1">{fault.fault_description}</p>
                          <Badge variant={getSeverityVariant(fault.severity)} className="shrink-0">
                            {fault.severity}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] border", getCorrectiveActionColor(fault.corrective_action_status))}
                            >
                              {getCorrectiveActionDisplay(fault.corrective_action_status)}
                            </Badge>
                          </div>

                          {/* Inline corrective action dropdown */}
                          {(!fault.corrective_action_status || fault.corrective_action_status === "pending" || fault.corrective_action_status === "not_fixed") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                                  <Wrench className="h-3.5 w-3.5" />
                                  Action
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

                        {fault.corrective_action_notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {fault.corrective_action_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inspection Items */}
            {inspectionItems.length > 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold">Inspection Items ({inspectionItems.length})</h3>
                  </div>

                  <div className="space-y-2">
                    {inspectionItems.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start justify-between p-3 rounded-lg border-l-4",
                          item.status === "fail"
                            ? "border-l-rose-500 bg-rose-50/50"
                            : item.status === "pass"
                              ? "border-l-emerald-500 bg-emerald-50/30"
                              : "border-l-gray-300 bg-muted/30"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.item_name}</p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                        <Badge
                          variant={item.status === "fail" ? "destructive" : "secondary"}
                          className={cn(
                            "ml-2 shrink-0 text-[10px]",
                            item.status === "pass" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          )}
                        >
                          {item.status?.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : isTyreInspection ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold">Tyre Inspection Items</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No tyre item details were recorded for this inspection.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* Root Cause Analysis */}
            {inspection.root_cause_analysis && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Root Cause Analysis</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Root Cause</p>
                      <p className="font-medium">
                        {(inspection.root_cause_analysis as RootCauseAnalysis)?.root_cause || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conducted By</p>
                      <p className="font-medium">
                        {(inspection.root_cause_analysis as RootCauseAnalysis)?.conducted_by || "N/A"}
                      </p>
                    </div>
                    {(inspection.root_cause_analysis as RootCauseAnalysis)?.notes && (
                      <div>
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm text-muted-foreground">
                          {(inspection.root_cause_analysis as RootCauseAnalysis)?.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked Job Cards */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold">Linked Job Cards</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setShowLinkJobCard(true)}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    Link
                  </Button>
                </div>
                {linkedJobCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No linked job cards
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedJobCards.map((jc) => (
                      <div
                        key={jc.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer"
                        onClick={() => navigate(`/job-cards/${jc.id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{jc.job_number}</p>
                          {jc.title && (
                            <p className="text-xs text-muted-foreground truncate">{jc.title}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {jc.priority && (
                            <Badge variant="outline" className="text-[10px]">{jc.priority}</Badge>
                          )}
                          {jc.status && (
                            <Badge variant="secondary" className="text-[10px]">{jc.status}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialogs */}
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

      <CreateWorkOrderFromInspectionDialog
        open={showCreateWorkOrder}
        onOpenChange={setShowCreateWorkOrder}
        inspectionId={inspection.id}
        inspectionNumber={inspection.inspection_number}
        vehicleRegistration={inspection.vehicle_registration}
        onSuccess={() => {
          toast({
            title: "Job Card Created",
            description: "Job card has been successfully created",
          });
          refetch();
          setShowCreateWorkOrder(false);
        }}
      />

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="w-[90%] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inspection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete inspection{" "}
              <span className="font-semibold">{inspection.inspection_number}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="flex-1 bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkJobCardToInspectionDialog
        open={showLinkJobCard}
        onOpenChange={setShowLinkJobCard}
        inspectionId={inspection.id}
        onLinked={() => queryClient.invalidateQueries({ queryKey: ["linked_job_cards", id] })}
      />

      <OutOfCommissionReportDialog
        open={showOocReport}
        onOpenChange={setShowOocReport}
        inspectionId={inspection.id}
        vehicleId={inspection.vehicle_id ?? null}
        vehicleRegistration={inspection.vehicle_registration || ""}
        vehicleMake={inspection.vehicle_make || ""}
        vehicleModel={inspection.vehicle_model || ""}
        odometerReading={inspection.odometer_reading ?? null}
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