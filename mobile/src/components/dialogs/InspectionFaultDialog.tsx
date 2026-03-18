import { Button } from "@/components/ui/button";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface InspectionFaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  inspectionItemId: string;
  itemName: string;
  onFaultAdded: () => void;
}

export function InspectionFaultDialog({
  open,
  onOpenChange,
  inspectionId,
  inspectionItemId,
  itemName,
  onFaultAdded,
}: InspectionFaultDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<{
    fault_description: string;
    severity: "low" | "medium" | "high" | "critical";
    location: string;
    corrective_action_required: string;
    estimated_cost: string;
    notes: string;
  }>({
    fault_description: "",
    severity: "medium",
    location: "",
    corrective_action_required: "",
    estimated_cost: "",
    notes: "",
  });

  const createFault = useMutation({
    mutationFn: async () => {
      const { data, error} = await supabase
        .from("inspection_faults")
        .insert({
          inspection_id: inspectionId,
          inspection_item_id: inspectionItemId,
          fault_description: formData.fault_description,
          severity: formData.severity,
          corrective_action_notes: formData.corrective_action_required || null,
          corrective_action_status: "pending",
          estimated_cost: formData.estimated_cost
            ? parseFloat(formData.estimated_cost)
            : null,
          requires_immediate_attention: formData.severity === "critical" || formData.severity === "high",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Fault Logged",
        description: "The fault has been recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["inspection_faults", inspectionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection_items", inspectionId] });
      setFormData({
        fault_description: "",
        severity: "medium",
        location: "",
        corrective_action_required: "",
        estimated_cost: "",
        notes: "",
      });
      onFaultAdded();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to log fault",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fault_description) {
      toast({
        title: "Validation Error",
        description: "Please provide a fault description",
        variant: "destructive",
      });
      return;
    }
    createFault.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Log Inspection Fault
          </DialogTitle>
          <DialogDescription>
            Recording fault for: <span className="font-semibold">{itemName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fault_description">
              Fault Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="fault_description"
              value={formData.fault_description}
              onChange={(e) =>
                setFormData({ ...formData, fault_description: e.target.value })
              }
              placeholder="Describe the fault in detail..."
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) =>
                  setFormData({ ...formData, severity: value as "low" | "medium" | "high" | "critical" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Minor Issue</SelectItem>
                  <SelectItem value="medium">Medium - Moderate Issue</SelectItem>
                  <SelectItem value="high">High - Serious Issue</SelectItem>
                  <SelectItem value="critical">Critical - Immediate Action Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Specific Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="e.g., Front left, Rear axle..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="corrective_action">Corrective Action Required</Label>
            <Textarea
              id="corrective_action"
              value={formData.corrective_action_required}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  corrective_action_required: e.target.value,
                })
              }
              placeholder="What needs to be done to fix this issue?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimated_cost">Estimated Repair Cost (USD)</Label>
            <Input
              id="estimated_cost"
              type="number"
              step="0.01"
              value={formData.estimated_cost}
              onChange={(e) =>
                setFormData({ ...formData, estimated_cost: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional observations or context..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createFault.isPending}>
              {createFault.isPending ? "Logging..." : "Log Fault"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}