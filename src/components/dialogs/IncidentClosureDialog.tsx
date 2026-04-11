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
import type { Incident } from "@/hooks/useIncidents";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface IncidentClosureDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IncidentClosureDialog = ({
  incident,
  open,
  onOpenChange,
}: IncidentClosureDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userName, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    insuranceNumber: "",
    totalCost: "",
    insuranceClaimAmount: "",
    resolutionNotes: "",
    newStatus: "closed" as "closed" | "claimed",
  });

  useEffect(() => {
    if (incident) {
      setFormData({
        insuranceNumber: incident.insurance_number || "",
        totalCost: incident.total_cost?.toString() || "",
        insuranceClaimAmount: incident.insurance_claim_amount?.toString() || "",
        resolutionNotes: incident.resolution_notes || "",
        newStatus: "closed",
      });
    }
  }, [incident]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!incident) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("incidents")
        .update({
          status: formData.newStatus,
          insurance_number: formData.insuranceNumber || null,
          total_cost: formData.totalCost
            ? parseFloat(formData.totalCost)
            : null,
          insurance_claim_amount: formData.insuranceClaimAmount
            ? parseFloat(formData.insuranceClaimAmount)
            : null,
          resolution_notes: formData.resolutionNotes || null,
          closed_at: new Date().toISOString(),
          closed_by: userName || user?.email || "Unknown User",
        })
        .eq("id", incident.id);

      if (error) throw error;

      toast({
        title: "Incident Updated",
        description: `Incident ${incident.incident_number} has been ${formData.newStatus}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error closing incident:", err);
      toast({
        title: "Error",
        description: "Failed to update incident. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Close Incident</DialogTitle>
          <DialogDescription>
            Close incident {incident.incident_number} with resolution details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newStatus">Status</Label>
            <Select
              value={formData.newStatus}
              onValueChange={(value: "closed" | "claimed") =>
                setFormData({ ...formData, newStatus: value })
              }
            >
              <SelectTrigger id="newStatus">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="claimed">Claimed (Insurance)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="insuranceNumber">Insurance Number</Label>
            <Input
              id="insuranceNumber"
              placeholder="Enter insurance claim number"
              value={formData.insuranceNumber}
              onChange={(e) =>
                setFormData({ ...formData, insuranceNumber: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalCost">Total Cost</Label>
              <Input
                id="totalCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.totalCost}
                onChange={(e) =>
                  setFormData({ ...formData, totalCost: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insuranceClaimAmount">Insurance Claim Amount</Label>
              <Input
                id="insuranceClaimAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.insuranceClaimAmount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    insuranceClaimAmount: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolutionNotes">Resolution Notes</Label>
            <Textarea
              id="resolutionNotes"
              placeholder="Enter resolution details..."
              value={formData.resolutionNotes}
              onChange={(e) =>
                setFormData({ ...formData, resolutionNotes: e.target.value })
              }
              rows={4}
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
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Close Incident"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentClosureDialog;