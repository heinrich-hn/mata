import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePromoteToVehicleFault } from "@/hooks/usePromoteToVehicleFault";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Camera, CheckCircle2, ClipboardCheck, ImageIcon, Plus, Smartphone, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CorrectiveActionDialog from "../dialogs/CorrectiveActionDialog";
import CreateJobCardFromInspectionDialog from "../dialogs/CreateJobCardFromInspectionDialog";
import InspectionPhotoDialog from "../dialogs/InspectionPhotoDialog";
import StartInspectionDialog from "../dialogs/StartInspectionDialog";

type InspectionItemStatus = "pass" | "fail" | "attention" | "not_applicable";
type FaultSeverity = Database["public"]["Enums"]["fault_severity"];

interface QRScanState {
  initiatedVia?: string;
  vehicleData?: {
    id: string;
    registration_number: string;
    make: string;
    model: string;
  };
  inspectorName?: string;
  inspectorId?: string;
  scannedVehicleData?: {
    fullCode: string;
  };
}

interface InspectionPhoto {
  id: string;
  photo_url: string;
  uploaded_at: string;
  caption?: string;
}

interface InspectionFault {
  id: string;
  fault_description: string;
  severity: FaultSeverity;
  job_card_id?: string | null;
}

const VehicleInspection = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const qrScanState = location.state as QRScanState | undefined;
  const [currentInspectionId, setCurrentInspectionId] = useState<string | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showJobCardDialog, setShowJobCardDialog] = useState(false);
  const [showCorrectiveActionDialog, setShowCorrectiveActionDialog] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedItemForPhoto, setSelectedItemForPhoto] = useState<{ id: string; name: string } | null>(null);
  const [viewPhotoDialogOpen, setViewPhotoDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<InspectionPhoto[]>([]);

  const { promoteToVehicleFault } = usePromoteToVehicleFault();

  // Fetch current inspection
  const { data: currentInspection, refetch: refetchInspection } = useQuery({
    queryKey: ["current_inspection", currentInspectionId],
    queryFn: async () => {
      if (!currentInspectionId) return null;
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("*")
        .eq("id", currentInspectionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!currentInspectionId,
  });

  // Fetch inspection items
  const { data: inspectionItems = [], refetch: refetchItems } = useQuery({
    queryKey: ["inspection_items", currentInspectionId],
    queryFn: async () => {
      if (!currentInspectionId) return [];
      const { data, error } = await supabase
        .from("inspection_items")
        .select("*")
        .eq("inspection_id", currentInspectionId)
        .order("category", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentInspectionId,
  });

  // Fetch inspection faults
  const { data: inspectionFaults = [], refetch: refetchFaults } = useQuery({
    queryKey: ["inspection_faults", currentInspectionId],
    queryFn: async () => {
      if (!currentInspectionId) return [];
      const { data, error } = await supabase
        .from("inspection_faults")
        .select("*")
        .eq("inspection_id", currentInspectionId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentInspectionId,
  });

  // Fetch photos for current inspection
  const { data: inspectionPhotos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ["inspection_photos", currentInspectionId],
    queryFn: async () => {
      if (!currentInspectionId) return [];
      const { data, error } = await supabase
        .from("inspection_photos")
        .select("*")
        .eq("inspection_id", currentInspectionId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentInspectionId,
  });

  const initialInspectionItems = [
    { category: "braking", item: "Brake Pads/Linings" },
    { category: "braking", item: "Brake Discs/Drums" },
    { category: "braking", item: "Brake Fluid Level" },
    { category: "chassis", item: "Frame/Chassis Integrity" },
    { category: "chassis", item: "Suspension Components" },
    { category: "chassis", item: "Steering System" },
    { category: "electrical", item: "Battery Condition" },
    { category: "electrical", item: "Lights & Indicators" },
    { category: "electrical", item: "Wiring & Connections" },
    { category: "cargo", item: "Load Securing Points" },
    { category: "cargo", item: "Cargo Area Condition" },
    { category: "cargo", item: "Tailgate/Doors" },
  ];

  const handleInspectionStarted = async (inspectionId: string) => {
    setCurrentInspectionId(inspectionId);

    // Create initial inspection items
    const itemsToCreate = initialInspectionItems.map(item => ({
      inspection_id: inspectionId,
      item_name: item.item,
      category: item.category,
      status: null,
      notes: null,
    }));

    const { error } = await supabase
      .from("inspection_items")
      .insert(itemsToCreate);

    if (error) {
      console.error("Error creating inspection items:", error);
      toast.error("Failed to initialize inspection checklist");
    } else {
      refetchItems();
      toast.success("Inspection checklist initialized");
    }
  };

  const updateItemStatus = async (itemId: string, status: InspectionItemStatus) => {
    const { error } = await supabase
      .from("inspection_items")
      .update({
        status,
        action_required: status === "fail" || status === "attention"
      })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to update item status");
    } else {
      refetchItems();

      // If marked for fail/attention, create or update fault
      if ((status === "fail" || status === "attention") && currentInspectionId) {
        const item = inspectionItems.find(i => i.id === itemId);
        if (item) {
          await createOrUpdateFault(itemId, item.item_name, status);
        }
      }
    }
  };

  const updateItemNotes = async (itemId: string, notes: string) => {
    const { error } = await supabase
      .from("inspection_items")
      .update({ notes })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to update notes");
    } else {
      refetchItems();
    }
  };

  const createOrUpdateFault = async (itemId: string, itemName: string, status: InspectionItemStatus) => {
    const severity = status === "fail" ? "high" : "medium";
    const action = status === "fail" ? "repair/replace" : "attention required";

    const { data: newFault, error } = await supabase
      .from("inspection_faults")
      .insert({
        inspection_id: currentInspectionId!,
        inspection_item_id: itemId,
        fault_description: `${itemName} - ${action}`,
        severity,
        requires_immediate_attention: status === "fail",
      })
      .select()
      .single();

    if (error && !error.message.includes("duplicate")) {
      console.error("Error creating fault:", error);
    } else {
      refetchFaults();

      // Auto-promote critical faults to vehicle faults
      if (status === "fail" && newFault && currentInspection) {
        await promoteToVehicleFault({
          inspectionFaultId: newFault.id,
          inspectionId: currentInspectionId!,
          vehicleId: currentInspection.vehicle_id,
          faultDescription: `${itemName} - ${action}`,
          severity: severity,
          reportedBy: currentInspection.inspector_name || "Inspector",
          component: itemName,
          faultCategory: "inspection",
        });
      }
    }
  };

  const handlePromoteFault = async (fault: InspectionFault) => {
    if (!currentInspection) return;

    await promoteToVehicleFault({
      inspectionFaultId: fault.id,
      inspectionId: currentInspectionId!,
      vehicleId: currentInspection.vehicle_id,
      faultDescription: fault.fault_description,
      severity: fault.severity,
      reportedBy: currentInspection.inspector_name || "Inspector",
      component: "general",
      faultCategory: "inspection",
    });

    refetchFaults();
  };

  const handleCreateJobCard = () => {
    const faultsNeedingJobCard = inspectionFaults.filter(f => !f.job_card_id);
    if (faultsNeedingJobCard.length === 0) {
      toast.error("No faults available to create job card");
      return;
    }
    setShowJobCardDialog(true);
  };

  const handleCorrectiveAction = () => {
    const faultsWithJobCard = inspectionFaults.filter(f => f.job_card_id);
    if (faultsWithJobCard.length === 0) {
      toast.error("No faults with job cards to record corrective action");
      return;
    }
    setShowCorrectiveActionDialog(true);
  };

  const handleSaveDraft = async () => {
    if (!currentInspectionId) return;

    const { error } = await supabase
      .from("vehicle_inspections")
      .update({ status: "pending" })
      .eq("id", currentInspectionId);

    if (error) {
      toast.error("Failed to save draft");
    } else {
      toast.success("Inspection saved as draft");
    }
  };

  const handleSubmitInspection = async () => {
    if (!currentInspectionId) return;

    const assessedItems = inspectionItems.filter(item => item.status !== null);
    if (assessedItems.length === 0) {
      toast.error("Please assess at least one item before submitting");
      return;
    }

    const faultsNeedingAction = inspectionFaults.filter(
      f => !f.job_card_id && f.requires_immediate_attention
    );

    if (faultsNeedingAction.length > 0) {
      toast.error("Please create a job card for urgent faults before completing inspection");
      return;
    }

    const { error } = await supabase
      .from("vehicle_inspections")
      .update({
        status: "in_progress",
        completed_at: new Date().toISOString()
      })
      .eq("id", currentInspectionId);

    if (error) {
      toast.error("Failed to submit inspection");
    } else {
      toast.success("Inspection submitted successfully");
      refetchInspection();
    }
  };

  const getStatusIcon = (status: InspectionItemStatus | null) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "attention":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "not_applicable":
        return null;
      default:
        return null;
    }
  };

  const categories = [
    { id: "braking", label: "Braking" },
    { id: "chassis", label: "Chassis" },
    { id: "electrical", label: "Electrical" },
    { id: "cargo", label: "Cargo" },
  ];

  const faultsWithoutJobCard = inspectionFaults.filter(f => !f.job_card_id).map(f => ({
    ...f,
    requires_immediate_attention: f.requires_immediate_attention ?? false
  }));
  const faultsWithJobCard = inspectionFaults.filter(f => f.job_card_id).map(f => ({
    ...f,
    requires_immediate_attention: f.requires_immediate_attention ?? false
  }));

  if (!currentInspectionId) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground mt-2">Comprehensive vehicle inspection system</p>
        </div>

        <Card className="shadow-card">
          <CardContent className="pt-6 text-center space-y-4">
            <ClipboardCheck className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">No Active Inspection</h3>
              <p className="text-muted-foreground mb-4">
                Start a new inspection to begin the checklist process
              </p>
              <Button onClick={() => setShowStartDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Start New Inspection
              </Button>
            </div>
          </CardContent>
        </Card>

        <StartInspectionDialog
          open={showStartDialog}
          onOpenChange={setShowStartDialog}
          onInspectionCreated={handleInspectionStarted}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground mt-2">
            {currentInspection?.vehicle_registration} - {currentInspection?.vehicle_make} {currentInspection?.vehicle_model}
          </p>
          {qrScanState?.initiatedVia === "qr_scan" && (
            <Badge variant="outline" className="mt-2">
              Initiated via QR Scan
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate("/inspections/mobile")}
            variant={isMobile ? "default" : "outline"}
            size="sm"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Mobile View
          </Button>
          <Badge variant={currentInspection?.status === "completed" ? "default" : "secondary"}>
            {currentInspection?.status}
          </Badge>
        </div>
      </div>

      {inspectionFaults.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-warning">Inspection Faults ({inspectionFaults.length})</CardTitle>
            <CardDescription>Faults identified during inspection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Individual Fault Cards */}
            <div className="space-y-2">
              {inspectionFaults.map((fault) => (
                <div key={fault.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{fault.fault_description}</span>
                      <Badge variant={fault.severity === "high" ? "destructive" : "default"}>
                        {fault.severity}
                      </Badge>
                      {fault.requires_immediate_attention && (
                        <Badge variant="destructive">Urgent</Badge>
                      )}
                      {fault.job_card_id && (
                        <Badge variant="outline">Has Job Card</Badge>
                      )}
                    </div>
                  </div>
                  {!fault.job_card_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePromoteFault(fault)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Promote to Vehicle Fault
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            {faultsWithoutJobCard.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {faultsWithoutJobCard.length} fault(s) need a job card
                </p>
                <Button onClick={handleCreateJobCard} variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Job Card from Faults
                </Button>
              </div>
            )}
            {faultsWithJobCard.length > 0 && currentInspection?.status !== "completed" && (
              <Button onClick={handleCorrectiveAction} variant="outline">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Record Corrective Actions
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Inspection Checklist</CardTitle>
          <CardDescription>Assess each item and mark status</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="braking">
            <TabsList className="grid w-full grid-cols-4">
              {categories.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id}>
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((cat) => (
              <TabsContent key={cat.id} value={cat.id} className="space-y-4 mt-4">
                {inspectionItems
                  .filter((item) => item.category === cat.id)
                  .map((item) => (
                    <Card key={item.id} className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{item.item_name}</h4>
                            {getStatusIcon(item.status as InspectionItemStatus)}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={item.status === "pass" ? "default" : "outline"}
                              className={item.status === "pass" ? "bg-success hover:bg-success/90" : ""}
                              onClick={() => updateItemStatus(item.id, "pass")}
                            >
                              Pass
                            </Button>
                            <Button
                              size="sm"
                              variant={item.status === "attention" ? "default" : "outline"}
                              className={item.status === "attention" ? "bg-warning hover:bg-warning/90" : ""}
                              onClick={() => updateItemStatus(item.id, "attention")}
                            >
                              Attention
                            </Button>
                            <Button
                              size="sm"
                              variant={item.status === "fail" ? "default" : "outline"}
                              className={item.status === "fail" ? "bg-destructive hover:bg-destructive/90" : ""}
                              onClick={() => updateItemStatus(item.id, "fail")}
                            >
                              Fail
                            </Button>
                            <Button
                              size="sm"
                              variant={item.status === "not_applicable" ? "default" : "outline"}
                              onClick={() => updateItemStatus(item.id, "not_applicable")}
                            >
                              N/A
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItemForPhoto({ id: item.id, name: item.item_name });
                                setPhotoDialogOpen(true);
                              }}
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                            {inspectionPhotos.filter(p => p.inspection_item_id === item.id).length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const itemPhotos = inspectionPhotos.filter(p => p.inspection_item_id === item.id);
                                  setSelectedPhotos(itemPhotos);
                                  setViewPhotoDialogOpen(true);
                                }}
                              >
                                <ImageIcon className="h-4 w-4" />
                                <span className="ml-1 text-xs">
                                  {inspectionPhotos.filter(p => p.inspection_item_id === item.id).length}
                                </span>
                              </Button>
                            )}
                          </div>

                          <Textarea
                            placeholder="Add notes..."
                            value={item.notes || ""}
                            onChange={(e) => updateItemNotes(item.id, e.target.value)}
                            className="text-sm"
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button onClick={handleSubmitInspection} className="bg-accent hover:bg-accent/90">
              Submit Inspection
            </Button>
          </div>
        </CardContent>
      </Card>

      <StartInspectionDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onInspectionCreated={handleInspectionStarted}
      />

      {currentInspection && (
        <>
          <CreateJobCardFromInspectionDialog
            open={showJobCardDialog}
            onOpenChange={setShowJobCardDialog}
            inspectionId={currentInspectionId}
            faults={faultsWithoutJobCard}
            vehicleId={currentInspection.vehicle_id}
            onJobCardCreated={() => {
              refetchFaults();
              refetchInspection();
            }}
          />

          <CorrectiveActionDialog
            open={showCorrectiveActionDialog}
            onOpenChange={setShowCorrectiveActionDialog}
            faults={faultsWithJobCard}
            inspectionId={currentInspectionId}
            onCompleted={() => {
              refetchFaults();
              refetchInspection();
            }}
          />
        </>
      )}

      {selectedItemForPhoto && (
        <InspectionPhotoDialog
          open={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          inspectionId={currentInspectionId!}
          itemId={selectedItemForPhoto.id}
          itemName={selectedItemForPhoto.name}
          onPhotoUploaded={() => {
            refetchPhotos();
            setSelectedItemForPhoto(null);
          }}
        />
      )}

      <Dialog open={viewPhotoDialogOpen} onOpenChange={setViewPhotoDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Inspection Photos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedPhotos.map((photo) => (
                <div key={photo.id} className="space-y-2">
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || "Inspection photo"}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground">{photo.caption}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(photo.uploaded_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehicleInspection;