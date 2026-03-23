import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getVehicleLatestKm } from '@/lib/maintenanceKmTracking';
import { isReeferFleet } from '@/utils/fleetCategories';

export interface OverdueMaintenanceItem {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  interval_km: number | null;
  last_odometer: number | null;
  current_odometer: number | null;
  vehicle_id: string | null;
  assigned_to: string | null;
  service_type: string | null;
  is_reefer: boolean;
  overdue_type: 'date' | 'km' | 'hours';
  overdue_amount: number;
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
}

// Define the raw schedule type from the database
interface RawMaintenanceSchedule {
  id: string;
  vehicle_id: string | null;
  service_type: string | null;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  title: string | null;
  description: string | null;
  priority: string | null;
  assigned_to: string | null;
  odometer_interval_km: number | null;
  last_odometer_reading: number | null;
  schedule_type: string | null;
}

interface VehicleInfo {
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
}

interface ReeferHoursData {
  hours: number;
  date: string;
}

async function fetchReeferHours(vehicleIds: string[], vehicleFleetMap: Record<string, string>) {
  const fleetNumbers = vehicleIds
    .map(id => vehicleFleetMap[id])
    .filter(Boolean)
    .filter(isReeferFleet);

  if (fleetNumbers.length === 0) return {};

  // Batch query: get latest reefer diesel record per unit
  const { data } = await supabase
    .from("reefer_diesel_records")
    .select("reefer_unit, operating_hours, date")
    .in("reefer_unit", fleetNumbers)
    .not("operating_hours", "is", null)
    .order("date", { ascending: false });

  const hoursMap: Record<string, ReeferHoursData> = {};

  // Take the first (most recent) record per reefer_unit
  for (const record of data || []) {
    if (!hoursMap[record.reefer_unit] && record.operating_hours) {
      hoursMap[record.reefer_unit] = {
        hours: record.operating_hours,
        date: record.date,
      };
    }
  }

  return hoursMap;
}

