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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle, CheckCircle, Clock, Download, Edit, FileText, MoreVertical, Plus, Snowflake, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import AddFaultDialog from "../dialogs/AddFaultDialog";
import EditFaultDialog from "../dialogs/EditFaultDialog";
import FaultDetailsDialog from "../dialogs/FaultDetailsDialog";
import ResolveFaultDialog from "../dialogs/ResolveFaultDialog";

type VehicleFault = Database["public"]["Tables"]["vehicle_faults"]["Row"] & {
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string | null;
    model: string | null;
    vehicle_type: string | null;
  } | null;
};

type VehicleCategory = "Horses" | "Reefers" | "Interlinks" | "LMVs";

const CATEGORY_ORDER: VehicleCategory[] = ["Horses", "Reefers", "Interlinks", "LMVs"];

function getVehicleCategory(vehicleType: string | null | undefined): VehicleCategory {
  switch (vehicleType) {
    case "horse_truck":
    case "truck":
      return "Horses";
    case "reefer":
    case "refrigerated_truck":
      return "Reefers";
    case "interlink":
      return "Interlinks";
    default:
      return "LMVs";
  }
}

function getCategoryIcon(category: VehicleCategory) {
  switch (category) {
    case "Horses":
      return <Truck className="h-4 w-4" />;
    case "Reefers":
      return <Snowflake className="h-4 w-4" />;
    case "Interlinks":
      return <Truck className="h-4 w-4" />;
    case "LMVs":
      return <Truck className="h-4 w-4" />;
  }
}

const FaultTracking = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedFault, setSelectedFault] = useState<VehicleFault | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolvingFault, setResolvingFault] = useState<VehicleFault | null>(null);
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

  const handleResolveFault = (fault: VehicleFault) => {
    setResolvingFault(fault);
    setShowResolveDialog(true);
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

  // Group faults by category → vehicle
  const groupedFaults = useMemo(() => {
    const byCategory = new Map<VehicleCategory, Map<string, { vehicle: VehicleFault["vehicles"]; faults: VehicleFault[] }>>();

    for (const cat of CATEGORY_ORDER) {
      byCategory.set(cat, new Map());
    }

    for (const fault of faults) {
      const category = getVehicleCategory(fault.vehicles?.vehicle_type);
      const vehicleKey = fault.vehicle_id;
      const categoryMap = byCategory.get(category)!;

      if (!categoryMap.has(vehicleKey)) {
        categoryMap.set(vehicleKey, { vehicle: fault.vehicles, faults: [] });
      }
      categoryMap.get(vehicleKey)!.faults.push(fault);
    }

    return byCategory;
  }, [faults]);

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
      <ResolveFaultDialog
        open={showResolveDialog}
        onOpenChange={setShowResolveDialog}
        fault={resolvingFault}
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

        {/* Summary cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total Faults</p>
            <p className="text-xl font-semibold">{faults.length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Identified</p>
            <p className="text-xl font-semibold">{faults.filter((f) => f.status === "identified").length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Acknowledged</p>
            <p className="text-xl font-semibold">{faults.filter((f) => f.status === "acknowledged").length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-xl font-semibold">{faults.filter((f) => f.status === "resolved").length}</p>
          </Card>
        </div>

        {/* Faults grouped by category → vehicle */}
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading faults...</p>
        ) : faults.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No faults reported yet.</p>
        ) : (
          <div className="space-y-4">
            {CATEGORY_ORDER.map((category) => {
              const vehicleMap = groupedFaults.get(category)!;
              if (vehicleMap.size === 0) return null;

              const totalFaults = Array.from(vehicleMap.values()).reduce((sum, v) => sum + v.faults.length, 0);

              return (
                <Card key={category}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {getCategoryIcon(category)}
                      {category}
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {vehicleMap.size} vehicle{vehicleMap.size !== 1 ? "s" : ""} · {totalFaults} fault{totalFaults !== 1 ? "s" : ""}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-2">
                    <Accordion type="multiple">
                      {Array.from(vehicleMap.entries()).map(([vehicleId, { vehicle, faults: vehicleFaults }]) => {
                        const label = vehicle?.fleet_number || vehicle?.registration_number || "Unknown";
                        const openCount = vehicleFaults.filter((f) => f.status !== "resolved").length;

                        return (
                          <AccordionItem key={vehicleId} value={vehicleId} className="border-b last:border-b-0">
                            <AccordionTrigger className="py-2 hover:no-underline">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold">{label}</span>
                                {vehicle?.registration_number && vehicle.fleet_number && (
                                  <span className="text-muted-foreground">{vehicle.registration_number}</span>
                                )}
                                {vehicle?.make && (
                                  <span className="text-xs text-muted-foreground">
                                    {vehicle.make} {vehicle.model}
                                  </span>
                                )}
                                <Badge variant="secondary" className="text-xs ml-auto mr-2">
                                  {vehicleFaults.length} fault{vehicleFaults.length !== 1 ? "s" : ""}
                                </Badge>
                                {openCount > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {openCount} open
                                  </Badge>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-1.5">
                                {vehicleFaults.map((fault) => (
                                  <div
                                    key={fault.id}
                                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                                  >
                                    <div className={`shrink-0 ${getStatusColor(fault.status)}`}>
                                      {getStatusIcon(fault.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{fault.fault_description}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {fault.fault_number} · {new Date(fault.reported_date).toLocaleDateString()}
                                        {fault.reported_by ? ` · ${fault.reported_by}` : ""}
                                      </p>
                                    </div>
                                    <Badge variant={getSeverityVariant(fault.severity)} className="shrink-0 text-xs">
                                      {fault.severity}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                                          <MoreVertical className="h-3.5 w-3.5" />
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
                                        <DropdownMenuItem onClick={() => handleResolveFault(fault)}>
                                          <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                                          {fault.status === "resolved" ? "Reactivate / Update" : "Mark Resolved"}
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
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default FaultTracking;
