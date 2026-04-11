import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import
  {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import
  {
    Edit2,
    FileText,
    Loader2,
    Save,
    X
  } from "lucide-react";
import { useState } from "react";

// CAR (Corrective Action Request) Reports - formal incident documentation
type CAR = {
  id: string;
  report_number: string;
  driver_name: string;
  fleet_number: string | null;
  incident_date: string;
  incident_time: string | null;
  incident_location: string | null;
  incident_type: string;
  severity: string;
  description: string;
  immediate_action_taken: string | null;
  root_cause_analysis: string | null;
  corrective_actions: string | null;
  preventive_measures: string | null;
  responsible_person: string | null;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  status: string;
  reference_event_id: string | null;
  attachments: unknown;
  created_at: string;
  updated_at?: string | null;
};

interface CarDetailModalProps {
  car: CAR;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CarDetailModal({
  car,
  open,
  onOpenChange,
}: CarDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState<Partial<CAR>>({});

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<CAR>) => {
      // Remove attachments from updates if present to avoid type mismatch
      const { attachments: _attachments, ...safeUpdates } = updates;
      const { error } = await supabase
        .from("car_reports")
        .update({ ...safeUpdates, updated_at: new Date().toISOString() })
        .eq("id", car.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["car_reports"] });
      toast({ title: "Updated", description: "CAR updated successfully" });
      setIsEditing(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (Object.keys(edited).length === 0) {
      toast({ title: "No changes", description: "Nothing to save", variant: "destructive" });
      return;
    }
    updateMutation.mutate(edited);
  };

  const getSeverityConfig = (severity: string = "medium") => {
    const cfg = {
      low: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
      high: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
      critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    };
    return cfg[severity as keyof typeof cfg] ?? cfg.medium;
  };

  const sev = getSeverityConfig(car.severity);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            {car.report_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Severity & Status */}
          <div className="flex items-center gap-3">
            <Badge className={`${sev.bg} ${sev.text} border ${sev.border} font-semibold`}>
              {car.severity}
            </Badge>
            <Badge variant={car.status === "resolved" ? "default" : "destructive"}>
              {car.status}
            </Badge>
          </div>

          {/* Driver & Fleet */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-base font-medium text-gray-800">Driver</Label>
              <p className="mt-1.5 text-gray-700">{car.driver_name}</p>
            </div>
            {car.fleet_number && (
              <div>
                <Label className="text-base font-medium text-gray-800">Fleet Number</Label>
                <p className="mt-1.5 text-gray-700">{car.fleet_number}</p>
              </div>
            )}
          </div>

          {/* Incident Details */}
          <div>
            <Label className="text-base font-medium text-gray-800">Incident Type</Label>
            <p className="mt-1.5 text-gray-700">{car.incident_type}</p>
          </div>

          <div>
            <Label className="text-base font-medium text-gray-800">Description</Label>
            <p className="mt-1.5 text-gray-700 bg-white border rounded-lg p-3">
              {car.description}
            </p>
          </div>

          {/* Root Cause Analysis */}
          {car.root_cause_analysis && (
            <div>
              <Label className="text-base font-medium text-gray-800">Root Cause Analysis</Label>
              <p className="mt-1.5 text-gray-700 bg-white border rounded-lg p-3">
                {car.root_cause_analysis}
              </p>
            </div>
          )}

          {/* Corrective Actions */}
          {car.corrective_actions && (
            <div>
              <Label className="text-base font-medium text-gray-800">Corrective Actions</Label>
              <p className="mt-1.5 text-gray-700 bg-white border rounded-lg p-3">
                {car.corrective_actions}
              </p>
            </div>
          )}

          {/* Editable Fields */}
          {isEditing ? (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={edited.status ?? car.status}
                    onValueChange={(v) => setEdited({ ...edited, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsible Person</Label>
                  <Input
                    value={edited.responsible_person ?? car.responsible_person ?? ""}
                    onChange={(e) => setEdited({ ...edited, responsible_person: e.target.value || null })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Target Completion Date</Label>
                  <DatePicker
                    value={edited.target_completion_date ?? car.target_completion_date ?? undefined}
                    onChange={(date) => setEdited({ ...edited, target_completion_date: date ? date.toISOString().split('T')[0] : null })}
                    placeholder="Select target date"
                  />
                </div>
                <div>
                  <Label>Actual Completion Date</Label>
                  <DatePicker
                    value={edited.actual_completion_date ?? car.actual_completion_date ?? undefined}
                    onChange={(date) => setEdited({ ...edited, actual_completion_date: date ? date.toISOString().split('T')[0] : null })}
                    placeholder="Select actual date"
                  />
                </div>
              </div>
              <div>
                <Label>Preventive Measures</Label>
                <Textarea
                  value={edited.preventive_measures ?? car.preventive_measures ?? ""}
                  onChange={(e) => setEdited({ ...edited, preventive_measures: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-base font-medium text-gray-800">Responsible Person</Label>
                <p className="mt-1.5 text-gray-700">{car.responsible_person || "Unassigned"}</p>
              </div>
              <div>
                <Label className="text-base font-medium text-gray-800">Target Completion</Label>
                <p className="mt-1.5 text-gray-700">
                  {car.target_completion_date ? format(new Date(car.target_completion_date), "MMM dd, yyyy") : "Not set"}
                </p>
              </div>
              {car.actual_completion_date && (
                <div>
                  <Label className="text-base font-medium text-gray-800">Actual Completion</Label>
                  <p className="mt-1.5 text-gray-700">
                    {format(new Date(car.actual_completion_date), "MMM dd, yyyy")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-1 h-12"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEdited({});
                  }}
                  className="flex-1 h-12"
                >
                  <X className="mr-2 h-5 w-5" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="flex-1 h-12"
                >
                  <Edit2 className="mr-2 h-5 w-5" />
                  Edit CAR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-12 px-6"
                >
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
