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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePromoteToVehicleFault } from "@/hooks/usePromoteToVehicleFault";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Camera, CheckCircle2, CheckSquare, CircleDashed, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OutOfCommissionReportDialog } from "@/components/inspections/OutOfCommissionReportDialog";

interface InspectionFormProps {
  inspectionId: string;
  templateId: string | null;
  onComplete: () => void;
}

interface InspectionItem {
  id: string;
  inspection_id: string;
  item_name: string;
  category: string;
  status: string | null;
  notes: string | null;
  action_required: boolean | null;
}

interface TemplateItem {
  id: string;
  item_name: string;
  category: string;
  item_code: string;
  sort_order: number;
}

type InspectionItemStatus = "pass" | "fail" | "attention" | "not_applicable";

export function InspectionForm({ inspectionId, templateId, onComplete }: InspectionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { promoteToVehicleFault } = usePromoteToVehicleFault();
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const [safeToOperate, setSafeToOperate] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [showOutOfCommissionReport, setShowOutOfCommissionReport] = useState(false);

  // Fetch the inspection record for vehicle_id, inspector_name, and vehicle details
  const { data: inspectionRecord } = useQuery({
    queryKey: ["vehicle_inspection", inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("vehicle_id, inspector_name, vehicle_registration, vehicle_make, vehicle_model, odometer_reading")
        .eq("id", inspectionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!inspectionId,
  });

  // Auto-create an inspection fault and promote to vehicle fault when an item is marked as "fail" or "attention" (warning)
  const autoLogFault = useCallback(
    async (item: InspectionItem, itemStatus: "fail" | "attention" = "fail") => {
      try {
        const statusLabel = itemStatus === "attention" ? "warning" : "failed";
        const description = item.notes
          ? `${item.item_name} — ${statusLabel} inspection: ${item.notes}`
          : `${item.item_name} — ${statusLabel} inspection`;
        const severity = itemStatus === "attention" ? "low" : "medium";

        // Create inspection_faults record
        const { data: inspectionFault, error: faultError } = await supabase
          .from("inspection_faults")
          .insert({
            inspection_id: inspectionId,
            inspection_item_id: item.id,
            fault_description: description,
            severity: severity as "low" | "medium" | "high" | "critical",
            corrective_action_status: "pending",
            requires_immediate_attention: false,
          })
          .select()
          .single();

        if (faultError) throw faultError;

        // Mark the inspection as having a fault
        await supabase
          .from("vehicle_inspections")
          .update({ has_fault: true })
          .eq("id", inspectionId);

        // Auto-promote to vehicle fault if we have the vehicle info
        if (inspectionRecord?.vehicle_id && inspectionFault) {
          await promoteToVehicleFault({
            inspectionFaultId: inspectionFault.id,
            inspectionId,
            vehicleId: inspectionRecord.vehicle_id,
            faultDescription: description,
            severity,
            reportedBy: inspectionRecord.inspector_name || "Inspector",
            faultCategory: "inspection",
            component: item.category,
          });
        }

        queryClient.invalidateQueries({ queryKey: ["inspection_faults", inspectionId] });
        queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });

        toast({
          title: "Fault Auto-Logged",
          description: `"${item.item_name}" has been automatically logged as a fault`,
        });
      } catch (error) {
        console.error("Auto-fault logging error:", error);
        // Don't block the status update if auto-fault fails
      }
    },
    [inspectionId, inspectionRecord, promoteToVehicleFault, queryClient, toast]
  );

  // Upload photo for an inspection item
  const handlePhotoUpload = useCallback(
    async (itemId: string, itemName: string, file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid File", description: "Please select an image file", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Image must be less than 5MB", variant: "destructive" });
        return;
      }

      setUploadingItemId(itemId);
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${inspectionId}/${itemId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("inspection-photos")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("inspection-photos")
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from("inspection_photos")
          .insert({
            inspection_id: inspectionId,
            inspection_item_id: itemId,
            photo_url: publicUrl,
            photo_type: "inspection",
            caption: `Photo for ${itemName}`,
            file_size: file.size,
          });
        if (dbError) throw dbError;

        toast({ title: "Photo Uploaded", description: "Photo has been attached to this item" });
      } catch (error) {
        console.error("Photo upload error:", error);
        toast({ title: "Upload Failed", description: "Failed to upload photo", variant: "destructive" });
      } finally {
        setUploadingItemId(null);
      }
    },
    [inspectionId, toast]
  );

  // First, fetch the template to get the template_code
  const { data: template } = useQuery({
    queryKey: ["inspection_template", templateId],
    queryFn: async () => {
      if (!templateId) return null;

      const { data, error } = await supabase
        .from("inspection_templates")
        .select("template_code")
        .eq("id", templateId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });

  // Then fetch template items using the template_code
  const { data: templateItems = [] } = useQuery<TemplateItem[]>({
    queryKey: ["template_items", template?.template_code],
    queryFn: async () => {
      if (!template?.template_code) return [];

      const { data, error } = await supabase
        .from("inspection_item_templates")
        .select("*")
        .eq("template_code", template.template_code)
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      return data || [];
    },
    enabled: !!template?.template_code,
  });

  // Fetch existing inspection items
  const { data: inspectionItems = [], refetch } = useQuery<InspectionItem[]>({
    queryKey: ["inspection_items", inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_items")
        .select("*")
        .eq("inspection_id", inspectionId)
        .order("category");

      if (error) throw error;
      return data || [];
    },
    enabled: !!inspectionId,
  });

  // Initialize inspection items from template if they don't exist
  const initializeItems = useMutation({
    mutationFn: async () => {
      if (inspectionItems.length > 0 || templateItems.length === 0) return;

      const itemsToCreate = templateItems.map((item) => ({
        inspection_id: inspectionId,
        item_name: item.item_name,
        category: item.category,
        status: null,
        notes: null,
        action_required: false,
      }));

      const { error } = await supabase
        .from("inspection_items")
        .insert(itemsToCreate);

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Auto-initialize items when template loads
  useEffect(() => {
    if (templateItems.length > 0 && inspectionItems.length === 0 && !initializeItems.isPending) {
      initializeItems.mutate();
    }
  }, [templateItems.length, inspectionItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update item status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: InspectionItemStatus }) => {
      const { error } = await supabase
        .from("inspection_items")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", itemId);

      if (error) throw error;
      return { itemId, status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inspection_items", inspectionId] });
      toast({ title: "Status Updated", description: "Item status has been updated" });

      // Auto-log fault when item is marked as "fail" or "attention" (warning)
      if (result?.status === "fail" || result?.status === "attention") {
        const faultItem = inspectionItems.find((i) => i.id === result.itemId);
        if (faultItem) {
          autoLogFault(faultItem, result.status as "fail" | "attention");
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    },
  });

  // Update item notes mutation
  const updateNotes = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const { error } = await supabase
        .from("inspection_items")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection_items", inspectionId] });
      toast({ title: "Notes Saved", description: "Item notes have been saved" });
    },
  });

  // Complete inspection mutation
  const completeInspection = useMutation({
    mutationFn: async (params?: { safeToOperate?: boolean; notes?: string }) => {
      const updateData: Record<string, unknown> = {
        status: "completed",
        updated_at: new Date().toISOString(),
      };

      if (params?.safeToOperate !== undefined) {
        updateData.safe_to_operate = params.safeToOperate;
      }
      if (params?.notes) {
        updateData.notes = params.notes;
      }

      const { error } = await supabase
        .from("vehicle_inspections")
        .update(updateData)
        .eq("id", inspectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Inspection Completed", description: "The inspection has been marked as completed" });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete inspection",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "pass":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Pass</Badge>;
      case "fail":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Fail</Badge>;
      case "attention":
        return <Badge variant="default" className="bg-yellow-600"><AlertCircle className="h-3 w-3 mr-1" />Attention</Badge>;
      case "not_applicable":
        return <Badge variant="outline"><CircleDashed className="h-3 w-3 mr-1" />N/A</Badge>;
      default:
        return <Badge variant="secondary">Not Checked</Badge>;
    }
  };

  // Group items by category
  const categories = Array.from(new Set(inspectionItems.map((item) => item.category)));
  const categoriesWithLabels = categories.map((cat) => ({
    id: cat,
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
  }));

  const incompletedItems = inspectionItems.filter((item) => !item.status);
  const failedItems = inspectionItems.filter((item) => item.status === "fail");
  const attentionItems = inspectionItems.filter((item) => item.status === "attention");
  const hasFaults = failedItems.length > 0 || attentionItems.length > 0;

  const handleCompleteClick = () => {
    if (hasFaults) {
      setShowCompletionConfirm(true);
    } else {
      completeInspection.mutate({});
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Inspection Progress</CardTitle>
          <CardDescription>
            {inspectionItems.length - incompletedItems.length} of {inspectionItems.length} items checked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{
                  width: `${inspectionItems.length > 0 ? ((inspectionItems.length - incompletedItems.length) / inspectionItems.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-sm font-medium">
              {inspectionItems.length > 0 ? Math.round(((inspectionItems.length - incompletedItems.length) / inspectionItems.length) * 100) : 0}%
            </span>
          </div>

          {failedItems.length > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">
                ⚠️ {failedItems.length} item(s) failed inspection
              </p>
            </div>
          )}

          {incompletedItems.length === 0 && inspectionItems.length > 0 && (
            <div className="mt-4 flex justify-end md:relative fixed bottom-0 left-0 right-0 md:p-0 p-4 bg-background md:bg-transparent border-t md:border-0 z-10">
              <Button onClick={handleCompleteClick} size="lg" className="gap-2 w-full md:w-auto min-h-[48px]">
                <CheckSquare className="h-5 w-5" />
                Mark Inspection Complete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspection Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Inspection Checklist</CardTitle>
          <CardDescription>Assess each item and mark status</CardDescription>
        </CardHeader>
        <CardContent>
          {categoriesWithLabels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading inspection checklist...
            </p>
          ) : (
            <Tabs defaultValue={categoriesWithLabels[0]?.id}>
              <ScrollArea className="w-full" type="scroll">
                <TabsList className="inline-flex w-max">
                  {categoriesWithLabels.map((cat) => {
                    const catCount = inspectionItems.filter(i => i.category === cat.id).length;
                    const catDone = inspectionItems.filter(i => i.category === cat.id && i.status).length;
                    return (
                      <TabsTrigger key={cat.id} value={cat.id} className="whitespace-nowrap px-2 sm:px-4 text-xs sm:text-sm gap-1.5">
                        {cat.label}
                        <span className={`inline-flex items-center justify-center rounded-full text-[10px] w-4 h-4 font-medium ${catDone === catCount ? 'bg-green-500 text-white' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                          {catDone}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {categoriesWithLabels.map((cat) => (
                <TabsContent key={cat.id} value={cat.id} className="space-y-4 mt-4">
                  {inspectionItems
                    .filter((item) => item.category === cat.id)
                    .map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium leading-snug min-w-0 flex-1">{item.item_name}</h4>
                          <div className="shrink-0">{getStatusIcon(item.status)}</div>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          <Button
                            variant={item.status === "pass" ? "default" : "outline"}
                            className={`h-14 flex flex-col items-center justify-center gap-0.5 p-1 text-xs ${item.status === "pass" ? "bg-green-600 hover:bg-green-700" : ""}`}
                            onClick={() => updateStatus.mutate({ itemId: item.id, status: "pass" })}
                          >
                            <CheckCircle2 className="h-5 w-5" />
                            <span>Pass</span>
                          </Button>
                          <Button
                            variant={item.status === "fail" ? "destructive" : "outline"}
                            className="h-14 flex flex-col items-center justify-center gap-0.5 p-1 text-xs"
                            onClick={() => updateStatus.mutate({ itemId: item.id, status: "fail" })}
                          >
                            <XCircle className="h-5 w-5" />
                            <span>Fail</span>
                          </Button>
                          <Button
                            variant={item.status === "attention" ? "default" : "outline"}
                            className={`h-14 flex flex-col items-center justify-center gap-0.5 p-1 text-xs ${item.status === "attention" ? "bg-yellow-600 hover:bg-yellow-700" : ""}`}
                            onClick={() => updateStatus.mutate({ itemId: item.id, status: "attention" })}
                          >
                            <AlertCircle className="h-5 w-5" />
                            <span>Attn</span>
                          </Button>
                          <Button
                            variant={item.status === "not_applicable" ? "secondary" : "outline"}
                            className="h-14 flex flex-col items-center justify-center gap-0.5 p-1 text-xs"
                            onClick={() => updateStatus.mutate({ itemId: item.id, status: "not_applicable" })}
                          >
                            <CircleDashed className="h-5 w-5" />
                            <span>N/A</span>
                          </Button>
                        </div>

                        {(item.status === "fail" || item.status === "attention") && (
                          <div className="space-y-2 pt-1">
                            <Textarea
                              placeholder="Add notes or describe the issue..."
                              value={item.notes || ""}
                              onChange={(e) => {
                                const updatedItems = inspectionItems.map((i) =>
                                  i.id === item.id ? { ...i, notes: e.target.value } : i
                                );
                                queryClient.setQueryData(["inspection_items", inspectionId], updatedItems);
                              }}
                              onBlur={(e) => updateNotes.mutate({ itemId: item.id, notes: e.target.value })}
                              rows={2}
                            />
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                ref={(el) => { fileInputRefs.current[item.id] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoUpload(item.id, item.item_name, file);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                variant="outline"
                                className="gap-2 min-h-[44px] w-full"
                                disabled={uploadingItemId === item.id}
                                onClick={() => fileInputRefs.current[item.id]?.click()}
                              >
                                {uploadingItemId === item.id ? (
                                  <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                                ) : (
                                  <><Camera className="h-4 w-4" /> Add Photo</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Completion Confirmation Dialog (shown when faults exist) */}
      <AlertDialog open={showCompletionConfirm} onOpenChange={setShowCompletionConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Review Before Completing
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This inspection has items that need attention:</p>
                <div className="space-y-1">
                  {failedItems.length > 0 && (
                    <p className="text-destructive font-medium">
                      • {failedItems.length} failed item(s)
                    </p>
                  )}
                  {attentionItems.length > 0 && (
                    <p className="text-yellow-600 font-medium">
                      • {attentionItems.length} item(s) needing attention
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="font-medium text-foreground">Is the vehicle safe to operate?</Label>
                  <RadioGroup value={safeToOperate || ""} onValueChange={setSafeToOperate}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="mobile-safe-yes" />
                      <Label htmlFor="mobile-safe-yes">Yes — safe to operate with noted issues</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="mobile-safe-no" />
                      <Label htmlFor="mobile-safe-no">No — vehicle should not operate</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="font-medium text-foreground">Additional Notes (optional)</Label>
                  <Textarea
                    placeholder="Add any notes about the inspection findings..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSafeToOperate(null);
              setCompletionNotes("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!safeToOperate}
              onClick={() => {
                if (safeToOperate === "no") {
                  setShowCompletionConfirm(false);
                  setShowOutOfCommissionReport(true);
                } else {
                  completeInspection.mutate({
                    safeToOperate: safeToOperate === "yes",
                    notes: completionNotes || undefined,
                  });
                  setShowCompletionConfirm(false);
                  setSafeToOperate(null);
                  setCompletionNotes("");
                }
              }}
            >
              {safeToOperate === "no" ? "Continue to Report" : "Complete Inspection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Out-of-Commission Report Dialog */}
      <OutOfCommissionReportDialog
        open={showOutOfCommissionReport}
        onOpenChange={setShowOutOfCommissionReport}
        inspectionId={inspectionId}
        vehicleId={inspectionRecord?.vehicle_id ?? null}
        vehicleRegistration={inspectionRecord?.vehicle_registration ?? ""}
        vehicleMake={inspectionRecord?.vehicle_make ?? ""}
        vehicleModel={inspectionRecord?.vehicle_model ?? ""}
        odometerReading={inspectionRecord?.odometer_reading ?? null}
        inspectorName={inspectionRecord?.inspector_name ?? ""}
        onComplete={() => {
          setShowOutOfCommissionReport(false);
          completeInspection.mutate({
            safeToOperate: false,
            notes: completionNotes || undefined,
          });
          setSafeToOperate(null);
          setCompletionNotes("");
        }}
      />
    </div>
  );
}