import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserSelect } from "@/components/ui/user-select";
import { useVehicles } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TemplateManagerDialog } from "./TemplateManagerDialog";

interface AddJobCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddJobCardDialog = ({ open, onOpenChange }: AddJobCardDialogProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
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

  const { data: templates } = useQuery({
    queryKey: ["job_card_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_card_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active inspections
  const { data: inspections = [] } = useQuery({
    queryKey: ["active_inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select("id, inspection_number, vehicle_registration, inspection_date, status")
        .in("status", ["pending", "in_progress", "completed"])
        .order("inspection_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const handleInspectionChange = async (inspectionId: string) => {
    setSelectedInspectionId(inspectionId);

    if (!inspectionId) return;

    try {
      // Load inspection faults and details
      const { data: inspection, error: inspectionError } = await supabase
        .from("vehicle_inspections")
        .select("vehicle_id, vehicle_registration, inspection_number, odometer_reading")
        .eq("id", inspectionId)
        .single();

      if (inspectionError) throw inspectionError;

      const { data: faults, error: faultsError } = await supabase
        .from("inspection_faults")
        .select("fault_description, severity")
        .eq("inspection_id", inspectionId);

      if (faultsError) throw faultsError;

      // Pre-fill form from inspection
      const faultsDescription = (faults || [])
        .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.fault_description}`)
        .join("\n");

      setFormData({
        ...formData,
        title: `Maintenance Work - ${inspection.vehicle_registration} (${inspection.inspection_number})`,
        vehicle_id: inspection.vehicle_id || "",
        priority: faults?.some((f) => f.severity === "critical" || f.severity === "high")
          ? "high"
          : "medium",
        description: `Job Card created from inspection ${inspection.inspection_number}\n\nFaults identified:\n${faultsDescription}`,
        odometer_reading: inspection.odometer_reading ? String(inspection.odometer_reading) : "",
      });

      toast.success("Inspection data loaded");
    } catch (error) {
      console.error("Error loading inspection:", error);
      toast.error("Failed to load inspection data");
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        priority: template.default_priority || "medium",
        description: template.description || "",
      });
      toast.success("Template applied");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.vehicle_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const jobNumber = `JOB-${Date.now()}`;
      const { data: jobCard, error } = await supabase.from("job_cards").insert({
        job_number: jobNumber,
        title: formData.title,
        vehicle_id: formData.vehicle_id,
        assignee: formData.assignee,
        priority: formData.priority,
        description: formData.description,
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

      toast.success("Job card created successfully!");
      onOpenChange(false);
      setFormData({
        title: "",
        vehicle_id: "",
        assignee: "",
        priority: "medium",
        description: "",
        odometer_reading: "",
      });
      setSelectedTemplateId("");
      setSelectedInspectionId("");

      // Navigate to job card details page
      navigate(`/job-card/${jobCard.id}`);
    } catch (error) {
      console.error("Error creating job card:", error);
      toast.error("Failed to create job card");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job Card</DialogTitle>
          <DialogDescription>
            Create a new job card for workshop tasks
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Link to Inspection (Optional)</Label>
              {selectedInspectionId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedInspectionId("");
                    setFormData({
                      ...formData,
                      title: "",
                      description: "",
                    });
                  }}
                >
                  Clear Selection
                </Button>
              )}
            </div>
            <Select value={selectedInspectionId || undefined} onValueChange={handleInspectionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an inspection (optional)" />
              </SelectTrigger>
              <SelectContent>
                {inspections.map((inspection) => (
                  <SelectItem key={inspection.id} value={inspection.id}>
                    {inspection.inspection_number} - {inspection.vehicle_registration} ({inspection.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Link this job card to an inspection to auto-populate details and tasks from faults
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Template (Optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTemplateManagerOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Manage Templates
              </Button>
            </div>
            <Select value={selectedTemplateId || undefined} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="Oil Change & Filter Replacement"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle *</Label>
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

          <div className="space-y-2">
            <Label htmlFor="odometer">Odometer Reading (km)</Label>
            <Input
              id="odometer"
              type="number"
              placeholder="Current vehicle KM"
              value={formData.odometer_reading}
              onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
            />
            {selectedInspectionId && formData.odometer_reading && (
              <p className="text-xs text-muted-foreground">Auto-filled from inspection</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Assignee</Label>
            <UserSelect
              value={formData.assignee}
              onValueChange={(value) => setFormData({ ...formData, assignee: value })}
              placeholder="Select assignee"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Detailed description of the work required..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

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
              {loading ? "Creating..." : "Create Job Card"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <TemplateManagerDialog
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
      />
    </Dialog>
  );
};

export default AddJobCardDialog;