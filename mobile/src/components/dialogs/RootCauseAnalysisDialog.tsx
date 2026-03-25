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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RootCauseAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  inspectionNumber: string;
  onCompleted: () => void;
}

const ROOT_CAUSES = [
  "Driver/Employee Negligence",
  "Mechanical Failure",
  "Poor Maintenance Practices",
  "Environmental Factors",
  "Manufacturing Defect",
  "Operational Misuse",
  "Wear and Tear",
  "Other",
];

export function RootCauseAnalysisDialog({
  open,
  onOpenChange,
  inspectionId,
  inspectionNumber,
  onCompleted,
}: RootCauseAnalysisDialogProps) {
  const { userName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    root_cause: "",
    conducted_by: userName || "",
    responsible_person: "",
    notes: "",
  });

  const handleSubmit = async () => {
    // Validation
    if (!formData.root_cause) {
      toast.error("Please select a root cause");
      return;
    }

    if (!formData.conducted_by) {
      toast.error("Please enter who conducted the RCA");
      return;
    }

    if (!formData.responsible_person) {
      toast.error("Please enter the responsible person");
      return;
    }

    if (!formData.notes || formData.notes.trim().length < 10) {
      toast.error("Please provide detailed notes (minimum 10 characters)");
      return;
    }

    setLoading(true);
    try {
      // Store RCA data in JSONB column
      const rootCauseData = {
        root_cause: formData.root_cause,
        conducted_by: formData.conducted_by,
        responsible_person: formData.responsible_person,
        notes: formData.notes,
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("vehicle_inspections")
        .update({ root_cause_analysis: rootCauseData })
        .eq("id", inspectionId);

      if (error) throw error;

      toast.success("Root Cause Analysis saved successfully");
      onCompleted();
      onOpenChange(false);

      // Reset form
      setFormData({
        root_cause: "",
        conducted_by: userName || "",
        responsible_person: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error saving RCA:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save Root Cause Analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Root Cause Analysis</DialogTitle>
          <DialogDescription>
            Inspection Report: {inspectionNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="root-cause">
              *Root Cause:
            </Label>
            <Select
              value={formData.root_cause}
              onValueChange={(value) =>
                setFormData({ ...formData, root_cause: value })
              }
            >
              <SelectTrigger id="root-cause">
                <SelectValue placeholder="Select root cause" />
              </SelectTrigger>
              <SelectContent>
                {ROOT_CAUSES.map((cause) => (
                  <SelectItem key={cause} value={cause}>
                    {cause}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conducted-by">
              *RCA Conducted By:
            </Label>
            <UserSelect
              value={formData.conducted_by}
              onValueChange={(value) =>
                setFormData({ ...formData, conducted_by: value })
              }
              placeholder="Select person"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible-person">Responsible Person:</Label>
            <UserSelect
              value={formData.responsible_person}
              onValueChange={(value) =>
                setFormData({ ...formData, responsible_person: value })
              }
              placeholder="Select responsible person"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note:</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Explain what happened, why it happened, contributing factors, actions taken, and preventive measures..."
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}