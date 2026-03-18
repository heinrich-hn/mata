import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { Calendar, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type TyreCondition = "excellent" | "good" | "fair" | "poor" | "needs_replacement";

interface TyreInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleRegistration: string;
  fleetNumber: string | null;
  tyreCode: string | null;
  dotCode: string | null;
  position: string;
  positionLabel: string;
  existingCondition: string | null;
  existingTreadDepth: number | null;
  currentOdometer?: number | null;
  installationKm?: number | null;
}

const TyreInspectionDialog = ({
  open,
  onOpenChange,
  vehicleId,
  vehicleRegistration,
  fleetNumber,
  tyreCode,
  dotCode,
  position,
  positionLabel,
  existingCondition,
  existingTreadDepth,
  currentOdometer,
  installationKm,
}: TyreInspectionDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate inspection date/time and next inspection
  const inspectionDateTime = new Date();
  const nextInspectionDate = addMonths(inspectionDateTime, 1);

  const [formData, setFormData] = useState({
    treadDepth: "",
    pressure: "",
    condition: "good" as TyreCondition,
    wearPattern: "",
    notes: "",
    inspectorName: "",
    currentKm: "",
  });

  // Reset form when dialog opens with existing data
  useEffect(() => {
    if (open) {
      setFormData({
        treadDepth: existingTreadDepth?.toString() || "",
        pressure: "",
        condition: (existingCondition as TyreCondition) || "good",
        wearPattern: "",
        notes: "",
        inspectorName: "",
        currentKm: currentOdometer?.toString() || "",
      });
    }
  }, [open, existingCondition, existingTreadDepth, currentOdometer]);

  const handleSubmit = async () => {
    if (!formData.inspectorName) {
      toast({
        title: "Error",
        description: "Please enter inspector name",
        variant: "destructive",
      });
      return;
    }

    if (!formData.currentKm) {
      toast({
        title: "Error",
        description: "Please enter current odometer reading",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const kmReading = parseInt(formData.currentKm, 10);

      // Map position to database enum values
      const positionMap: Record<string, string> = {
        FL: "front_left",
        FR: "front_right",
        RL: "rear_left_outer",
        RL1: "rear_left_outer",
        RL2: "rear_left_inner",
        RR: "rear_right_outer",
        RR1: "rear_right_outer",
        RR2: "rear_right_inner",
        spare: "spare",
        SPARE: "spare",
      };

      const dbPosition = positionMap[position] || "front_left";

      // Save inspection record with all required fields
      const { error } = await supabase.from("tyre_inspections").insert([{
        vehicle_id: vehicleId,
        position: dbPosition,
        condition: formData.condition,
        tyre_id: tyreCode && !tyreCode.startsWith("NEW_CODE_") ? tyreCode : null,
        inspector_name: formData.inspectorName,
        inspection_date: inspectionDateTime.toISOString().split("T")[0],
        tread_depth: formData.treadDepth ? parseFloat(formData.treadDepth) : null,
        pressure: formData.pressure ? parseFloat(formData.pressure) : null,
        wear_pattern: formData.wearPattern || null,
        notes: `Position: ${positionLabel} | DOT: ${dotCode || "N/A"} | KM: ${kmReading} | Notes: ${formData.notes}`,
      }] as never);

      if (error) throw error;

      // If tyre has a valid code, update the tyre record with new inspection data
      if (tyreCode && !tyreCode.startsWith("NEW_CODE_")) {
        // Calculate km travelled since installation
        const kmTravelled = installationKm ? Math.max(0, kmReading - installationKm) : null;

        await supabase
          .from("tyres")
          .update({
            current_tread_depth: formData.treadDepth
              ? parseFloat(formData.treadDepth)
              : null,
            condition: formData.condition,
            notes: formData.notes || null,
            last_inspection_date: inspectionDateTime.toISOString().split("T")[0],
            km_travelled: kmTravelled,
          })
          .eq("id", tyreCode);

        // Add lifecycle event with metadata
        await supabase.from("tyre_lifecycle_events").insert({
          tyre_id: tyreCode,
          tyre_code: dotCode || tyreCode,
          event_type: "inspection",
          event_date: inspectionDateTime.toISOString(),
          fleet_position: position,
          vehicle_id: vehicleId,
          km_reading: kmReading,
          tread_depth_at_event: formData.treadDepth
            ? parseFloat(formData.treadDepth)
            : null,
          pressure_at_event: formData.pressure
            ? parseFloat(formData.pressure)
            : null,
          performed_by: formData.inspectorName,
          metadata: {
            positionLabel,
            vehicleRegistration,
            fleetNumber,
            condition: formData.condition,
            wearPattern: formData.wearPattern,
            nextInspectionDate: nextInspectionDate.toISOString().split("T")[0],
          },
          notes: formData.notes || null,
        });
      }

      toast({
        title: "Inspection Saved",
        description: `Inspection for ${positionLabel} completed. Next inspection scheduled for ${format(nextInspectionDate, "dd MMM yyyy")}`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["tyre_inspections"] });
      queryClient.invalidateQueries({ queryKey: ["fleet_tyre_positions"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_lifecycle"] });
      queryClient.invalidateQueries({ queryKey: ["tyres"] });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast({
        title: "Error",
        description: "Failed to save inspection",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Inspect Tyre - {positionLabel}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">{position}</Badge>
            {dotCode && <Badge variant="secondary">DOT: {dotCode}</Badge>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Inspection Date/Time Info */}
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Inspection Date:</span>
              <span>{format(inspectionDateTime, "dd MMM yyyy, HH:mm")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Next Inspection Due:</span>
              <Badge variant="outline">
                {format(nextInspectionDate, "dd MMM yyyy")}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inspectorName">Inspector Name *</Label>
              <Input
                id="inspectorName"
                value={formData.inspectorName}
                onChange={(e) =>
                  setFormData({ ...formData, inspectorName: e.target.value })
                }
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentKm">Current Odometer (km) *</Label>
              <Input
                id="currentKm"
                type="number"
                value={formData.currentKm}
                onChange={(e) =>
                  setFormData({ ...formData, currentKm: e.target.value })
                }
                placeholder="e.g., 125000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="treadDepth">
                Tread Depth (mm)
                {existingTreadDepth && (
                  <span className="text-muted-foreground ml-1">
                    (Current: {existingTreadDepth}mm)
                  </span>
                )}
              </Label>
              <Input
                id="treadDepth"
                type="number"
                step="0.1"
                value={formData.treadDepth}
                onChange={(e) =>
                  setFormData({ ...formData, treadDepth: e.target.value })
                }
                placeholder="e.g., 8.5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pressure">Pressure (PSI)</Label>
              <Input
                id="pressure"
                type="number"
                value={formData.pressure}
                onChange={(e) =>
                  setFormData({ ...formData, pressure: e.target.value })
                }
                placeholder="e.g., 110"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select
              value={formData.condition}
              onValueChange={(value: TyreCondition) =>
                setFormData({ ...formData, condition: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="needs_replacement">Needs Replacement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wearPattern">Wear Pattern</Label>
            <Select
              value={formData.wearPattern}
              onValueChange={(value) =>
                setFormData({ ...formData, wearPattern: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select wear pattern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="even">Even Wear</SelectItem>
                <SelectItem value="center">Center Wear</SelectItem>
                <SelectItem value="edge">Edge Wear (Both)</SelectItem>
                <SelectItem value="inner">Inner Edge Wear</SelectItem>
                <SelectItem value="outer">Outer Edge Wear</SelectItem>
                <SelectItem value="cupping">Cupping/Scalloping</SelectItem>
                <SelectItem value="flat_spot">Flat Spots</SelectItem>
                <SelectItem value="feathering">Feathering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional observations..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TyreInspectionDialog;