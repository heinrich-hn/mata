import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { generateSingleFaultPDF, type FaultExportData } from "@/lib/faultExport";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@radix-ui/react-alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, ClipboardList, Clock, Download, Edit, Loader2, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertDialogFooter, AlertDialogHeader } from "../ui/alert-dialog";
import EditFaultDialog from "./EditFaultDialog";

type VehicleFault = Database["public"]["Tables"]["vehicle_faults"]["Row"] & {
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
};

interface FaultDetailsDialogProps {
  fault: VehicleFault | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FaultDetailsDialog = ({ fault: faultProp, open, onOpenChange }: FaultDetailsDialogProps) => {
  const { userName } = useAuth();
  const navigate = useNavigate();
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateJobCardDialog, setShowCreateJobCardDialog] = useState(false);
  const [showCreateInspectionDialog, setShowCreateInspectionDialog] = useState(false);
  const [isCreatingJobCard, setIsCreatingJobCard] = useState(false);
  const [isCreatingInspection, setIsCreatingInspection] = useState(false);
  const [jobCardForm, setJobCardForm] = useState({
    title: "",
    assignee: "",
    priority: "medium",
    description: "",
  });
  const [inspectionForm, setInspectionForm] = useState({
    inspection_type: "fault_followup",
    inspector_name: "",
    notes: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch linked inspection fault if exists
  const { data: inspectionFault } = useQuery({
    queryKey: ["inspection-fault", faultProp?.inspection_fault_id],
    queryFn: async () => {
      if (!faultProp?.inspection_fault_id) return null;
      const { data, error } = await supabase
        .from("inspection_faults")
        .select(`
          *,
          inspection_items (
            item_name,
            category
          )
        `)
        .eq("id", faultProp.inspection_fault_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!faultProp?.inspection_fault_id,
  });

  if (!faultProp) return null;

  const fault = faultProp;

  const getSeverityVariant = (severity: string): "default" | "destructive" | "secondary" => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "logged":
        return <AlertTriangle className="h-4 w-4" />;
      case "acknowledged":
        return <Clock className="h-4 w-4" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("vehicle_faults")
        .update({
          status: "acknowledged" as const,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userName || "Unknown User",
        })
        .eq("id", fault.id);

      if (error) throw error;

      toast({
        title: "Fault Acknowledged",
        description: "The fault has been acknowledged successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to acknowledge fault.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      toast({
        title: "Resolution Notes Required",
        description: "Please enter resolution notes before resolving.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("vehicle_faults")
        .update({
          status: "resolved" as const,
          resolved_date: new Date().toISOString(),
          resolution_notes: resolutionNotes,
        })
        .eq("id", fault.id);

      if (error) throw error;

      toast({
        title: "Fault Resolved",
        description: "The fault has been marked as resolved.",
      });

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to resolve fault.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("vehicle_faults")
        .delete()
        .eq("id", fault.id);

      if (error) throw error;

      toast({
        title: "Fault Deleted",
        description: `Fault ${fault.fault_number} has been deleted successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete fault.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportPDF = () => {
    const exportData: FaultExportData = {
      ...fault,
      vehicles: fault.vehicles || undefined,
    };
    generateSingleFaultPDF(exportData);
    toast({
      title: "PDF Generated",
      description: `Report for ${fault.fault_number} has been downloaded.`,
    });
  };

  const handleOpenCreateJobCard = () => {
    setJobCardForm({
      title: `Repair: ${fault.fault_category} - ${fault.vehicles?.fleet_number || fault.vehicles?.registration_number || 'Vehicle'}`,
      assignee: "",
      priority: fault.severity === "critical" || fault.severity === "high" ? "high" : "medium",
      description: `Fault Reference: ${fault.fault_number}\n\nDescription:\n${fault.fault_description}\n\nComponent: ${fault.component || 'N/A'}\nReported By: ${fault.reported_by}\nReported Date: ${new Date(fault.reported_date).toLocaleDateString()}`,
    });
    setShowCreateJobCardDialog(true);
  };

  const handleCreateJobCard = async () => {
    if (!jobCardForm.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a job card title.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingJobCard(true);
    try {
      const jobNumber = `JOB-${Date.now()}`;

      // Create the job card
      const { data: jobCard, error: jobCardError } = await supabase
        .from("job_cards")
        .insert({
          job_number: jobNumber,
          title: jobCardForm.title,
          vehicle_id: fault.vehicle_id,
          assignee: jobCardForm.assignee || null,
          priority: jobCardForm.priority,
          description: jobCardForm.description,
          status: "pending",
        })
        .select()
        .single();

      if (jobCardError) throw jobCardError;

      // Create a task for this fault
      const { error: taskError } = await supabase
        .from("tasks")
        .insert({
          job_card_id: jobCard.id,
          title: `Fix: ${fault.fault_category} - ${fault.component || 'General'}`,
          description: fault.fault_description,
          status: "pending",
          priority: fault.severity === "critical" || fault.severity === "high" ? "high" : "medium",
          assignee: jobCardForm.assignee || null,
        });

      if (taskError) {
        console.error("Failed to create task:", taskError);
      }

      // Update fault status to acknowledged if it's still identified
      if (fault.status === "identified") {
        await supabase
          .from("vehicle_faults")
          .update({
            status: "acknowledged" as const,
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: userName || "System",
          })
          .eq("id", fault.id);
      }

      toast({
        title: "Job Card Created",
        description: `Job Card ${jobNumber} has been created successfully.`,
      });
      requestGoogleSheetsSync('workshop');

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      queryClient.invalidateQueries({ queryKey: ["job-cards"] });
      setShowCreateJobCardDialog(false);
      onOpenChange(false);

      // Navigate to the job card
      navigate(`/maintenance?job=${jobCard.id}`);
    } catch (error) {
      console.error("Error creating job card:", error);
      toast({
        title: "Error",
        description: "Failed to create job card.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingJobCard(false);
    }
  };

  const handleOpenCreateInspection = () => {
    setInspectionForm({
      inspection_type: "fault_followup",
      inspector_name: userName || "",
      notes: `Follow-up inspection for fault: ${fault.fault_number}\n\nOriginal Fault:\n${fault.fault_description}`,
    });
    setShowCreateInspectionDialog(true);
  };

  const handleCreateInspection = async () => {
    if (!inspectionForm.inspector_name.trim()) {
      toast({
        title: "Inspector Name Required",
        description: "Please enter the inspector name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingInspection(true);
    try {
      const inspectionNumber = `INS-${Date.now()}`;

      const { data: inspection, error } = await supabase
        .from("vehicle_inspections")
        .insert({
          inspection_number: inspectionNumber,
          inspection_type: inspectionForm.inspection_type,
          vehicle_id: fault.vehicle_id,
          vehicle_registration: fault.vehicles?.registration_number || null,
          vehicle_make: fault.vehicles?.make || null,
          vehicle_model: fault.vehicles?.model || null,
          inspector_name: inspectionForm.inspector_name,
          inspection_date: new Date().toISOString().split('T')[0],
          notes: inspectionForm.notes,
          status: "in_progress",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Inspection Created",
        description: `Inspection ${inspectionNumber} has been created successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      setShowCreateInspectionDialog(false);
      onOpenChange(false);

      // Navigate to the inspection
      navigate(`/inspections?id=${inspection.id}`);
    } catch (error) {
      console.error("Error creating inspection:", error);
      toast({
        title: "Error",
        description: "Failed to create inspection.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingInspection(false);
    }
  };

  return (
    <>
      {/* Edit Dialog */}
      <EditFaultDialog
        fault={fault}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fault</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete fault{" "}
              <span className="font-semibold">{fault.fault_number}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Fault Details - {fault.vehicles?.fleet_number || fault.fault_number}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportPDF}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="resolution">Resolution</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vehicle</Label>
                  <p className="font-medium">
                    {fault.vehicles?.fleet_number
                      ? `${fault.vehicles.fleet_number} • `
                      : ""}
                    {fault.vehicles?.registration_number || "N/A"} ({fault.vehicles?.make} {fault.vehicles?.model})
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(fault.status)}
                    <Badge variant={fault.status === "resolved" ? "default" : "secondary"}>
                      {fault.status}
                    </Badge>
                  </div>
                </div>
              <div>
                <Label className="text-muted-foreground">Severity</Label>
                <div className="mt-1">
                  <Badge variant={getSeverityVariant(fault.severity)}>
                    {fault.severity}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <p className="font-medium">{fault.fault_category}</p>
              </div>
              {fault.component && (
                <div>
                  <Label className="text-muted-foreground">Component</Label>
                  <p className="font-medium">{fault.component}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Reported By</Label>
                <p className="font-medium">{fault.reported_by}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Reported Date</Label>
                <p className="font-medium">
                  {new Date(fault.reported_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="mt-2 p-3 bg-muted rounded-md">{fault.fault_description}</p>
            </div>

            {/* Show inspection link if exists */}
            {inspectionFault && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-sm font-medium mb-2">Linked to Inspection</p>
                <div className="text-sm space-y-1">
                  {inspectionFault.inspection_items && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Item:</span> {inspectionFault.inspection_items.item_name}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    <span className="font-medium">Corrective Status:</span> {inspectionFault.corrective_action_status || "Pending"}
                  </p>
                </div>
              </div>
            )}

            {fault.status !== "resolved" && fault.status !== "closed" && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {fault.status === "identified" && (
                  <Button onClick={handleAcknowledge} disabled={loading}>
                    <Clock className="h-4 w-4 mr-2" />
                    Acknowledge Fault
                  </Button>
                )}
                <Button variant="outline" onClick={handleOpenCreateJobCard}>
                  <Wrench className="h-4 w-4 mr-2" />
                  Create Job Card
                </Button>
                <Button variant="outline" onClick={handleOpenCreateInspection}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Create Inspection
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolution" className="space-y-4">
            {fault.status === "resolved" ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Resolved Date</Label>
                  <p className="font-medium">
                    {fault.resolved_date
                      ? new Date(fault.resolved_date).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Resolution Notes</Label>
                  <p className="mt-2 p-3 bg-muted rounded-md">
                    {fault.resolution_notes || "No resolution notes provided."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resolution-notes">Resolution Notes *</Label>
                  <Textarea
                    id="resolution-notes"
                    placeholder="Enter resolution notes..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                </div>
                <Button onClick={handleResolve} disabled={loading}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Fault Logged</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(fault.reported_date).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Logged by {fault.reported_by}
                </p>
              </div>

              {fault.acknowledged_at && (
                <div className="p-3 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Fault Acknowledged</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(fault.acknowledged_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Acknowledged by {fault.acknowledged_by}
                  </p>
                </div>
              )}

              {fault.resolved_date && (
                <div className="p-3 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Fault Resolved</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(fault.resolved_date).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Create Job Card Dialog */}
    <Dialog open={showCreateJobCardDialog} onOpenChange={setShowCreateJobCardDialog}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Create Job Card from Fault
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Creating job card for:</p>
            <p className="font-medium">
              {fault.fault_number} - {fault.vehicles?.fleet_number || fault.vehicles?.registration_number}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jc-title">Job Card Title *</Label>
            <Input
              id="jc-title"
              value={jobCardForm.title}
              onChange={(e) => setJobCardForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter job card title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jc-assignee">Assignee</Label>
              <Input
                id="jc-assignee"
                value={jobCardForm.assignee}
                onChange={(e) => setJobCardForm(prev => ({ ...prev, assignee: e.target.value }))}
                placeholder="Technician name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jc-priority">Priority</Label>
              <Select
                value={jobCardForm.priority}
                onValueChange={(value) => setJobCardForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger id="jc-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jc-description">Description</Label>
            <Textarea
              id="jc-description"
              value={jobCardForm.description}
              onChange={(e) => setJobCardForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Job card description"
              rows={5}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowCreateJobCardDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateJobCard} disabled={isCreatingJobCard}>
            {isCreatingJobCard && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Job Card
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Create Inspection Dialog */}
    <Dialog open={showCreateInspectionDialog} onOpenChange={setShowCreateInspectionDialog}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Create Inspection from Fault
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Creating inspection for:</p>
            <p className="font-medium">
              {fault.fault_number} - {fault.vehicles?.fleet_number || fault.vehicles?.registration_number}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insp-type">Inspection Type</Label>
              <Select
                value={inspectionForm.inspection_type}
                onValueChange={(value) => setInspectionForm(prev => ({ ...prev, inspection_type: value }))}
              >
                <SelectTrigger id="insp-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fault_followup">Fault Follow-up</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="pre_trip">Pre-Trip</SelectItem>
                  <SelectItem value="post_trip">Post-Trip</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insp-inspector">Inspector Name *</Label>
              <Input
                id="insp-inspector"
                value={inspectionForm.inspector_name}
                onChange={(e) => setInspectionForm(prev => ({ ...prev, inspector_name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="insp-notes">Notes</Label>
            <Textarea
              id="insp-notes"
              value={inspectionForm.notes}
              onChange={(e) => setInspectionForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Inspection notes"
              rows={4}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowCreateInspectionDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateInspection} disabled={isCreatingInspection}>
            {isCreatingInspection && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Inspection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default FaultDetailsDialog;