export function useOverdueMaintenance() {
  return useQuery({
    queryKey: ['overdue-maintenance'],
    queryFn: async () => {
      // Fetch ALL active maintenance schedules
      const { data: schedules, error } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching maintenance schedules:', error);
        throw error;
      }

      if (!schedules || schedules.length === 0) {
        return [];
      }

      // Cast to our type
      const typedSchedules = schedules as RawMaintenanceSchedule[];

      // Get unique vehicle IDs
      const vehicleIds = typedSchedules
        .map(s => s.vehicle_id)
        .filter((id): id is string => id !== null);

      // Fetch vehicle data separately
      let vehiclesMap: Record<string, VehicleInfo> = {};
      const fleetMap: Record<string, string> = {};

      if (vehicleIds.length > 0) {
        const { data: vehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('id, fleet_number, registration_number, make, model')
          .in('id', vehicleIds);

        if (vehiclesError) {
          console.error('Error fetching vehicles:', vehiclesError);
        } else if (vehicles) {
          vehiclesMap = vehicles.reduce((acc, v) => {
            acc[v.id] = v;
            if (v.fleet_number) {
              fleetMap[v.id] = v.fleet_number;
            }
            return acc;
          }, {} as Record<string, VehicleInfo>);
        }
      }

      // Fetch latest odometer readings for non-reefer vehicles
      const nonReeferIds = vehicleIds.filter(id => {
        const fleetNumber = fleetMap[id] || "";
        return !isReeferFleet(fleetNumber);
      });

      const odometerMap = await getVehicleLatestKm(nonReeferIds);

      // Fetch reefer hours
      const reeferHoursMap = await fetchReeferHours(vehicleIds, fleetMap);

      // Check each schedule for overdue status
      const overdueItems: OverdueMaintenanceItem[] = [];

      for (const schedule of typedSchedules) {
        const vehicleId = schedule.vehicle_id;
        const fleetNumber = vehicleId ? fleetMap[vehicleId] || "" : "";
        const isReefer = isReeferFleet(fleetNumber);
        let matched = false;

        // Check KM-based overdue (trucks)
        if (schedule.odometer_interval_km && vehicleId && !isReefer) {
          const currentKm = odometerMap[vehicleId] || 0;
          const lastReading = schedule.last_odometer_reading || 0;
          const nextServiceKm = lastReading + schedule.odometer_interval_km;

          if (currentKm > 0 && currentKm >= nextServiceKm) {
            const kmOverdue = currentKm - nextServiceKm;
            const vehicle = vehiclesMap[vehicleId];

            overdueItems.push({
              id: schedule.id,
              title: schedule.service_type || schedule.title || 'Maintenance',
              description: schedule.description ?? null,
              priority: (schedule.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
              due_date: schedule.next_due_date,
              interval_km: schedule.odometer_interval_km,
              last_odometer: lastReading,
              current_odometer: currentKm,
              vehicle_id: vehicleId,
              assigned_to: schedule.assigned_to ?? null,
              service_type: schedule.service_type ?? null,
              is_reefer: false,
              overdue_type: 'km',
              overdue_amount: kmOverdue,
              vehicles: vehicle ? {
                fleet_number: vehicle.fleet_number,
                registration_number: vehicle.registration_number,
                make: vehicle.make,
                model: vehicle.model,
              } : null,
            });
            matched = true;
          }
        }

        // Check hours-based overdue (reefers)
        if (!matched && schedule.odometer_interval_km && isReefer && fleetNumber) {
          const reeferData = reeferHoursMap[fleetNumber];
          if (reeferData) {
            const currentHours = reeferData.hours;
            const lastReading = schedule.last_odometer_reading || 0;
            const nextServiceHours = lastReading + schedule.odometer_interval_km;

            if (currentHours >= nextServiceHours) {
              const hoursOverdue = currentHours - nextServiceHours;
              const vehicle = vehicleId ? vehiclesMap[vehicleId] : null;

              overdueItems.push({
                id: schedule.id,
                title: schedule.service_type || schedule.title || 'Maintenance',
                description: schedule.description ?? null,
                priority: (schedule.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
                due_date: reeferData.date,
                interval_km: schedule.odometer_interval_km,
                last_odometer: lastReading,
                current_odometer: currentHours,
                vehicle_id: vehicleId,
                assigned_to: schedule.assigned_to ?? null,
                service_type: schedule.service_type ?? null,
                is_reefer: true,
                overdue_type: 'hours',
                overdue_amount: hoursOverdue,
                vehicles: vehicle ? {
                  fleet_number: vehicle.fleet_number,
                  registration_number: vehicle.registration_number,
                  make: vehicle.make,
                  model: vehicle.model,
                } : null,
              });
              matched = true;
            }
          }
        }

        // Check date-based overdue (fallback for all, including schedules with no odometer data)
        if (!matched && schedule.next_due_date) {
          const dueDate = new Date(schedule.next_due_date);
          const todayDate = new Date();

          if (dueDate < todayDate) {
            const daysOverdue = Math.ceil(
              (todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const vehicle = vehicleId ? vehiclesMap[vehicleId] : null;

            overdueItems.push({
              id: schedule.id,
              title: schedule.service_type || schedule.title || 'Maintenance',
              description: schedule.description ?? null,
              priority: (schedule.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
              due_date: schedule.next_due_date,
              interval_km: schedule.odometer_interval_km,
              last_odometer: schedule.last_odometer_reading,
              current_odometer: null,
              vehicle_id: schedule.vehicle_id,
              assigned_to: schedule.assigned_to ?? null,
              service_type: schedule.service_type ?? null,
              is_reefer: isReefer,
              overdue_type: 'date',
              overdue_amount: daysOverdue,
              vehicles: vehicle ? {
                fleet_number: vehicle.fleet_number,
                registration_number: vehicle.registration_number,
                make: vehicle.make,
                model: vehicle.model,
              } : null,
            });
          }
        }
      }

      // Sort by priority and overdue amount
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

      overdueItems.sort((a, b) => {
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;

        // If same priority, sort by overdue amount (largest first)
        return b.overdue_amount - a.overdue_amount;
      });

      return overdueItems;
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}