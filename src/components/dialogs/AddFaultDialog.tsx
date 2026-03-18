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
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface AddFaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddFaultDialog = ({ open, onOpenChange }: AddFaultDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicleId: "",
    severity: "medium" as "low" | "medium" | "high" | "critical",
    category: "",
    component: "",
    description: "",
    reportedBy: "",
  });

  const generateFaultNumber = async () => {
    const { count } = await supabase
      .from("vehicle_faults")
      .select("*", { count: "exact", head: true });

    const faultNumber = `FLT-${String((count || 0) + 1).padStart(4, "0")}`;
    return faultNumber;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const faultNumber = await generateFaultNumber();

      const { error } = await supabase
        .from("vehicle_faults")
        .insert({
          fault_number: faultNumber,
          vehicle_id: formData.vehicleId,
          severity: formData.severity,
          fault_category: formData.category,
          component: formData.component || null,
          fault_description: formData.description,
          reported_by: formData.reportedBy,
          reported_date: new Date().toISOString().split("T")[0],
          status: "identified" as const,
        });

      if (error) throw error;

      toast({
        title: "Fault Logged",
        description: `Fault ${faultNumber} has been logged successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });

      setFormData({
        vehicleId: "",
        severity: "medium",
        category: "",
        component: "",
        description: "",
        reportedBy: "",
      });

      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to log fault. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log New Fault</DialogTitle>
          <DialogDescription>
            Report a vehicle fault or issue that needs attention
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
            <Label htmlFor="reportedBy">Reported By *</Label>
            <Input
              id="reportedBy"
              value={formData.reportedBy}
              onChange={(e) =>
                setFormData({ ...formData, reportedBy: e.target.value })
              }
              placeholder="Enter your name"
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
              {loading ? "Logging..." : "Log Fault"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFaultDialog;