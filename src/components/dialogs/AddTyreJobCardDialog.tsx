import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { UserSelect } from "@/components/ui/user-select";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { useVehicles } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AddTyreJobCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddTyreJobCardDialog = ({ open, onOpenChange }: AddTyreJobCardDialogProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    title: "",
    vehicle_id: undefined as string | undefined,
    assignee: "",
    priority: "medium",
    description: "",
    odometer_reading: "",
  });

  const { data: vehicles = [] } = useVehicles();

  // Fetch tyre inspections only (not general inspections)
  const { data: tyreInspections = [] } = useQuery({
    queryKey: ["tyre_inspections_for_job_card"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("id, inspection_number, vehicle_registration, vehicle_id, inspection_date, status, odometer_reading")
        .eq("inspection_type", "tyre")
        .in("status", ["pending", "in_progress", "completed"])
        .order("inspection_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const handleInspectionChange = async (inspectionId: string) => {
    setSelectedInspectionId(inspectionId);

    if (!inspectionId) return;

    try {
      const inspection = tyreInspections.find((i) => i.id === inspectionId);
      if (!inspection) return;

      // Load inspection faults
      const { data: faults, error: faultsError } = await supabase
        .from("inspection_faults")
        .select("fault_description, severity")
        .eq("inspection_id", inspectionId);

      if (faultsError) throw faultsError;

      const faultsDescription = (faults || [])
        .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.fault_description}`)
        .join("\n");

      setFormData({
        ...formData,
        title: `Tyre Work - ${inspection.vehicle_registration} (${inspection.inspection_number})`,
        vehicle_id: inspection.vehicle_id || "",
        priority: faults?.some((f) => f.severity === "critical" || f.severity === "high")
          ? "high"
          : "medium",
        description: faultsDescription
          ? `Tyre job card from inspection ${inspection.inspection_number}\n\nFaults identified:\n${faultsDescription}`
          : `Tyre job card from inspection ${inspection.inspection_number}`,
        odometer_reading: inspection.odometer_reading ? String(inspection.odometer_reading) : "",
      });

      toast.success("Tyre inspection data loaded");
    } catch (error) {
      console.error("Error loading inspection:", error);
      toast.error("Failed to load inspection data");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      vehicle_id: undefined,
      assignee: "",
      priority: "medium",
      description: "",
      odometer_reading: "",
    });
    setSelectedInspectionId(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.vehicle_id) {
      toast.error("Please fill in all required fields (Title and Vehicle)");
      return;
    }

    setLoading(true);

    try {
      const jobNumber = `TYR-${Date.now()}`;
      const { data: jobCard, error } = await supabase
        .from("job_cards")
        .insert({
          job_number: jobNumber,
          title: formData.title,
          vehicle_id: formData.vehicle_id,
          assignee: formData.assignee || null,
          priority: formData.priority,
          description: formData.description || null,
          status: "pending",
          inspection_id: selectedInspectionId || null,
          odometer_reading: formData.odometer_reading ? parseFloat(formData.odometer_reading) : null,
        })
        .select()
        .single();

      if (error) throw error;

      // If linked to inspection, create tasks from inspection faults
      if (selectedInspectionId && jobCard) {
        const { data: faults } = await supabase
          .from("inspection_faults")
          .select("fault_description, severity")
          .eq("inspection_id", selectedInspectionId);

        if (faults && faults.length > 0) {
          const tasksToCreate = faults.map((fault) => ({
            job_card_id: jobCard.id,
            title: `Fix: ${fault.fault_description.substring(0, 80)}`,
            description: fault.fault_description,
            status: "pending",
            priority: fault.severity === "critical" || fault.severity === "high" ? "high" : "medium",
            assignee: formData.assignee || null,
          }));

          await supabase.from("tasks").insert(tasksToCreate);
        }
      }

      toast.success("Tyre job card created successfully!");
      requestGoogleSheetsSync("workshop");
      queryClient.invalidateQueries({ queryKey: ["tyre_job_cards"] });
      onOpenChange(false);
      resetForm();

      // Navigate to the newly created job card details
      navigate(`/job-card/${jobCard.id}`);
    } catch (error) {
      console.error("Error creating tyre job card:", error);
      toast.error("Failed to create tyre job card");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Circle className="h-5 w-5 text-amber-500" />
            Create Tyre Job Card
          </DialogTitle>
          <DialogDescription>
            Create a new job card specifically for tyre-related work. Link to a tyre inspection to auto-populate faults and tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Link to Tyre Inspection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Link to Tyre Inspection (Optional)</Label>
              {selectedInspectionId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedInspectionId(undefined);
                    setFormData({ ...formData, title: "", description: "" });
                  }}
                >
                  Clear Selection
                </Button>
              )}
            </div>
            <Select value={selectedInspectionId || undefined} onValueChange={handleInspectionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tyre inspection (optional)" />
              </SelectTrigger>
              <SelectContent>
                {tyreInspections.map((inspection) => (
                  <SelectItem key={inspection.id} value={inspection.id}>
                    {inspection.inspection_number} - {inspection.vehicle_registration} ({inspection.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Links this job card to a tyre inspection and auto-creates tasks from identified faults
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="tyre-title">Job Title *</Label>
            <Input
              id="tyre-title"
              placeholder="e.g. Replace worn front tyres, Tyre rotation & balance"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          {/* Vehicle */}
          <div className="space-y-2">
            <Label htmlFor="tyre-vehicle">Vehicle *</Label>
            <Select
              value={formData.vehicle_id || undefined}
              onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}
            >
              <SelectTrigger>
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

          {/* Odometer */}
          <div className="space-y-2">
            <Label htmlFor="tyre-odometer">Odometer Reading (km)</Label>
            <Input
              id="tyre-odometer"
              type="number"
              placeholder="Current vehicle KM"
              value={formData.odometer_reading}
              onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
            />
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label htmlFor="tyre-assignee">Assignee</Label>
            <UserSelect
              value={formData.assignee}
              onValueChange={(value) => setFormData({ ...formData, assignee: value })}
              placeholder="Select assignee"
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="tyre-priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="tyre-description">Description</Label>
            <Textarea
              id="tyre-description"
              placeholder="Describe the tyre work required (e.g. replacement positions, tread issues, pressure problems)..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Creating..." : "Create Tyre Job Card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTyreJobCardDialog;
