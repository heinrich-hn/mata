import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Fault {
  id: string;
  fault_description: string;
  severity: string;
  corrective_action_status: string | null;
  corrective_action_notes: string | null;
}

interface CorrectiveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faults: Fault[];
  inspectionId: string;
  onCompleted: () => void;
}

const CorrectiveActionDialog = ({
  open,
  onOpenChange,
  faults,
  inspectionId,
  onCompleted,
}: CorrectiveActionDialogProps) => {
  const { userName } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [faultActions, setFaultActions] = useState<Record<string, { status: string; notes: string }>>(
    Object.fromEntries(
      faults.map(f => [
        f.id,
        {
          status: f.corrective_action_status || "pending",
          notes: f.corrective_action_notes || "",
        }
      ])
    )
  );

  const updateFaultAction = (faultId: string, field: "status" | "notes", value: string) => {
    setFaultActions(prev => ({
      ...prev,
      [faultId]: {
        ...prev[faultId],
        [field]: value,
      }
    }));
  };

  const handleSubmit = async () => {
    // Check at least one fault status has been changed from its original
    const hasChanges = faults.some(f => {
      const action = faultActions[f.id];
      return action && (action.status !== (f.corrective_action_status || "pending") || action.notes !== (f.corrective_action_notes || ""));
    });

    if (!hasChanges) {
      toast.error("No changes to save");
      return;
    }

    setLoading(true);
    try {
      // Update each fault with corrective action
      const updates = Object.entries(faultActions).map(([faultId, action]) =>
        supabase
          .from("inspection_faults")
          .update({
            corrective_action_status: action.status,
            corrective_action_notes: action.notes || null,
            corrective_action_date: new Date().toISOString(),
            corrective_action_by: userName || "Unknown User",
          })
          .eq("id", faultId)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error("Failed to update some faults");
      }

      // Sync linked vehicle_faults status for each inspection fault
      const vehicleFaultUpdates = Object.entries(faultActions).map(([faultId, action]) => {
        const resolvedStatuses = ["fixed", "no_need"];
        if (resolvedStatuses.includes(action.status)) {
          return supabase
            .from("vehicle_faults")
            .update({
              status: "resolved" as const,
              resolution_notes: action.notes || `Corrective action: ${action.status}`,
              resolved_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("inspection_fault_id", faultId);
        } else if (action.status === "not_fixed") {
          return supabase
            .from("vehicle_faults")
            .update({
              status: "acknowledged" as const,
              resolution_notes: action.notes || null,
              updated_at: new Date().toISOString(),
            })
            .eq("inspection_fault_id", faultId);
        }
        return null;
      }).filter(Boolean);

      await Promise.all(vehicleFaultUpdates);

      // Check if all faults are now resolved
      const resolvedStatuses = ["fixed", "completed", "no_need"];
      const allResolved = Object.values(faultActions).every(a => resolvedStatuses.includes(a.status));

      if (allResolved) {
        // Update inspection fault_resolved and status
        const { error: inspectionError } = await supabase
          .from("vehicle_inspections")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            fault_resolved: true,
          })
          .eq("id", inspectionId);

        if (inspectionError) throw inspectionError;
      } else {
        // Some faults still open — make sure fault_resolved is false
        await supabase
          .from("vehicle_inspections")
          .update({ fault_resolved: false })
          .eq("id", inspectionId);
      }

      // Invalidate queries so counts update immediately
      queryClient.invalidateQueries({ queryKey: ["inspection_faults", inspectionId] });
      queryClient.invalidateQueries({ queryKey: ["inspections-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["open-faults-count"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-faults-mobile"] });

      toast.success(allResolved ? "All faults resolved — inspection completed" : "Corrective actions updated");
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      console.error("Error recording corrective actions:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to record corrective actions";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "fixed": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "not_fixed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "no_need": return <Ban className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Corrective Actions</DialogTitle>
          <DialogDescription>
            Document the final status and notes for each fault
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {faults.map((fault) => (
            <div key={fault.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{fault.fault_description}</span>
                  <Badge variant={getSeverityVariant(fault.severity)}>
                    {fault.severity}
                  </Badge>
                </div>
                {getStatusIcon(faultActions[fault.id]?.status)}
              </div>

              <div className="space-y-3">
                <Label>Final Status</Label>
                <RadioGroup
                  value={faultActions[fault.id]?.status || "pending"}
                  onValueChange={(value) => updateFaultAction(fault.id, "status", value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id={`${fault.id}-fixed`} />
                    <Label htmlFor={`${fault.id}-fixed`} className="font-normal cursor-pointer">
                      Fixed - Work completed successfully
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="not_fixed" id={`${fault.id}-not-fixed`} />
                    <Label htmlFor={`${fault.id}-not-fixed`} className="font-normal cursor-pointer">
                      Not Fixed - Work pending or incomplete
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no_need" id={`${fault.id}-no-need`} />
                    <Label htmlFor={`${fault.id}-no-need`} className="font-normal cursor-pointer">
                      No Need - Misdiagnosed or not required
                    </Label>
                  </div>
                </RadioGroup>

                <div className="space-y-2">
                  <Label htmlFor={`notes-${fault.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${fault.id}`}
                    value={faultActions[fault.id]?.notes || ""}
                    onChange={(e) => updateFaultAction(fault.id, "notes", e.target.value)}
                    placeholder="Details about the corrective action taken..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CorrectiveActionDialog;