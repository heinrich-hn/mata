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

  // Fetch the inspection record for vehicle_id and inspector_name (needed for auto-fault logging)
  const { data: inspectionRecord } = useQuery({
    queryKey: ["vehicle_inspection", inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("vehicle_id, inspector_name")
        .eq("id", inspectionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!inspectionId,
  });

  // Auto-create an inspection fault and promote to vehicle fault when an item is marked as "fail"
  const autoLogFault = useCallback(
    async (item: InspectionItem) => {
      try {
        const description = item.notes
          ? `${item.item_name} — failed inspection: ${item.notes}`
          : `${item.item_name} — failed inspection`;

        // Create inspection_faults record
        const { data: inspectionFault, error: faultError } = await supabase
          .from("inspection_faults")
          .insert({
            inspection_id: inspectionId,
            inspection_item_id: item.id,
            fault_description: description,
            severity: "medium" as const,
            corrective_action_status: "pending",
            requires_immediate_attention: false,
          })
          .select()
          .single();

        if (faultError) throw faultError;

        // Auto-promote to vehicle fault if we have the vehicle info
        if (inspectionRecord?.vehicle_id && inspectionFault) {
          await promoteToVehicleFault({
            inspectionFaultId: inspectionFault.id,
            inspectionId,
            vehicleId: inspectionRecord.vehicle_id,
            faultDescription: description,
            severity: "medium",
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

      // Auto-log fault when item is marked as "fail"
      if (result?.status === "fail") {
        const failedItem = inspectionItems.find((i) => i.id === result.itemId);
        if (failedItem) {
          autoLogFault(failedItem);
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
    mutationFn: async (params?: { safeToOperate?: string; notes?: string }) => {
      const hasFaults = failedItems.length > 0;

      const updateData: Record<string, unknown> = {
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        has_fault: hasFaults,
      };

      if (params?.notes || params?.safeToOperate) {
        const safetyNote = params?.safeToOperate === "yes"
          ? "Inspector confirmed: Vehicle is SAFE to operate despite faults."
          : params?.safeToOperate === "no"
            ? "Inspector confirmed: Vehicle is NOT SAFE to operate. Must be repaired before use."
            : "";
        const combined = [safetyNote, params?.notes].filter(Boolean).join("\n");
        if (combined) {
          // Fetch current notes and append
          const { data: current } = await supabase
            .from("vehicle_inspections")
            .select("notes")
            .eq("id", inspectionId)
            .single();
          updateData.notes = [current?.notes, combined].filter(Boolean).join("\n---\n");
        }
      }

      const { error } = await supabase
        .from("vehicle_inspections")
        .update(updateData)
        .eq("id", inspectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Inspection Completed", description: "The inspection has been marked as completed" });
      setShowCompletionConfirm(false);
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

  const handleCompleteClick = () => {
    if (failedItems.length > 0 || inspectionItems.some((item) => item.status === "attention")) {
      setSafeToOperate(null);
      setCompletionNotes("");
      setShowCompletionConfirm(true);
    } else {
      completeInspection.mutate({});
    }
  };

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
                <TabsList className="inline-flex w-max md:grid md:w-full" style={{ gridTemplateColumns: categoriesWithLabels.length > 0 ? `repeat(${categoriesWithLabels.length}, 1fr)` : undefined }}>
                  {categoriesWithLabels.map((cat) => (
                    <TabsTrigger key={cat.id} value={cat.id} className="whitespace-nowrap px-4">
                      {cat.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {categoriesWithLabels.map((cat) => (
                <TabsContent key={cat.id} value={cat.id} className="space-y-4 mt-4">
                  {inspectionItems
                    .filter((item) => item.category === cat.id)
                    .map((item) => (
                      <Card key={item.id} className="shadow-sm">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{item.item_name}</h4>
                              {getStatusIcon(item.status)}
                            </div>

                            <div className="grid grid-cols-2 md:flex gap-2">
                              <Button
                                variant={item.status === "pass" ? "default" : "outline"}
                                className={`min-h-[44px] text-sm ${item.status === "pass" ? "bg-green-600 hover:bg-green-700" : ""}`}
                                onClick={() => updateStatus.mutate({ itemId: item.id, status: "pass" })}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Pass
                              </Button>
                              <Button
                                variant={item.status === "fail" ? "destructive" : "outline"}
                                className="min-h-[44px] text-sm"
                                onClick={() => updateStatus.mutate({ itemId: item.id, status: "fail" })}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Fail
                              </Button>
                              <Button
                                variant={item.status === "attention" ? "default" : "outline"}
                                className={`min-h-[44px] text-sm ${item.status === "attention" ? "bg-yellow-600 hover:bg-yellow-700" : ""}`}
                                onClick={() => updateStatus.mutate({ itemId: item.id, status: "attention" })}
                              >
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Attention
                              </Button>
                              <Button
                                variant={item.status === "not_applicable" ? "secondary" : "outline"}
                                className="min-h-[44px] text-sm"
                                onClick={() => updateStatus.mutate({ itemId: item.id, status: "not_applicable" })}
                              >
                                <CircleDashed className="h-4 w-4 mr-1" />
                                N/A
                              </Button>
                            </div>

                            {(item.status === "fail" || item.status === "attention") && (
                              <div className="space-y-2 pt-2">
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
                                    className="gap-2 min-h-[44px] w-full md:w-auto"
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
                        </CardContent>
                      </Card>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Completion Confirmation Dialog (shown when faults exist) */}
      <AlertDialog open={showCompletionConfirm} onOpenChange={setShowCompletionConfirm}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Faults Identified — Confirm Completion
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 mt-2">
                <p className="text-sm">
                  This inspection has items that require attention. Please review and confirm.
                </p>

                {/* Failed items summary */}
                {failedItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-destructive">Failed Items ({failedItems.length})</p>
                    <div className="space-y-1">
                      {failedItems.map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-2 rounded border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.item_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.category.replace(/_/g, " ")}</p>
                            {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                          </div>
                          <Badge variant="destructive" className="ml-2 shrink-0">FAIL</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attention items summary */}
                {inspectionItems.filter((i) => i.status === "attention").length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-yellow-600">Attention Items ({inspectionItems.filter((i) => i.status === "attention").length})</p>
                    <div className="space-y-1">
                      {inspectionItems.filter((i) => i.status === "attention").map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-2 rounded border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.item_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.category.replace(/_/g, " ")}</p>
                            {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                          </div>
                          <Badge variant="default" className="ml-2 shrink-0 bg-yellow-600">ATTENTION</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safe to operate question */}
                {failedItems.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    <Label className="text-sm font-semibold">
                      Is this vehicle safe to operate? <span className="text-destructive">*</span>
                    </Label>
                    <RadioGroup value={safeToOperate || ""} onValueChange={setSafeToOperate}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="safe-yes" />
                        <Label htmlFor="safe-yes" className="text-sm font-normal">Yes — safe to operate with noted faults</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="safe-no" />
                        <Label htmlFor="safe-no" className="text-sm font-normal">No — vehicle must be repaired before use</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Additional notes */}
                <div className="space-y-2">
                  <Label htmlFor="completion-notes" className="text-sm font-medium">Additional Notes</Label>
                  <Textarea
                    id="completion-notes"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Any additional notes on the inspection outcome..."
                    rows={2}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={failedItems.length > 0 && !safeToOperate}
              onClick={(e) => {
                if (failedItems.length > 0 && !safeToOperate) {
                  e.preventDefault();
                  return;
                }
                completeInspection.mutate({ safeToOperate: safeToOperate || undefined, notes: completionNotes || undefined });
              }}
              className={safeToOperate === "no" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {completeInspection.isPending ? "Completing..." : "Confirm & Complete Inspection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}