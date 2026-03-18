import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Plus } from "lucide-react";
import { useState } from "react";

type BayType = "holding-bay" | "retread-bay";

interface AddBayTyreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bayType: BayType;
  onAdd: () => void;
}

const AddBayTyreDialog = ({ open, onOpenChange, bayType, onAdd }: AddBayTyreDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    size: "",
    type: "",
    serial_number: "",
    dot_code: "",
    current_tread_depth: "",
    initial_tread_depth: "",
    condition: "good",
    purchase_cost_usd: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      brand: "",
      model: "",
      size: "",
      type: "",
      serial_number: "",
      dot_code: "",
      current_tread_depth: "",
      initial_tread_depth: "",
      condition: "good",
      purchase_cost_usd: "",
      notes: "",
    });
  };

  const handleSubmit = async () => {
    if (!formData.brand || !formData.model || !formData.size || !formData.type) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Brand, Model, Size, Type)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Insert the tyre and get the new ID
      const { data: newTyre, error } = await supabase.from("tyres").insert({
        brand: formData.brand,
        model: formData.model,
        size: formData.size,
        type: formData.type,
        serial_number: formData.serial_number || null,
        dot_code: formData.dot_code || null,
        current_tread_depth: formData.current_tread_depth ? parseFloat(formData.current_tread_depth) : null,
        initial_tread_depth: formData.initial_tread_depth ? parseFloat(formData.initial_tread_depth) : null,
        condition: formData.condition as Database["public"]["Enums"]["tyre_condition"],
        purchase_cost_usd: formData.purchase_cost_usd ? parseFloat(formData.purchase_cost_usd) : null,
        notes: formData.notes || null,
        position: bayType, // This sets the bay location
        current_fleet_position: null, // Not installed on a vehicle
      }).select("id").single();

      if (error) throw error;

      // Add position history entry for tracking
      if (newTyre) {
        const bayLabel = bayType === "holding-bay" ? "Holding Bay" : "Retread Bay";
        await supabase.from("tyre_position_history").insert({
          tyre_id: newTyre.id,
          vehicle_id: null, // Not on a vehicle
          action: "added_to_bay",
          fleet_position: bayType,
          from_position: null,
          to_position: bayType,
          km_reading: null,
          performed_by: "System",
          notes: `Tyre added to ${bayLabel}`,
        });
      }

      toast({
        title: "Success",
        description: `Tyre added to ${bayType === "holding-bay" ? "Holding Bay" : "Retread Bay"} successfully`,
      });

      onAdd();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add tyre";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const bayTitle = bayType === "holding-bay" ? "Holding Bay" : "Retread Bay";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tyre to {bayTitle}</DialogTitle>
          <DialogDescription>
            Add a new tyre to the {bayTitle.toLowerCase()} for storage or processing
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Basic Details */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Basic Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand *</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g., Bridgestone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., R249"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="size">Size *</Label>
                <Input
                  id="size"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="e.g., 295/80R22.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steer">Steer</SelectItem>
                    <SelectItem value="drive">Drive</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Identification */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium text-sm text-muted-foreground">Identification</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input
                  id="serial_number"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  placeholder="Enter serial number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dot_code">DOT Code</Label>
                <Input
                  id="dot_code"
                  value={formData.dot_code}
                  onChange={(e) => setFormData({ ...formData, dot_code: e.target.value })}
                  placeholder="e.g., DOT1234"
                />
              </div>
            </div>
          </div>

          {/* Condition & Measurements */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium text-sm text-muted-foreground">Condition & Measurements</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData({ ...formData, condition: value })}
                >
                  <SelectTrigger id="condition">
                    <SelectValue placeholder="Select condition" />
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
                <Label htmlFor="purchase_cost_usd">Purchase Cost (USD)</Label>
                <Input
                  id="purchase_cost_usd"
                  type="number"
                  step="0.01"
                  value={formData.purchase_cost_usd}
                  onChange={(e) => setFormData({ ...formData, purchase_cost_usd: e.target.value })}
                  placeholder="e.g., 350.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current_tread_depth">Current Tread Depth (mm)</Label>
                <Input
                  id="current_tread_depth"
                  type="number"
                  step="0.1"
                  value={formData.current_tread_depth}
                  onChange={(e) => setFormData({ ...formData, current_tread_depth: e.target.value })}
                  placeholder="e.g., 8.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_tread_depth">Initial Tread Depth (mm)</Label>
                <Input
                  id="initial_tread_depth"
                  type="number"
                  step="0.1"
                  value={formData.initial_tread_depth}
                  onChange={(e) => setFormData({ ...formData, initial_tread_depth: e.target.value })}
                  placeholder="e.g., 12.0"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about the tyre..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            {loading ? "Adding..." : "Add Tyre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddBayTyreDialog;