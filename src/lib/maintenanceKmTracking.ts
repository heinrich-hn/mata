import { supabase } from "@/integrations/supabase/client";

const KM_ALERT_THRESHOLD = 1000;

export interface KmScheduleStatus {
  scheduleId: string;
  title: string;
  intervalKm: number;
  lastReading: number;
  currentOdometer: number;
  nextServiceKm: number;
  remainingKm: number;
  progressPercent: number;
  isOverdue: boolean;
  isApproaching: boolean;
}

/**
 * Get the latest ending_km for each vehicle from trips.
 * This is the most reliable source of current odometer since
 * the current_odometer column may not be populated.
 */
export async function getVehicleLatestKm(
  vehicleIds: string[]
): Promise<Record<string, number>> {
  if (vehicleIds.length === 0) return {};

  const map: Record<string, number> = {};

  // Fetch the max ending_km per vehicle from trips
  const { data: trips, error } = await supabase
    .from("trips")
    .select("fleet_vehicle_id, ending_km")
    .in("fleet_vehicle_id", vehicleIds)
    .not("ending_km", "is", null)
    .order("ending_km", { ascending: false });

  if (error) {
    console.error("Error fetching trip ending_km:", error);
    return map;
  }

  // Keep only the highest ending_km per vehicle
  (trips || []).forEach((t) => {
    const vid = t.fleet_vehicle_id as string;
    const km = t.ending_km as number;
    if (vid && km && (!map[vid] || km > map[vid])) {
      map[vid] = km;
    }
  });

  // Also check vehicles.current_odometer as fallback
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, current_odometer")
    .in("id", vehicleIds);

  (vehicles || []).forEach((v) => {
    const odo = (v.current_odometer as number) || 0;
    if (odo > (map[v.id] || 0)) {
      map[v.id] = odo;
    }
  });

  return map;
}

/**
 * Evaluate all KM-based maintenance schedules for a specific vehicle.
 * Updates next_due_date to today for any schedule that has exceeded its KM interval.
 */
export async function evaluateKmSchedules(
  vehicleId: string,
  currentOdometer: number
): Promise<void> {
  // Fetch all active odometer-based schedules for this vehicle
  const { data: schedules, error } = await supabase
    .from("maintenance_schedules")
    .select("id, title, odometer_interval_km, last_odometer_reading, next_due_date")
    .eq("vehicle_id", vehicleId)
    .eq("odometer_based", true)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching KM-based schedules:", error);
    return;
  }

  if (!schedules || schedules.length === 0) return;

  const today = new Date().toISOString().split("T")[0];

  for (const schedule of schedules) {
    const intervalKm = schedule.odometer_interval_km || 0;
    const lastReading = schedule.last_odometer_reading || 0;
    const nextServiceKm = lastReading + intervalKm;

    if (currentOdometer >= nextServiceKm) {
      // KM threshold exceeded - set next_due_date to today to trigger overdue
      await supabase
        .from("maintenance_schedules")
        .update({ next_due_date: today })
        .eq("id", schedule.id);
    }
  }
}

/**
 * Calculate KM schedule status for display purposes.
 */
export function calculateKmStatus(
  intervalKm: number,
  lastReading: number,
  currentOdometer: number
): Pick<KmScheduleStatus, "nextServiceKm" | "remainingKm" | "progressPercent" | "isOverdue" | "isApproaching"> {
  const nextServiceKm = lastReading + intervalKm;
  const remainingKm = nextServiceKm - currentOdometer;
  const travelledSinceService = currentOdometer - lastReading;
  const progressPercent = intervalKm > 0
    ? Math.min(Math.round((travelledSinceService / intervalKm) * 100), 100)
    : 0;

  return {
    nextServiceKm,
    remainingKm,
    progressPercent,
    isOverdue: remainingKm <= 0,
    isApproaching: remainingKm > 0 && remainingKm <= KM_ALERT_THRESHOLD,
  };
}

/**
 * Update vehicle odometer reading (only if new value is higher).
 */
export async function updateVehicleOdometer(
  vehicleId: string,
  newOdometer: number
): Promise<boolean> {
  // First check current value to avoid overwriting with lower value
  const { data: vehicle, error: fetchError } = await supabase
    .from("vehicles")
    .select("current_odometer")
    .eq("id", vehicleId)
    .single();

  if (fetchError) {
    console.error("Error fetching vehicle odometer:", fetchError);
    return false;
  }

  const currentOdometer = vehicle?.current_odometer || 0;

  if (newOdometer <= currentOdometer) {
    return false; // Don't update with lower value
  }

  const { error: updateError } = await supabase
    .from("vehicles")
    .update({ current_odometer: newOdometer })
    .eq("id", vehicleId);

  if (updateError) {
    console.error("Error updating vehicle odometer:", updateError);
    return false;
  }

  return true;
}
