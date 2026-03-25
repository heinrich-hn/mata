import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MaintenanceSchedule } from "@/types/maintenance";
import { updateVehicleOdometer, evaluateKmSchedules } from "@/lib/maintenanceKmTracking";
import { rescheduleAfterCompletion } from "@/lib/maintenanceReschedule";
import { isReeferFleet } from "@/utils/fleetCategories";

interface CompleteMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: MaintenanceSchedule;
  onComplete: () => void;
}

export function CompleteMaintenanceDialog({
  open,
  onOpenChange,
  schedule,
  onComplete,
}: CompleteMaintenanceDialogProps) {
  const [completedBy, setCompletedBy] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [notes, setNotes] = useState("");
  const [createJobCard, setCreateJobCard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch vehicle fleet number to detect reefer vs truck
  const { data: vehicleInfo } = useQuery({
    queryKey: ["vehicle-fleet-complete", schedule.vehicle_id],
    queryFn: async () => {
      if (!schedule.vehicle_id) return null;
      const { data } = await supabase
        .from("vehicles")
        .select("fleet_number")
        .eq("id", schedule.vehicle_id)
        .single();
      return data;
    },
    enabled: open && !!schedule.vehicle_id,
  });

  const isReefer = isReeferFleet(vehicleInfo?.fleet_number);

  const isOdometerBased = !!schedule.odometer_based;
  const lastReading = schedule.last_odometer_reading || 0;
  const interval = schedule.odometer_interval_km || 0;
  const nextServiceAt = lastReading + interval;

  const handleComplete = async () => {
    if (!completedBy) {
      toast.error("Please enter who completed the maintenance");
      return;
    }

    if (isOdometerBased && !odometerReading) {
      toast.error(
        isReefer
          ? "Please enter the current operating hours"
          : "Please enter the current odometer reading"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Create history record
      const { error: historyError } = await supabase
        .from("maintenance_schedule_history")
        .insert({
          schedule_id: schedule.id,
          scheduled_date: schedule.next_due_date,
          completed_date: new Date().toISOString(),
          status: "completed",
          completed_by: completedBy,
          duration_hours: durationHours ? parseFloat(durationHours) : null,
          odometer_reading: odometerReading ? parseInt(odometerReading) : null,
          labor_hours: laborHours ? parseFloat(laborHours) : null,
          total_cost: totalCost ? parseFloat(totalCost) : null,
          notes,
        });

      if (historyError) throw historyError;

      // Reschedule: recalculate next_due_date, update last_completed_date & last_odometer_reading
      const odoValue = odometerReading ? parseInt(odometerReading) : null;
      await rescheduleAfterCompletion(schedule.id, new Date(), odoValue);

      // For non-reefer KM-based schedules, also update vehicle odometer & re-evaluate
      if (odoValue && schedule.odometer_based && schedule.vehicle_id && !isReefer) {
        await updateVehicleOdometer(schedule.vehicle_id, odoValue);
        await evaluateKmSchedules(schedule.vehicle_id, odoValue);
      }
      toast.success("Maintenance completed successfully");
      onComplete();
      onOpenChange(false);

      // Reset form
      setCompletedBy("");
      setDurationHours("");
      setOdometerReading("");
      setLaborHours("");
      setTotalCost("");
      setNotes("");
    } catch (error) {
      console.error("Error completing maintenance:", error);
      toast.error("Failed to complete maintenance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Maintenance: {schedule.title}</DialogTitle>
          <DialogDescription>
            Record maintenance completion details and update schedule status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="completed-by">Completed By *</Label>
            <Input
              id="completed-by"
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
              placeholder="Technician name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duration (hours)</Label>
              <Input
                id="duration"
                type="number"
                step="0.5"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="Actual duration"
              />
            </div>

            <div>
              <Label htmlFor="odometer">
                {isReefer ? "Operating Hours" : "Odometer Reading (km)"}
                {isOdometerBased && " *"}
              </Label>
              <Input
                id="odometer"
                type="number"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                placeholder={isReefer ? "Current operating hours" : "Current km reading"}
                required={isOdometerBased}
              />
              {isOdometerBased && interval > 0 && (
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <div>Last service: {lastReading.toLocaleString()} {isReefer ? "hrs" : "km"}</div>
                  <div>Interval: {interval.toLocaleString()} {isReefer ? "hrs" : "km"}</div>
                  <div>Next service at: {nextServiceAt.toLocaleString()} {isReefer ? "hrs" : "km"}</div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="labor">Labor Hours</Label>
              <Input
                id="labor"
                type="number"
                step="0.5"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
                placeholder="Labor time"
              />
            </div>

            <div>
              <Label htmlFor="cost">Total Cost (ZAR)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or observations..."
              rows={4}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="create-job-card"
              checked={createJobCard}
              onCheckedChange={setCreateJobCard}
            />
            <Label htmlFor="create-job-card">Create job card for follow-up work</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? "Completing..." : "Complete Maintenance"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
