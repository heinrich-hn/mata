import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getDefaultRiskScore } from "@/lib/driverBehaviorRiskScores";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { DatePicker } from "../ui/date-picker";
import { useFleetNumbers } from "@/hooks/useFleetNumbers";

type DriverEvent = Database["public"]["Tables"]["driver_behavior_events"]["Row"];

interface DriverBehaviorEditModalProps {
  event: DriverEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function DriverBehaviorEditModal({
  event,
  open,
  onOpenChange,
  onSaved,
}: DriverBehaviorEditModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<Partial<DriverEvent>>({});
  const { data: fleetNumbers = [] } = useFleetNumbers();

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DriverEvent>) => {
      const { error } = await supabase
        .from("driver_behavior_events")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", event.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-behavior-events"] });
      toast({ title: "Updated", description: "Event updated successfully" });
      onSaved();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("driver_behavior_events")
        .delete()
        .eq("id", event.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-behavior-events"] });
      toast({ title: "Deleted", description: "Event removed successfully" });
      onSaved();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (Object.keys(edited).length === 0) {
      toast({ title: "No changes", description: "Nothing to update", variant: "destructive" });
      return;
    }
    updateMutation.mutate(edited);
  };

  const handleDelete = () => {
    // Prevent deletion of debriefed events
    if (event.debriefed_at) {
      toast({
        title: "Cannot Delete",
        description: "Debriefed events cannot be deleted. You can edit the status instead.",
        variant: "destructive"
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete this event?\n\n` +
      `Driver: ${event.driver_name}\n` +
      `Type: ${event.event_type}\n` +
      `Date: ${event.event_date}\n\n` +
      `This action cannot be undone.`
    );

    if (confirmed) {
      deleteMutation.mutate();
    }
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

  const sev = getSeverityConfig(event.severity || "medium");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-blue-600" />
            Edit Driver Behavior Event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Current Event Info */}
          <div className={`rounded-lg p-4 border-2 ${sev.bg} ${sev.border}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Current Event</h3>
              <Badge className={`${sev.bg} ${sev.text} border ${sev.border}`}>
                {event.severity || "medium"}
              </Badge>
            </div>
            <p className="text-sm text-gray-700">
              <strong>{event.driver_name}</strong> • Fleet #{event.fleet_number || "N/A"} • {event.event_type}
            </p>
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="driver_name">Driver Name *</Label>
                <Input
                  id="driver_name"
                  value={edited.driver_name ?? event.driver_name}
                  onChange={(e) => setEdited({ ...edited, driver_name: e.target.value })}
                  placeholder="Enter driver name"
                />
              </div>

              <div>
                <Label htmlFor="fleet_number">Fleet Number</Label>
                <Select
                  value={edited.fleet_number ?? event.fleet_number ?? "__none__"}
                  onValueChange={(v) => setEdited({ ...edited, fleet_number: v === "__none__" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fleet number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Fleet Number</SelectItem>
                    {fleetNumbers.map((fleet) => (
                      <SelectItem key={fleet} value={fleet}>
                        {fleet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event_type">Event Type *</Label>
                <Select
                  value={edited.event_type ?? event.event_type}
                  onValueChange={(v) => setEdited({ ...edited, event_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      // Canonical event types ingested by the
                      // import-driver-behavior edge function (EVENT_TYPE_MAP values).
                      const canonical = [
                        "Harsh Acceleration",
                        "Harsh Braking",
                        "Sharp Cornering",
                        "Speed Limit Violation",
                        "Lane Weaving",
                        "Tailgating",
                        "Distracted Driving",
                        "Cell Phone Use",
                        "Seatbelt Violation",
                        "Driver Unbelted",
                        "Passenger Unbelted",
                        "Passenger Limit",
                        "Fatigue Alert",
                        "Yawn Alert",
                        "Obstruction",
                        "Violent Left Turn",
                        "Violent Turn",
                        "Possible Accident",
                        "Accident",
                        "Near Miss",
                        "Traffic Violation",
                        "Customer Complaint",
                        "Speeding",
                        "Other",
                      ];
                      const current = edited.event_type ?? event.event_type;
                      const all = current && !canonical.includes(current)
                        ? [...canonical, current]
                        : canonical;
                      return all.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={edited.severity ?? event.severity ?? "medium"}
                  onValueChange={(v) => setEdited({ ...edited, severity: v })}
                >
                  <SelectTrigger>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="event_date">Event Date *</Label>
                <DatePicker
                  id="event_date"
                  value={edited.event_date ?? event.event_date}
                  onChange={(date) => setEdited({ ...edited, event_date: date ? date.toISOString().split('T')[0] : '' })}
                  placeholder="Select event date"
                />
              </div>

              <div>
                <Label htmlFor="event_time">Event Time</Label>
                <Input
                  id="event_time"
                  type="time"
                  value={edited.event_time ?? event.event_time ?? ""}
                  onChange={(e) => setEdited({ ...edited, event_time: e.target.value || null })}
                />
              </div>

              <div>
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min="0"
                  value={edited.points ?? event.points ?? 0}
                  onChange={(e) => setEdited({ ...edited, points: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="risk_score">Risk Score (1-5)</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={
                    edited.risk_score != null
                      ? String(edited.risk_score)
                      : event.risk_score != null
                        ? String(event.risk_score)
                        : "__none__"
                  }
                  onValueChange={(v) =>
                    setEdited({ ...edited, risk_score: v === "__none__" ? null : Number(v) })
                  }
                >
                  <SelectTrigger id="risk_score" className="flex-1">
                    <SelectValue placeholder="Not assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not assigned</SelectItem>
                    <SelectItem value="1">1 — Minimal</SelectItem>
                    <SelectItem value="2">2 — Low</SelectItem>
                    <SelectItem value="3">3 — Moderate</SelectItem>
                    <SelectItem value="4">4 — High</SelectItem>
                    <SelectItem value="5">5 — Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const type = edited.event_type ?? event.event_type;
                    setEdited({ ...edited, risk_score: getDefaultRiskScore(type) });
                  }}
                  title="Auto-suggest risk score from event type"
                >
                  Auto-suggest
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Suggested for {edited.event_type ?? event.event_type}: {getDefaultRiskScore(edited.event_type ?? event.event_type)}/5
              </p>
            </div>

            <div>
              <Label htmlFor="location">Event Video URL</Label>
              <Input
                id="location"
                value={edited.location ?? event.location ?? ""}
                onChange={(e) => setEdited({ ...edited, location: e.target.value || null })}
                placeholder="Enter event video URL"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={edited.description ?? event.description}
                onChange={(e) => setEdited({ ...edited, description: e.target.value })}
                rows={4}
                placeholder="Enter event description"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={edited.status ?? event.status ?? "open"}
                onValueChange={(v) => setEdited({ ...edited, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || Object.keys(edited).length === 0}
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
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending || !!event.debriefed_at}
              className="h-12 px-6"
              title={event.debriefed_at ? "Cannot delete debriefed events" : "Delete this event"}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 px-6"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
