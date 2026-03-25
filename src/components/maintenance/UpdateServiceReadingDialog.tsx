import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MaintenanceSchedule } from "@/types/maintenance";
import { updateVehicleOdometer, evaluateKmSchedules } from "@/lib/maintenanceKmTracking";
import { rescheduleAfterCompletion } from "@/lib/maintenanceReschedule";

interface UpdateServiceReadingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule: MaintenanceSchedule;
    isReefer: boolean;
    onComplete: () => void;
}

export function UpdateServiceReadingDialog({
    open,
    onOpenChange,
    schedule,
    isReefer,
    onComplete,
}: UpdateServiceReadingDialogProps) {
    const [reading, setReading] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const lastReading = schedule.last_odometer_reading || 0;
    const interval = schedule.odometer_interval_km || 0;
    const nextServiceAt = lastReading + interval;
    const unit = isReefer ? "hrs" : "km";
    const unitLabel = isReefer ? "Operating Hours" : "Odometer (km)";

    const handleSubmit = async () => {
        const value = parseFloat(reading);
        if (!reading || isNaN(value) || value <= 0) {
            toast.error(`Please enter a valid ${isReefer ? "hours" : "km"} reading`);
            return;
        }

        setIsSubmitting(true);
        try {
            // Create completion history record
            const { error: historyError } = await supabase
                .from("maintenance_schedule_history")
                .insert({
                    schedule_id: schedule.id,
                    scheduled_date: schedule.next_due_date || new Date().toISOString(),
                    completed_date: new Date().toISOString(),
                    status: "completed",
                    completed_by: "Service Reading Update",
                    odometer_reading: Math.round(value),
                    notes: `Service completed. ${unitLabel} updated to ${value.toLocaleString()} ${unit}.`,
                });

            if (historyError) throw historyError;

            // Reschedule: updates last_odometer_reading + last_completed_date
            await rescheduleAfterCompletion(schedule.id, new Date(), Math.round(value));

            // For non-reefer KM-based, also update the vehicle's odometer
            if (!isReefer && schedule.vehicle_id) {
                await updateVehicleOdometer(schedule.vehicle_id, Math.round(value));
                await evaluateKmSchedules(schedule.vehicle_id, Math.round(value));
            }

            toast.success(
                `Service reading updated to ${value.toLocaleString()} ${unit}. ` +
                `Next service at ${(Math.round(value) + interval).toLocaleString()} ${unit}.`
            );

            onComplete();
            onOpenChange(false);
            setReading("");
        } catch (error) {
            console.error("Error updating service reading:", error);
            toast.error("Failed to update service reading");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Update Service {isReefer ? "Hours" : "Km"}: {schedule.title}</DialogTitle>
                    <DialogDescription>
                        Enter the {isReefer ? "operating hours" : "odometer reading"} at which the service was completed.
                        The schedule will automatically reschedule to the next interval.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Last service:</span>
                            <span className="font-medium">{lastReading.toLocaleString()} {unit}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Service interval:</span>
                            <span className="font-medium">{interval.toLocaleString()} {unit}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Was due at:</span>
                            <span className="font-medium text-red-600">{nextServiceAt.toLocaleString()} {unit}</span>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="service-reading">
                            {unitLabel} at Service *
                        </Label>
                        <Input
                            id="service-reading"
                            type="number"
                            value={reading}
                            onChange={(e) => setReading(e.target.value)}
                            placeholder={`Enter current ${isReefer ? "hours" : "km"} reading`}
                            autoFocus
                        />
                        {reading && !isNaN(parseFloat(reading)) && interval > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Next service will be at: {(Math.round(parseFloat(reading)) + interval).toLocaleString()} {unit}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? "Updating..." : "Update & Complete"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
