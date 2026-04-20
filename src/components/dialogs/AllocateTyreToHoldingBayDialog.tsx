import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type PartsRequest } from "@/hooks/useProcurement";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, Package, Truck } from "lucide-react";
import { useEffect, useState } from "react";

interface AllocateTyreToHoldingBayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PartsRequest | null;
  vehicleFleetNumber?: string | null;
}

export default function AllocateTyreToHoldingBayDialog({
  open,
  onOpenChange,
  request,
  vehicleFleetNumber,
}: AllocateTyreToHoldingBayDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    size: "",
    type: "radial",
    serial_number: "",
    dot_code: "",
    current_tread_depth: "",
    initial_tread_depth: "",
    condition: "excellent" as Database["public"]["Enums"]["tyre_condition"],
    purchase_cost_zar: "",
    purchase_cost_usd: "",
    notes: "",
  });

  // Pre-fill from the parts request data when dialog opens
  useEffect(() => {
    if (open && request) {
      // Try to parse part_name for brand/model/size info
      const partName = request.part_name || "";
      const parts = partName.split(/\s+/);

      // Common tyre sizes pattern (e.g., 315/80R22.5, 11R22.5, 295/80R22.5)
      const sizePattern = /\d{2,3}\/?\d{0,3}R?\d{2,3}\.?\d{0,1}/i;
      const sizeMatch = partName.match(sizePattern);

      setFormData({
        brand: parts.length >= 1 ? parts[0] : "",
        model: parts.length >= 2 ? parts[1] : "",
        size: sizeMatch ? sizeMatch[0] : (parts.length >= 3 ? parts[2] : ""),
        type: "radial",
        serial_number: request.part_number || "",
        dot_code: "",
        current_tread_depth: "",
        initial_tread_depth: "",
        condition: "excellent",
        purchase_cost_zar: request.unit_price ? String(request.unit_price) : "",
        purchase_cost_usd: "",
        notes: vehicleFleetNumber
          ? `Procured for vehicle ${vehicleFleetNumber} (Job Card: ${request.job_card?.job_number || "N/A"})`
          : request.job_card?.job_number
            ? `Procured for Job Card: ${request.job_card.job_number}`
            : "",
      });
    }
  }, [open, request, vehicleFleetNumber]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!request) return;

    if (!formData.brand || !formData.size || !formData.type) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in at least Brand, Size, and Type",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create tyre in holding bay
      const { data: newTyre, error: tyreError } = await supabase
        .from("tyres")
        .insert({
          brand: formData.brand,
          model: formData.model || null,
          size: formData.size,
          type: formData.type,
          serial_number: formData.serial_number || null,
          dot_code: formData.dot_code || null,
          current_tread_depth: formData.current_tread_depth ? parseFloat(formData.current_tread_depth) : null,
          initial_tread_depth: formData.initial_tread_depth ? parseFloat(formData.initial_tread_depth) : null,
          condition: formData.condition,
          purchase_cost_zar: formData.purchase_cost_zar ? parseFloat(formData.purchase_cost_zar) : null,
          purchase_cost_usd: formData.purchase_cost_usd ? parseFloat(formData.purchase_cost_usd) : null,
          notes: formData.notes || null,
          position: "holding-bay",
          current_fleet_position: null,
        })
        .select("id")
        .single();

      if (tyreError) throw tyreError;

      // 2. Add position history entry
      if (newTyre) {
        await supabase.from("tyre_position_history").insert({
          tyre_id: newTyre.id,
          vehicle_id: null,
          action: "added_to_bay",
          fleet_position: "holding-bay",
          from_position: "procurement",
          to_position: "holding-bay",
          km_reading: null,
          performed_by: "Procurement",
          notes: `Tyre received from procurement. IR: ${request.ir_number || "N/A"}. ${vehicleFleetNumber ? `Destined for vehicle ${vehicleFleetNumber}.` : ""}`,
        });
      }

      // 3. Mark parts request as allocated/fulfilled and link the tyre
      const { error: updateError } = await supabase
        .from("parts_requests")
        .update({
          allocated_to_job_card: true,
          allocated_at: new Date().toISOString(),
          status: "fulfilled",
          tyre_id: newTyre?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["procurement-requests"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-cash-manager"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-all"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-stats"] });
      queryClient.invalidateQueries({ queryKey: ["tyre_bays"] });
      queryClient.invalidateQueries({ queryKey: ["holding_bay_tyres_for_job_card"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });

      requestGoogleSheetsSync("workshop");
      requestGoogleSheetsSync("tyres");

      toast({
        title: "Tyre Added to Holding Bay",
        description: `${formData.brand} ${formData.model} ${formData.size} is now in the Holding Bay. Go to Tyre Management to install it onto the vehicle.`,
      });

      onOpenChange(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to allocate tyre";
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Allocate Tyre to Holding Bay
          </DialogTitle>
          <DialogDescription>
            Fill in the tyre details below. The tyre will be added to the Holding Bay where it can then be installed onto the vehicle.
          </DialogDescription>
        </DialogHeader>

        {/* Target vehicle info */}
        {(vehicleFleetNumber || request?.job_card?.job_number) && (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                Destination
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1 px-3 pb-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Job Card:</span>
                <Badge variant="outline">{request?.job_card?.job_number || "—"}</Badge>
                {vehicleFleetNumber && (
                  <>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Vehicle:</span>
                    <Badge variant="outline" className="font-mono">{vehicleFleetNumber}</Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4 py-2">
          {/* Brand & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Brand *</Label>
              <Input
                value={formData.brand}
                onChange={(e) => handleInputChange("brand", e.target.value)}
                placeholder="e.g. Bridgestone"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => handleInputChange("model", e.target.value)}
                placeholder="e.g. R268"
              />
            </div>
          </div>

          {/* Size & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Size *</Label>
              <Input
                value={formData.size}
                onChange={(e) => handleInputChange("size", e.target.value)}
                placeholder="e.g. 315/80R22.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => handleInputChange("type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radial">Radial</SelectItem>
                  <SelectItem value="bias">Bias</SelectItem>
                  <SelectItem value="retread">Retread</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Serial Number & DOT Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Serial Number</Label>
              <Input
                value={formData.serial_number}
                onChange={(e) => handleInputChange("serial_number", e.target.value)}
                placeholder="Tyre serial number"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">DOT Code</Label>
              <Input
                value={formData.dot_code}
                onChange={(e) => handleInputChange("dot_code", e.target.value)}
                placeholder="e.g. DOT 4823"
              />
            </div>
          </div>

          {/* Condition & Tread Depth */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Condition</Label>
              <Select
                value={formData.condition}
                onValueChange={(v) => handleInputChange("condition", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent (New)</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="needs_replacement">Needs Replacement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Current Tread (mm)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.current_tread_depth}
                onChange={(e) => handleInputChange("current_tread_depth", e.target.value)}
                placeholder="mm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Initial Tread (mm)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.initial_tread_depth}
                onChange={(e) => handleInputChange("initial_tread_depth", e.target.value)}
                placeholder="mm"
              />
            </div>
          </div>

          {/* Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Purchase Cost (ZAR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.purchase_cost_zar}
                onChange={(e) => handleInputChange("purchase_cost_zar", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Purchase Cost (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.purchase_cost_usd}
                onChange={(e) => handleInputChange("purchase_cost_usd", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm">Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        {/* Next step info */}
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="py-2 px-3">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Next Step</p>
                <p className="text-green-700 dark:text-green-300 text-xs">
                  After adding to the Holding Bay, go to <span className="font-semibold">Tyre Management → Holding Bay</span> to install the tyre onto the vehicle.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.brand || !formData.size || !formData.type}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add to Holding Bay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
