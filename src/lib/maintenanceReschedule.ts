import { supabase } from "@/integrations/supabase/client";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";

/**
 * After completing a maintenance task, recalculate next_due_date and update the schedule.
 *
 * The DB trigger `trigger_maintenance_complete` fires on UPDATE but the app
 * only INSERTs history rows, so this client-side function bridges the gap.
 *
 * For date-based recurring schedules: calculates the next due date from the
 * completed date + frequency/interval.
 *
 * For odometer/hours-based schedules: updates last_odometer_reading so the
 * next threshold is relative to the new reading.
 *
 * For one-time schedules: deactivates the schedule.
 */
export async function rescheduleAfterCompletion(
    scheduleId: string,
    completedDate: Date,
    odometerReading?: number | null,
): Promise<void> {
    // Fetch the schedule to determine type / frequency
    const { data: schedule, error: fetchError } = await supabase
        .from("maintenance_schedules")
        .select("schedule_type, frequency, frequency_value, odometer_based, odometer_interval_km, end_date")
        .eq("id", scheduleId)
        .single();

    if (fetchError || !schedule) {
        console.error("Failed to fetch schedule for rescheduling:", fetchError);
        return;
    }

    const updatePayload: Record<string, unknown> = {
        last_completed_date: completedDate.toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
    };

    // Update odometer / hours reading when provided
    if (odometerReading != null && schedule.odometer_based) {
        updatePayload.last_odometer_reading = odometerReading;
    }

    // One-time schedules → deactivate after completion
    if (schedule.schedule_type === "one_time") {
        updatePayload.is_active = false;
        updatePayload.next_due_date = "2099-12-31";
    } else if (schedule.odometer_based) {
        // Odometer / hours-based recurring → keep sentinel date, the overdue check
        // uses last_odometer_reading + interval vs current reading.
        // No next_due_date change needed.
    } else {
        // Date-based recurring → calculate new next_due_date
        const freqValue = schedule.frequency_value ?? 1;
        let nextDue: Date;

        switch (schedule.frequency) {
            case "daily":
                nextDue = addDays(completedDate, freqValue);
                break;
            case "weekly":
                nextDue = addWeeks(completedDate, freqValue);
                break;
            case "monthly":
                nextDue = addMonths(completedDate, freqValue);
                break;
            case "quarterly":
                nextDue = addMonths(completedDate, freqValue * 3);
                break;
            case "yearly":
                nextDue = addYears(completedDate, freqValue);
                break;
            default:
                nextDue = addDays(completedDate, freqValue);
                break;
        }

        // Don't schedule past end_date
        if (schedule.end_date && nextDue > new Date(schedule.end_date)) {
            updatePayload.is_active = false;
            updatePayload.next_due_date = "2099-12-31";
        } else {
            updatePayload.next_due_date = nextDue.toISOString().split("T")[0];
        }
    }

    const { error: updateError } = await supabase
        .from("maintenance_schedules")
        .update(updatePayload)
        .eq("id", scheduleId);

    if (updateError) {
        console.error("Failed to reschedule maintenance:", updateError);
    }
}
