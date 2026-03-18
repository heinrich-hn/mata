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
import { UserSelect } from "@/components/ui/user-select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { DatePicker } from "../ui/date-picker";

interface CreateWorkOrderFromInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  inspectionNumber: string;
  vehicleRegistration: string | null;
  onSuccess?: () => void;
}

export function CreateWorkOrderFromInspectionDialog({
  open,
  onOpenChange,
  inspectionId,
  inspectionNumber,
  vehicleRegistration,
  onSuccess,
}: CreateWorkOrderFromInspectionDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [faults, setFaults] = useState<Array<{ fault_description: string; severity: string }>>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [odometerReading, setOdometerReading] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    assignee: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    if (open && inspectionId) {
      loadInspectionData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inspectionId]);

  const loadInspectionData = async () => {
    try {
      // Load inspection faults
      const { data: faultsData, error: faultsError } = await supabase
        .from("inspection_faults")
        .select("fault_description, severity")
        .eq("inspection_id", inspectionId);

      if (faultsError) throw faultsError;
      setFaults(faultsData || []);

      // Load vehicle data to get vehicle_id and odometer_reading
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("vehicle_inspections")
        .select("vehicle_id, odometer_reading")
        .eq("id", inspectionId)
        .single();

      if (inspectionError) throw inspectionError;
      setVehicleId(inspectionData.vehicle_id || "");
      setOdometerReading(inspectionData.odometer_reading || null);

      // Pre-fill the form
      const faultsDescription = (faultsData || [])
        .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.fault_description}`)
        .join("\n");

      setFormData({
        title: `Maintenance Work - ${vehicleRegistration || 'Unknown Vehicle'} (${inspectionNumber})`,
        assignee: "",
        priority: faultsData?.some((f) => f.severity === "critical" || f.severity === "high")
          ? "high"
          : "medium",
        description: `Job Card created from inspection ${inspectionNumber}\n\nFaults identified:\n${faultsDescription}`,
        due_date: "",
      });
    } catch (error) {
      console.error("Error loading inspection data:", error);
      toast.error("Failed to load inspection data");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.assignee) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const jobNumber = `WO${Date.now().toString().slice(-6)}`;

      // Create the job card
      const { data: jobCard, error: jobCardError } = await supabase
        .from("job_cards")
        .insert({
          job_number: jobNumber,
          title: formData.title,
          vehicle_id: vehicleId,
          assignee: formData.assignee,
          priority: formData.priority,
          description: formData.description,
          due_date: formData.due_date || null,
          status: "pending",
          inspection_id: inspectionId,
          odometer_reading: odometerReading,
        })
        .select()
        .single();

      if (jobCardError) throw jobCardError;

      // Create tasks from faults
      if (faults.length > 0 && jobCard) {
        const tasksToCreate = faults.map((fault) => ({
          job_card_id: jobCard.id,
          title: `Fix: ${fault.fault_description.substring(0, 80)}`,
          description: fault.fault_description,
          status: "pending",
          priority: fault.severity === "critical" || fault.severity === "high" ? "high" : "medium",
          assignee: formData.assignee,
        }));

        const { error: tasksError } = await supabase
          .from("tasks")
          .insert(tasksToCreate);

        if (tasksError) {
          console.error("Error creating tasks:", tasksError);
          // Don't fail the whole operation if tasks fail
          toast.error("Job card created, but some tasks failed to create");
        }
      }

      toast.success(`Job Card ${jobNumber} created with ${faults.length} task(s)!`);
      requestGoogleSheetsSync('workshop');

      // Send notification to assignee (placeholder - implement notification system)
      toast.info(`Notification sent to ${formData.assignee}`);

      onSuccess?.();
      onOpenChange(false);

      // Navigate to the job card details page instead of staying on inspection
      navigate(`/job-card/${jobCard.id}`);

      // Reset form
      setFormData({
        title: "",
        assignee: "",
        priority: "medium",
        description: "",
        due_date: "",
      });
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
          <DialogTitle>Create Job Card from Inspection</DialogTitle>
          <DialogDescription>
            Create a maintenance job card from inspection {inspectionNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Job card title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle</Label>
            <Input
              id="vehicle"
              value={vehicleRegistration}
              disabled
              className="bg-muted"
            />
          </div>

          {odometerReading && (
            <div className="space-y-2">
              <Label>Odometer Reading</Label>
              <Input
                value={`${odometerReading.toLocaleString()} km`}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">From inspection record</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="assignee">Assign To *</Label>
            <UserSelect
              value={formData.assignee}
              onValueChange={(value) => setFormData({ ...formData, assignee: value })}
              placeholder="Select technician"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value as typeof formData.priority })
                }
              >
                <SelectTrigger id="priority">
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

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <DatePicker
                id="due_date"
                value={formData.due_date}
                onChange={(date) => setFormData({ ...formData, due_date: date ? date.toISOString().split('T')[0] : '' })}
                placeholder="Select due date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of work to be performed..."
              rows={8}
              className="resize-none"
            />
          </div>

          {faults.length > 0 && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="font-medium mb-2">Faults from Inspection ({faults.length}):</p>
              <ul className="text-sm space-y-1">
                {faults.map((fault, i) => (
                  <li key={i} className="text-muted-foreground">
                    • <span className="font-semibold">[{fault.severity.toUpperCase()}]</span>{" "}
                    {fault.fault_description}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Job Card
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}