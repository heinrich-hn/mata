import { Badge } from "@/components/ui/badge";
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
import { useVehicles } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type VehicleFault = Database["public"]["Tables"]["vehicle_faults"]["Row"] & {
  vehicles?: {
    registration_number: string;
    make: string;
    model: string;
  } | null;
};

interface EditFaultDialogProps {
  fault: VehicleFault | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditFaultDialog = ({ fault, open, onOpenChange }: EditFaultDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const [loading, setLoading] = useState(false);

  type FaultStatus = Database["public"]["Enums"]["fault_status"];

  const [formData, setFormData] = useState({
    vehicleId: "",
    severity: "medium" as "low" | "medium" | "high" | "critical",
    category: "",
    component: "",
    description: "",
    reportedBy: "",
    status: "identified" as FaultStatus,
  });

  // Populate form when fault changes
  useEffect(() => {
    if (fault) {
      setFormData({
        vehicleId: fault.vehicle_id,
        severity: fault.severity,
        category: fault.fault_category,
        component: fault.component || "",
        description: fault.fault_description,
        reportedBy: fault.reported_by,
        status: fault.status,
      });
    }
  }, [fault]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fault) return;

    if (!formData.vehicleId || !formData.description || !formData.category || !formData.reportedBy) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("vehicle_faults")
        .update({
          vehicle_id: formData.vehicleId,
          severity: formData.severity,
          fault_category: formData.category,
          component: formData.component || null,
          fault_description: formData.description,
          reported_by: formData.reportedBy,
          status: formData.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fault.id);

      if (error) throw error;

      toast({
        title: "Fault Updated",
        description: `Fault ${fault.fault_number} has been updated successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to update fault. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!fault) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Fault - {fault.fault_number}</DialogTitle>
          <DialogDescription>
            Update the fault details below
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicleId">Vehicle *</Label>
            <Select
              value={formData.vehicleId}
              onValueChange={(value) =>
                setFormData({ ...formData, vehicleId: value })
              }
            >
              <SelectTrigger id="vehicleId">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    <div className="flex items-center gap-2">
                      {vehicle.fleet_number && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {vehicle.fleet_number}
                        </Badge>
                      )}
                      <span className="font-medium">{vehicle.registration_number}</span>
                      <span className="text-muted-foreground text-sm">
                        {vehicle.make} {vehicle.model}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Fault Category *</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              placeholder="e.g., Engine, Brakes, Electrical"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="component">Component (Optional)</Label>
            <Input
              id="component"
              value={formData.component}
              onChange={(e) =>
                setFormData({ ...formData, component: e.target.value })
              }
              placeholder="e.g., Brake Pads, Alternator"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severity">Severity *</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) =>
                  setFormData({ ...formData, severity: value as "low" | "medium" | "high" | "critical" })
                }
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as FaultStatus })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="job_card_created">Job Card Created</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reportedBy">Reported By *</Label>
            <Input
              id="reportedBy"
              value={formData.reportedBy}
              onChange={(e) =>
                setFormData({ ...formData, reportedBy: e.target.value })
              }
              placeholder="Enter reporter name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Fault Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe the fault in detail..."
              rows={4}
              required
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditFaultDialog;