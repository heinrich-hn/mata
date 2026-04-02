import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
Collapsible,
CollapsibleContent,
CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, Calendar, Car, ChevronDown, Gauge, Loader2, MapPin, MoveHorizontal, Package, Pencil, Plus, Trash2, User } from "lucide-react";
import React, { useState } from "react";

interface TyreManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "install" | "remove" | "edit";
  vehicleId: string;
  vehicleRegistration: string;
  fleetNumber: string | null;
  position: string;
  positionLabel: string;
  currentTyreCode: string | null;
  currentDotCode: string | null;
  currentTyreId?: string | null;
}

// Tyre form data for direct installation
interface TyreFormData {
  brand: string;
  model: string;
  size: string;
  type: string;
  dotCode: string;
  serialNumber: string;
  condition: string;
  startingTreadDepth: string;
  treadDepth: string;
  purchaseCostUsd: string;
  startingKm: string;
  currentKm: string;
  installationDate: string;
  currentDate: string;
  installerName: string;
}

const TyreManagementDialog = ({
  open,
  onOpenChange,
  mode,
  vehicleId,
  vehicleRegistration,
  fleetNumber,
  position,
  positionLabel,
  currentTyreCode,
  currentDotCode,
  currentTyreId,
}: TyreManagementDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removeDestination, setRemoveDestination] = useState<string>("holding-bay");
  const [notes, setNotes] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Form data for direct tyre entry
  const [tyreForm, setTyreForm] = useState<TyreFormData>({
    brand: "",
    model: "",
    size: "",
    type: "steer",
    dotCode: "",
    serialNumber: "",
    condition: "good",
    startingTreadDepth: "",
    treadDepth: "",
    purchaseCostUsd: "",
    startingKm: "",
    currentKm: "",
    installationDate: new Date().toISOString().split("T")[0],
    currentDate: new Date().toISOString().split("T")[0],
    installerName: "",
  });

  // Fetch inspectors for installer dropdown
  const { data: inspectors = [] } = useQuery({
    queryKey: ["inspector_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspector_profiles")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Load tyre data when in edit mode
  const { data: existingTyre } = useQuery({
    queryKey: ["tyre_edit", currentTyreId],
    queryFn: async () => {
      if (!currentTyreId) return null;
      const { data, error } = await supabase
        .from("tyres")
        .select("*")
        .eq("id", currentTyreId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: mode === "edit" && !!currentTyreId && open,
  });

  // Fetch movement history when in edit mode
  const { data: movementHistory = [] } = useQuery({
    queryKey: ["tyre_movement_history", currentTyreId],
    queryFn: async () => {
      if (!currentTyreId) return [];

      const { data: historyData, error } = await supabase
        .from("tyre_position_history")
        .select("*")
        .eq("tyre_id", currentTyreId)
        .order("performed_at", { ascending: false });

      if (error) {
        console.error("Error fetching movement history:", error);
        return [];
      }

      if (!historyData || historyData.length === 0) return [];

      // Get vehicle details
      const vehicleIds = historyData
        .map((h) => h.vehicle_id)
        .filter((id): id is string => id !== null);

      if (vehicleIds.length > 0) {
        const { data: vehicles } = await supabase
          .from("vehicles")
          .select("id, fleet_number, registration_number")
          .in("id", vehicleIds);

        const vehicleMap = new Map(vehicles?.map((v) => [v.id, v]) || []);

        return historyData.map((record) => ({
          ...record,
          vehicle: record.vehicle_id ? vehicleMap.get(record.vehicle_id) || null : null,
        }));
      }

      return historyData;
    },
    enabled: mode === "edit" && !!currentTyreId && open,
  });

  // Populate form when editing
  React.useEffect(() => {
    if (mode === "edit" && existingTyre && open) {
      // Use dot_code from tyre record if available, fallback to currentDotCode (from inventory)
      const tyreRecord = existingTyre as Record<string, unknown>;
      const dotCodeFromTyre = typeof tyreRecord.dot_code === 'string' ? tyreRecord.dot_code : null;

      // Handle date - ensure it's in YYYY-MM-DD format for the date input
      let installDate = new Date().toISOString().split("T")[0];
      if (existingTyre.installation_date) {
        // If it's already a date string, use it, otherwise try to parse
        const dateStr = existingTyre.installation_date;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          installDate = dateStr.split("T")[0]; // Handle ISO format
        } else {
          // Try to parse other formats
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            installDate = parsed.toISOString().split("T")[0];
          }
        }
      }

      const resolvedDotCode = dotCodeFromTyre || currentDotCode || "";

      setTyreForm({
        brand: existingTyre.brand || "",
        model: existingTyre.model || "",
        size: existingTyre.size || "",
        type: existingTyre.type || "steer",
        dotCode: resolvedDotCode,
        serialNumber: existingTyre.serial_number || resolvedDotCode || "",
        condition: existingTyre.condition || "good",
        startingTreadDepth: existingTyre.initial_tread_depth?.toString() || "",
        treadDepth: existingTyre.current_tread_depth?.toString() || "",
        purchaseCostUsd: existingTyre.purchase_cost_zar?.toString() || "",
        startingKm: existingTyre.installation_km?.toString() || "",
        currentKm: existingTyre.km_travelled
          ? ((existingTyre.installation_km || 0) + existingTyre.km_travelled).toString()
          : existingTyre.installation_km?.toString() || "",
        installationDate: installDate,
        currentDate: new Date().toISOString().split("T")[0],
        installerName: existingTyre.installer_name || "",
      });
    } else if (mode === "install" && open) {
      // Reset form when opening in install mode
      setTyreForm({
        brand: "",
        model: "",
        size: "",
        type: "steer",
        dotCode: "",
        serialNumber: "",
        condition: "good",
        startingTreadDepth: "",
        treadDepth: "",
        purchaseCostUsd: "",
        startingKm: "",
        currentKm: "",
        installationDate: new Date().toISOString().split("T")[0],
        currentDate: new Date().toISOString().split("T")[0],
        installerName: "",
      });
      setRemoveDestination("holding-bay");
      setNotes("");
    }
  }, [mode, existingTyre, open, currentDotCode]);

  const handleInstall = async () => {
    // Validate required fields
    if (!tyreForm.brand || !tyreForm.size) {
      toast({
        title: "Error",
        description: "Please enter at least the brand and size",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const fleetPosition = `${fleetNumber} ${vehicleRegistration}-${position}`;

      // Only include serial_number if it's non-empty and not just whitespace
      const serialNumber = tyreForm.serialNumber?.trim() || null;

      // Create new tyre record directly
      const { data: newTyre, error: createError } = await supabase
        .from("tyres")
        .insert({
          brand: tyreForm.brand,
          model: tyreForm.model || tyreForm.brand, // model is required
          size: tyreForm.size,
          type: tyreForm.type || "steer",
          serial_number: serialNumber,
          dot_code: tyreForm.dotCode || null,
          condition: (tyreForm.condition || "good") as "excellent" | "good" | "fair" | "poor" | "needs_replacement",
          current_tread_depth: tyreForm.treadDepth ? parseFloat(tyreForm.treadDepth) : null,
          initial_tread_depth: tyreForm.startingTreadDepth ? parseFloat(tyreForm.startingTreadDepth) : null,
          current_fleet_position: fleetPosition,
          installation_date: tyreForm.installationDate || new Date().toISOString().split("T")[0],
          installation_km: tyreForm.startingKm ? parseInt(tyreForm.startingKm) : null,
          km_travelled: tyreForm.startingKm && tyreForm.currentKm
            ? Math.max(0, parseInt(tyreForm.currentKm) - parseInt(tyreForm.startingKm))
            : null,
          installer_name: tyreForm.installerName || null,
          purchase_cost_zar: tyreForm.purchaseCostUsd ? parseFloat(tyreForm.purchaseCostUsd) : null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Update fleet_tyre_positions table - use upsert with conflict columns
      const { error: posError } = await supabase
        .from("fleet_tyre_positions")
        .upsert(
          {
            fleet_number: fleetNumber || "",
            registration_no: vehicleRegistration,
            position: position,
            tyre_code: newTyre.id,
          },
          {
            onConflict: "fleet_number,registration_no,position",
          }
        );

      if (posError) throw posError;

      // Record position history
      await supabase.from("tyre_position_history").insert({
        tyre_id: newTyre.id,
        vehicle_id: vehicleId,
        action: "installed",
        fleet_position: fleetPosition,
        to_position: position,
        performed_at: new Date().toISOString(),
        notes: notes || `Installed to ${positionLabel}`,
      });

      // Record lifecycle event
      await supabase.from("tyre_lifecycle_events").insert({
        tyre_id: newTyre.id,
        tyre_code: tyreForm.dotCode || newTyre.id,
        event_type: "installation",
        event_date: new Date().toISOString(),
        fleet_position: position,
        vehicle_id: vehicleId,
        notes: notes || `Installed to ${positionLabel} on ${vehicleRegistration}`,
        metadata: {
          brand: tyreForm.brand,
          model: tyreForm.model,
          size: tyreForm.size,
          dotCode: tyreForm.dotCode,
        },
      });

      toast({
        title: "Tyre Installed",
        description: `${tyreForm.brand} ${tyreForm.model || ""} installed to ${positionLabel} successfully`,
      });
      requestGoogleSheetsSync('tyres');

      queryClient.invalidateQueries({ queryKey: ["fleet_tyre_positions"] });
      queryClient.invalidateQueries({ queryKey: ["tyres"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_bays"] });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error installing tyre:", error);
      toast({
        title: "Error",
        description: "Failed to install tyre",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!currentTyreId) {
      toast({
        title: "Error",
        description: "No tyre to edit",
        variant: "destructive",
      });
      return;
    }

    if (!tyreForm.brand || !tyreForm.size) {
      toast({
        title: "Error",
        description: "Please enter at least the brand and size",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("tyres")
        .update({
          brand: tyreForm.brand,
          model: tyreForm.model || tyreForm.brand,
          size: tyreForm.size,
          type: tyreForm.type || "steer",
          serial_number: tyreForm.serialNumber || null,
          dot_code: tyreForm.dotCode || null,
          condition: (tyreForm.condition || "good") as "excellent" | "good" | "fair" | "poor" | "needs_replacement",
          initial_tread_depth: tyreForm.startingTreadDepth ? parseFloat(tyreForm.startingTreadDepth) : null,
          current_tread_depth: tyreForm.treadDepth ? parseFloat(tyreForm.treadDepth) : null,
          installation_date: tyreForm.installationDate || null,
          installation_km: tyreForm.startingKm ? parseInt(tyreForm.startingKm) : null,
          km_travelled: tyreForm.startingKm && tyreForm.currentKm
            ? Math.max(0, parseInt(tyreForm.currentKm) - parseInt(tyreForm.startingKm))
            : null,
          installer_name: tyreForm.installerName || null,
          purchase_cost_zar: tyreForm.purchaseCostUsd ? parseFloat(tyreForm.purchaseCostUsd) : null,
        })
        .eq("id", currentTyreId);

      if (updateError) throw updateError;

      toast({
        title: "Tyre Updated",
        description: `${tyreForm.brand} ${tyreForm.model || ""} updated successfully`,
      });
      requestGoogleSheetsSync('tyres');

      queryClient.invalidateQueries({ queryKey: ["fleet_tyre_positions"] });
      queryClient.invalidateQueries({ queryKey: ["tyres"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_edit", currentTyreId] });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating tyre:", error);
      toast({
        title: "Error",
        description: "Failed to update tyre",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!currentTyreCode) {
      toast({
        title: "Error",
        description: "No tyre installed at this position",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Fetch the tyre record and vehicle odometer to properly calculate km_travelled
      const { data: tyreRecord } = await supabase
        .from("tyres")
        .select("installation_km, km_travelled")
        .eq("id", currentTyreCode)
        .single();

      const { data: vehicleRecord } = await supabase
        .from("vehicles")
        .select("current_odometer")
        .eq("id", vehicleId)
        .single();

      // Calculate km for this stint: vehicle odometer - installation km
      const installationKm = tyreRecord?.installation_km || 0;
      const vehicleOdometer = vehicleRecord?.current_odometer || 0;
      const currentStintKm = vehicleOdometer > installationKm
        ? vehicleOdometer - installationKm
        : 0;
      // Accumulate lifetime km
      const previousKm = tyreRecord?.km_travelled || 0;
      const totalKmTravelled = previousKm + currentStintKm;

      // Update tyre - remove from vehicle, preserve km_travelled
      const { error: updateError } = await supabase
        .from("tyres")
        .update({
          current_fleet_position: null,
          position: removeDestination, // Using position field to track bay location
          km_travelled: totalKmTravelled,
          installation_km: null, // Clear since no longer on a vehicle
        })
        .eq("id", currentTyreCode);

      if (updateError) throw updateError;

      // Remove from fleet_tyre_positions
      const { error: posError } = await supabase
        .from("fleet_tyre_positions")
        .delete()
        .eq("fleet_number", fleetNumber || "")
        .eq("registration_no", vehicleRegistration)
        .eq("position", position);

      if (posError) throw posError;

      // Record position history
      await supabase.from("tyre_position_history").insert({
        tyre_id: currentTyreCode,
        vehicle_id: vehicleId,
        action: "removed",
        fleet_position: `${fleetNumber} ${vehicleRegistration}-${position}`,
        from_position: position,
        to_position: removeDestination,
        km_reading: vehicleOdometer || null,
        performed_at: new Date().toISOString(),
        notes: notes || `Removed from ${positionLabel}, moved to ${getBayLabel(removeDestination)}. KM travelled this stint: ${currentStintKm.toLocaleString()}, lifetime: ${totalKmTravelled.toLocaleString()}`,
      });

      // Record lifecycle event
      await supabase.from("tyre_lifecycle_events").insert({
        tyre_id: currentTyreCode,
        tyre_code: currentDotCode || currentTyreCode,
        event_type: "removal",
        event_date: new Date().toISOString(),
        fleet_position: position,
        vehicle_id: vehicleId,
        km_reading: vehicleOdometer || null,
        notes: `Removed from ${positionLabel} on ${vehicleRegistration}. Moved to: ${getBayLabel(removeDestination)}. KM this stint: ${currentStintKm.toLocaleString()}, lifetime: ${totalKmTravelled.toLocaleString()}`,
        metadata: { destination: removeDestination, stintKm: currentStintKm, lifetimeKm: totalKmTravelled },
      });

      toast({
        title: "Tyre Removed",
        description: `Tyre removed from ${positionLabel} and moved to ${getBayLabel(removeDestination)}`,
      });
      requestGoogleSheetsSync('tyres');

      queryClient.invalidateQueries({ queryKey: ["fleet_tyre_positions"] });
      queryClient.invalidateQueries({ queryKey: ["tyres"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_bays"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error removing tyre:", error);
      toast({
        title: "Error",
        description: "Failed to remove tyre",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTyreForm({
      brand: "",
      model: "",
      size: "",
      type: "steer",
      dotCode: "",
      serialNumber: "",
      condition: "good",
      startingTreadDepth: "",
      treadDepth: "",
      purchaseCostUsd: "",
      startingKm: "",
      currentKm: "",
      installationDate: new Date().toISOString().split("T")[0],
      currentDate: new Date().toISOString().split("T")[0],
      installerName: "",
    });
    setRemoveDestination("holding-bay");
    setNotes("");
  };

  const getBayLabel = (value: string) => {
    const bay = destinationOptions.find(opt => opt.value === value);
    return bay?.label || value;
  };

  const destinationOptions = [
    { value: "holding-bay", label: "Holding Bay" },
    { value: "retread-bay", label: "Retread Bay" },
    { value: "scrap", label: "Scrap" },
    { value: "sold", label: "Sold" },
  ];

  const tyreTypes = [
    { value: "steer", label: "Steer" },
    { value: "drive", label: "Drive" },
    { value: "trailer", label: "Trailer" },
  ];

  const conditionOptions = [
    { value: "excellent", label: "Excellent" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
    { value: "poor", label: "Poor" },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "install" ? (
              <>
                <Plus className="w-5 h-5" />
                Install Tyre
              </>
            ) : mode === "edit" ? (
              <>
                <Pencil className="w-5 h-5" />
                Edit Tyre
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                Remove Tyre
              </>
            )}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-1 pt-1">
            <Badge variant="outline" className="text-xs">{position}</Badge>
            <Badge variant="secondary" className="text-xs">{positionLabel}</Badge>
            {mode === "remove" && currentDotCode && (
              <Badge className="text-xs">DOT: {currentDotCode}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {(mode === "install" || mode === "edit") ? (
            <div className="space-y-3">
              {/* Row 1: Brand, Model, Size, Type */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="brand" className="text-xs font-medium">Brand *</Label>
                  <Input
                    id="brand"
                    value={tyreForm.brand}
                    onChange={(e) => setTyreForm({ ...tyreForm, brand: e.target.value })}
                    placeholder="Michelin"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="model" className="text-xs font-medium">Model</Label>
                  <Input
                    id="model"
                    value={tyreForm.model}
                    onChange={(e) => setTyreForm({ ...tyreForm, model: e.target.value })}
                    placeholder="X Multi D"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="size" className="text-xs font-medium">Size *</Label>
                  <Input
                    id="size"
                    value={tyreForm.size}
                    onChange={(e) => setTyreForm({ ...tyreForm, size: e.target.value })}
                    placeholder="295/80R22.5"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="type" className="text-xs font-medium">Type</Label>
                  <Select
                    value={tyreForm.type}
                    onValueChange={(v) => setTyreForm({ ...tyreForm, type: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {tyreTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="cursor-pointer">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: DOT Code, Serial, Condition */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dotCode" className="text-xs font-medium">DOT Code</Label>
                  <Input
                    id="dotCode"
                    value={tyreForm.dotCode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTyreForm({ ...tyreForm, dotCode: value, serialNumber: value });
                    }}
                    placeholder="DOT XXXX"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="serialNumber" className="text-xs font-medium">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    value={tyreForm.serialNumber}
                    onChange={(e) => setTyreForm({ ...tyreForm, serialNumber: e.target.value })}
                    placeholder="Auto-filled"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="condition" className="text-xs font-medium">Condition</Label>
                  <Select
                    value={tyreForm.condition}
                    onValueChange={(v) => setTyreForm({ ...tyreForm, condition: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div></div>
              </div>

              {/* Row 2b: Tread Depths */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="startingTreadDepth" className="text-xs font-medium">Starting Tread (mm)</Label>
                  <Input
                    id="startingTreadDepth"
                    type="number"
                    step="0.1"
                    value={tyreForm.startingTreadDepth}
                    onChange={(e) => setTyreForm({ ...tyreForm, startingTreadDepth: e.target.value })}
                    placeholder="New: 12-16mm"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="treadDepth" className="text-xs font-medium">Current Tread (mm)</Label>
                  <Input
                    id="treadDepth"
                    type="number"
                    step="0.1"
                    value={tyreForm.treadDepth}
                    onChange={(e) => setTyreForm({ ...tyreForm, treadDepth: e.target.value })}
                    placeholder="Current depth"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Tread Worn (mm)</Label>
                  <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                    {tyreForm.startingTreadDepth && tyreForm.treadDepth
                      ? (parseFloat(tyreForm.startingTreadDepth) - parseFloat(tyreForm.treadDepth)).toFixed(1)
                      : "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Cost per mm (USD)</Label>
                  <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                    {tyreForm.purchaseCostUsd && tyreForm.startingTreadDepth && tyreForm.treadDepth
                      ? (() => {
                        const worn = parseFloat(tyreForm.startingTreadDepth) - parseFloat(tyreForm.treadDepth);
                        return worn > 0
                          ? `$${(parseFloat(tyreForm.purchaseCostUsd) / worn).toFixed(2)}`
                          : "—";
                      })()
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Row 3: Price, Starting KM, Current KM, Installer */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="purchaseCostUsd" className="text-xs font-medium">Price (USD)</Label>
                  <Input
                    id="purchaseCostUsd"
                    type="number"
                    step="0.01"
                    value={tyreForm.purchaseCostUsd}
                    onChange={(e) => setTyreForm({ ...tyreForm, purchaseCostUsd: e.target.value })}
                    placeholder="250.00"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="startingKm" className="text-xs font-medium">Starting KM</Label>
                  <Input
                    id="startingKm"
                    type="number"
                    value={tyreForm.startingKm}
                    onChange={(e) => setTyreForm({ ...tyreForm, startingKm: e.target.value })}
                    placeholder="At installation"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currentKm" className="text-xs font-medium">Current KM</Label>
                  <Input
                    id="currentKm"
                    type="number"
                    value={tyreForm.currentKm}
                    onChange={(e) => setTyreForm({ ...tyreForm, currentKm: e.target.value })}
                    placeholder="Current reading"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="installerName" className="text-xs font-medium">Installer</Label>
                  <Select
                    value={tyreForm.installerName}
                    onValueChange={(value) => setTyreForm({ ...tyreForm, installerName: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select installer" />
                    </SelectTrigger>
                    <SelectContent>
                      {inspectors.map((inspector) => (
                        <SelectItem key={inspector.id} value={inspector.name} className="cursor-pointer">
                          {inspector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 4: Dates */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="installationDate" className="text-xs font-medium">Installation Date</Label>
                  <Input
                    id="installationDate"
                    type="date"
                    value={tyreForm.installationDate}
                    onChange={(e) => setTyreForm({ ...tyreForm, installationDate: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currentDate" className="text-xs font-medium">Current Date</Label>
                  <Input
                    id="currentDate"
                    type="date"
                    value={tyreForm.currentDate}
                    onChange={(e) => setTyreForm({ ...tyreForm, currentDate: e.target.value })}
                    className="h-9"
                  />
                </div>
                {/* Summary Stats inline */}
                <div className="flex items-end">
                  {tyreForm.startingKm && tyreForm.currentKm && (
                    <div className="w-full px-2 py-1.5 bg-muted/50 rounded text-xs">
                      <span className="text-muted-foreground">Distance: </span>
                      <span className="font-semibold">
                        {Math.max(0, parseInt(tyreForm.currentKm) - parseInt(tyreForm.startingKm)).toLocaleString()} KM
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-end">
                  {tyreForm.installationDate && tyreForm.currentDate && (
                    <div className="w-full px-2 py-1.5 bg-muted/50 rounded text-xs">
                      <span className="text-muted-foreground">In Service: </span>
                      <span className="font-semibold">
                        {Math.max(0, Math.floor((new Date(tyreForm.currentDate).getTime() - new Date(tyreForm.installationDate).getTime()) / (1000 * 60 * 60 * 24)))} days
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Movement History Section */}
              {mode === "edit" && movementHistory.length > 0 && (
                <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between h-8">
                      <span className="flex items-center gap-2 text-xs">
                        <MoveHorizontal className="w-3 h-3" />
                        Movement History ({movementHistory.length})
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <ScrollArea className="h-[150px] rounded-md border p-2">
                      <div className="space-y-3">
                        {movementHistory.map((record: {
                          id: string;
                          action: string | null;
                          fleet_position: string | null;
                          from_position: string | null;
                          to_position: string | null;
                          km_reading: number | null;
                          performed_at: string | null;
                          performed_by: string | null;
                          vehicle?: { fleet_number: string | null; registration_number: string | null } | null;
                        }) => (
                          <div key={record.id} className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg text-sm">
                            <div className="mt-0.5">
                              {record.action?.toLowerCase().includes("install") ? (
                                <Package className="w-4 h-4 text-green-600" />
                              ) : record.action?.toLowerCase().includes("remove") ? (
                                <Package className="w-4 h-4 text-red-600" />
                              ) : (
                                <MapPin className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={record.action?.toLowerCase().includes("install") ? "default" : record.action?.toLowerCase().includes("remove") ? "destructive" : "secondary"} className="text-xs">
                                  {record.action || "Unknown"}
                                </Badge>
                                {record.performed_at && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(record.performed_at), "dd MMM yyyy")}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {record.from_position && (
                                  <span className="flex items-center gap-1">
                                    From: <Badge variant="outline" className="text-xs px-1">{record.from_position}</Badge>
                                  </span>
                                )}
                                {record.to_position && (
                                  <span className="flex items-center gap-1">
                                    To: <Badge variant="outline" className="text-xs px-1">{record.to_position}</Badge>
                                  </span>
                                )}
                                {record.km_reading && (
                                  <span className="flex items-center gap-1">
                                    <Gauge className="w-3 h-3" />
                                    {record.km_reading.toLocaleString()} km
                                  </span>
                                )}
                              </div>
                              {record.vehicle && (
                                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                                  <Car className="w-3 h-3" />
                                  {record.vehicle.fleet_number} {record.vehicle.registration_number && `(${record.vehicle.registration_number})`}
                                </div>
                              )}
                              {record.performed_by && (
                                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {record.performed_by}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current Tyre</p>
                {currentDotCode ? (
                  <Badge variant="secondary" className="text-sm">DOT: {currentDotCode}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">No DOT code available</span>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Move To</Label>
                <Select
                  value={removeDestination}
                  onValueChange={setRemoveDestination}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-medium">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this operation..."
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={
              mode === "install"
                ? handleInstall
                : mode === "edit"
                  ? handleEdit
                  : handleRemove
            }
            disabled={isSubmitting || ((mode === "install" || mode === "edit") && (!tyreForm.brand || !tyreForm.size))}
            variant={mode === "remove" ? "destructive" : "default"}
          >
            {isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {mode === "install" ? "Install Tyre" : mode === "edit" ? "Update Tyre" : "Remove Tyre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TyreManagementDialog;