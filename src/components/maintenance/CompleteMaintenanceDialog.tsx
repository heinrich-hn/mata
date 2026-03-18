import { useState } from "react";
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

  const handleComplete = async () => {
    if (!completedBy) {
      toast.error("Please enter who completed the maintenance");
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

      // Update schedule's last_odometer_reading if odometer was recorded
      if (odometerReading && schedule.odometer_based) {
        const odoValue = parseInt(odometerReading);
        
        // Update the schedule's last_odometer_reading
        await supabase
          .from("maintenance_schedules")
          .update({ last_odometer_reading: odoValue })
          .eq("id", schedule.id);

        // Update vehicle's current_odometer if vehicle is linked
        if (schedule.vehicle_id) {
          await updateVehicleOdometer(schedule.vehicle_id, odoValue);
          // Re-evaluate KM schedules for this vehicle
          await evaluateKmSchedules(schedule.vehicle_id, odoValue);
        }
      }

      // The trigger will handle updating next_due_date
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
              <Label htmlFor="odometer">Odometer Reading</Label>
              <Input
                id="odometer"
                type="number"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                placeholder="Current reading"
              />
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
