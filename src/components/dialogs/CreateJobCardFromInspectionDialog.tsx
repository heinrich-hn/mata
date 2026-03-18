import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { AlertCircle } from "lucide-react";
import { usePromoteToVehicleFault } from "@/hooks/usePromoteToVehicleFault";
import type { Database } from "@/integrations/supabase/types";

type FaultSeverity = Database["public"]["Enums"]["fault_severity"];

interface Fault {
  id: string;
  fault_description: string;
  severity: FaultSeverity;
  requires_immediate_attention: boolean;
}

interface CreateJobCardFromInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  faults: Fault[];
  vehicleId: string;
  onJobCardCreated: () => void;
}

const CreateJobCardFromInspectionDialog = ({
  open,
  onOpenChange,
  inspectionId,
  faults,
  vehicleId,
  onJobCardCreated,
}: CreateJobCardFromInspectionDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedFaults, setSelectedFaults] = useState<string[]>(
    faults.filter(f => f.requires_immediate_attention).map(f => f.id)
  );
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "high",
    assignee: "",
  });
  
  const { promoteToVehicleFault } = usePromoteToVehicleFault();

  const handleFaultToggle = (faultId: string) => {
    setSelectedFaults(prev =>
      prev.includes(faultId)
        ? prev.filter(id => id !== faultId)
        : [...prev, faultId]
    );
  };

  const generateJobNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `JC-${year}-${random}`;
  };

  const handleSubmit = async () => {
    if (selectedFaults.length === 0) {
      toast.error("Please select at least one fault");
      return;
    }

    if (!formData.title) {
      toast.error("Please enter a job title");
      return;
    }

    setLoading(true);
    try {
      // Create job card
      const { data: jobCard, error: jobCardError } = await supabase
        .from("job_cards")
        .insert({
          job_number: generateJobNumber(),
          title: formData.title,
          description: formData.description || null,
          vehicle_id: vehicleId,
          inspection_id: inspectionId,
          priority: formData.priority,
          assignee: formData.assignee || null,
          status: "pending",
        })
        .select()
        .single();

      if (jobCardError) throw jobCardError;

      // Link selected faults to job card and promote to vehicle faults
      const { error: linkError } = await supabase
        .from("inspection_faults")
        .update({ 
          job_card_id: jobCard.id,
          corrective_action_status: "pending"
        })
        .in("id", selectedFaults);

      if (linkError) throw linkError;

      // Promote faults to vehicle faults system
      for (const fault of faults.filter(f => selectedFaults.includes(f.id))) {
        await promoteToVehicleFault({
          inspectionFaultId: fault.id,
          inspectionId: inspectionId,
          vehicleId: vehicleId,
          faultDescription: fault.fault_description,
          severity: fault.severity,
          reportedBy: "Inspector",
          component: "general",
          faultCategory: "inspection",
        });
      }

      // Create tasks from faults
      const tasksToCreate = faults
        .filter(f => selectedFaults.includes(f.id))
        .map(fault => ({
          job_card_id: jobCard.id,
          title: fault.fault_description,
          description: `Severity: ${fault.severity}`,
          priority: fault.requires_immediate_attention ? "urgent" : formData.priority,
          status: "pending",
        }));

      if (tasksToCreate.length > 0) {
        const { error: tasksError } = await supabase
          .from("tasks")
          .insert(tasksToCreate);

        if (tasksError) throw tasksError;
      }

      toast.success(`Job Card ${jobCard.job_number} created successfully`);
      requestGoogleSheetsSync('workshop');
      onJobCardCreated();
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create job card";
      console.error("Error creating job card:", error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Job Card from Inspection</DialogTitle>
          <DialogDescription>
            Select faults to address and provide job card details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Faults Selection */}
          <div className="space-y-3">
            <Label>Select Faults to Address</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
              {faults.map((fault) => (
                <div key={fault.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={selectedFaults.includes(fault.id)}
                    onCheckedChange={() => handleFaultToggle(fault.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{fault.fault_description}</span>
                      <Badge variant={getSeverityVariant(fault.severity)}>
                        {fault.severity}
                      </Badge>
                      {fault.requires_immediate_attention && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Urgent
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Job Card Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Brake System Repair"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee">Assign To</Label>
                <Input
                  id="assignee"
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  placeholder="Technician name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about the work required..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Creating..." : `Create Job Card (${selectedFaults.length} faults)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateJobCardFromInspectionDialog;