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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeVehicleFaults } from "@/hooks/useRealtimeVehicleFaults";
import { useVehicleFaults } from "@/hooks/useVehicleFaults";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { generateAllFaultsPDF, generateSingleFaultPDF, type FaultExportData } from "@/lib/faultExport";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, Download, Edit, FileText, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import AddFaultDialog from "./dialogs/AddFaultDialog";
import EditFaultDialog from "./dialogs/EditFaultDialog";
import FaultDetailsDialog from "./dialogs/FaultDetailsDialog";

type VehicleFault = Database["public"]["Tables"]["vehicle_faults"]["Row"] & {
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string | null;
    model: string | null;
  } | null;
};

const FaultTracking = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedFault, setSelectedFault] = useState<VehicleFault | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingFault, setDeletingFault] = useState<VehicleFault | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: faults = [], isLoading } = useVehicleFaults() as unknown as {
    data: VehicleFault[] | undefined;
    isLoading: boolean;
  };
  useRealtimeVehicleFaults();

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
      case "identified":
        return <AlertTriangle className="h-4 w-4" />;
      case "acknowledged":
        return <Clock className="h-4 w-4" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "identified":
        return "text-destructive";
      case "acknowledged":
        return "text-warning";
      case "resolved":
        return "text-success";
      default:
        return "text-muted-foreground";
    }
  };

  const handleViewDetails = (fault: VehicleFault) => {
    setSelectedFault(fault);
    setShowDetailsDialog(true);
  };

  const handleEditFault = (fault: VehicleFault) => {
    setSelectedFault(fault);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (fault: VehicleFault) => {
    setDeletingFault(fault);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingFault) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("vehicle_faults")
        .delete()
        .eq("id", deletingFault.id);

      if (error) throw error;

      toast({
        title: "Fault Deleted",
        description: `Fault ${deletingFault.fault_number} has been deleted successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete fault. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeletingFault(null);
    }
  };

  const handleExportSinglePDF = (fault: VehicleFault) => {
    const exportData = {
      ...fault,
      vehicles: fault.vehicles || undefined,
    } as unknown as FaultExportData;
    generateSingleFaultPDF(exportData);
    toast({
      title: "PDF Generated",
      description: `Report for ${fault.fault_number} has been downloaded.`,
    });
  };

  const handleExportAllPDF = () => {
    if (faults.length === 0) {
      toast({
        title: "No Faults",
        description: "There are no faults to export.",
        variant: "destructive",
      });
      return;
    }

    const exportData = faults.map((fault) => ({
      ...fault,
      vehicles: fault.vehicles || undefined,
    })) as unknown as FaultExportData[];
    generateAllFaultsPDF(exportData);
    toast({
      title: "PDF Generated",
      description: `Report with ${faults.length} faults has been downloaded.`,
    });
  };

  return (
    <>
      <AddFaultDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <EditFaultDialog
        fault={selectedFault}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <FaultDetailsDialog
        fault={selectedFault}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fault</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete fault{" "}
              <span className="font-semibold">{deletingFault?.fault_number}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExportAllPDF}
              disabled={faults.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All (PDF)
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Log New Fault
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Faults</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{faults.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Identified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {faults.filter((f) => f.status === "identified").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {faults.filter((f) => f.status === "acknowledged").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {faults.filter((f) => f.status === "resolved").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Active Faults</CardTitle>
            <CardDescription>All reported faults and their current status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading faults...</p>
            ) : faults.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No faults reported yet.</p>
            ) : (
              <div className="space-y-4">
                {faults.map((fault) => (
                  <Card key={fault.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-mono text-sm font-semibold text-foreground">
                                {fault.vehicles?.fleet_number || fault.fault_number}
                              </span>
                              <Badge variant={getSeverityVariant(fault.severity)}>
                                {fault.severity}
                              </Badge>
                              <div className={`flex items-center gap-1 ${getStatusColor(fault.status)}`}>
                                {getStatusIcon(fault.status)}
                                <span className="text-sm font-medium capitalize">{fault.status}</span>
                              </div>
                            </div>
                            <h3 className="font-semibold text-foreground mb-1">
                              {fault.fault_description}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {fault.vehicles?.fleet_number
                                ? `${fault.vehicles.fleet_number} • `
                                : ""}
                              {fault.vehicles?.registration_number || "N/A"} ({fault.vehicles?.make} {fault.vehicles?.model})
                            </p>
                          </div>
                          {/* Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(fault)}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditFault(fault)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Fault
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportSinglePDF(fault)}>
                                <Download className="h-4 w-4 mr-2" />
                                Export PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(fault)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Fault
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <div className="text-sm text-muted-foreground">
                            <span>Reported by {fault.reported_by}</span>
                            <span className="mx-2">•</span>
                            <span>{new Date(fault.reported_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(fault)}
                            >
                              View Details
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditFault(fault)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default FaultTracking;
